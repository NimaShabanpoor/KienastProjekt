// Absenzen-Service: Batch-Erfassung, Statistiken, Validierung
// Geschäftsregeln:
// - Keine Absenzen für ausgefallene Lektionen
// - Lehrperson muss Lektion zugeteilt sein
// - Upsert: bestehende Absenz wird aktualisiert

import { AbsenceStatus, Role } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler.middleware';
import { logger } from '../../config/logger';

interface AbsenceEntry {
  studentId: string;
  status: AbsenceStatus;
  note?: string | null;
}

// --------------------------------------------------------
// VALIDIERUNG vor Absenz-Erfassung
// --------------------------------------------------------
async function validateAbsenceCreation(
  lessonId: string,
  teacherId: string,
  role: Role
): Promise<void> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { subject: { select: { teacherId: true } } },
  });

  if (!lesson) throw new ApiError('Lektion nicht gefunden.', 'LESSON_NOT_FOUND', 404);

  if (lesson.isCancelled) {
    throw new ApiError(
      'Für ausgefallene Lektionen können keine Absenzen erfasst werden.',
      'LESSON_CANCELLED',
      400
    );
  }

  // Lehrperson: darf nur eigene Lektionen erfassen
  if (role === Role.LEHRPERSON && lesson.subject.teacherId !== teacherId) {
    throw new ApiError(
      'Keine Berechtigung für diese Lektion.',
      'FORBIDDEN',
      403
    );
  }
}

export async function createAbsenceBatch(
  lessonId: string,
  absences: AbsenceEntry[],
  recordedById: string,
  role: Role
) {
  await validateAbsenceCreation(lessonId, recordedById, role);

  // Upsert: eine Transaktion für alle Einträge
  const results = await prisma.$transaction(
    absences.map((entry) =>
      prisma.absence.upsert({
        where: { studentId_lessonId: { studentId: entry.studentId, lessonId } },
        create: {
          studentId: entry.studentId,
          lessonId,
          status: entry.status,
          note: entry.note ?? null,
          recordedById,
        },
        update: {
          status: entry.status,
          note: entry.note ?? null,
          recordedById,
        },
        include: { student: { select: { firstName: true, lastName: true } } },
      })
    )
  );

  logger.info('Absenzen erfasst', { lessonId, count: results.length, recordedById });
  return results;
}

export async function updateAbsence(
  id: string,
  status: AbsenceStatus,
  note: string | null | undefined,
  userId: string,
  role: Role
) {
  const absence = await prisma.absence.findUnique({
    where: { id },
    include: { lesson: { include: { subject: true } } },
  });

  if (!absence) throw new ApiError('Absenz nicht gefunden.', 'ABSENCE_NOT_FOUND', 404);

  // Lehrperson: nur eigene Absenzen ändern
  if (role === Role.LEHRPERSON && absence.lesson.subject.teacherId !== userId) {
    throw new ApiError('Keine Berechtigung für diese Absenz.', 'FORBIDDEN', 403);
  }

  return prisma.absence.update({
    where: { id },
    data: { status, note: note ?? null },
  });
}

export async function getAbsenceStats(params: {
  classId?: string;
  studentId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const { classId, studentId, dateFrom, dateTo } = params;

  const where = {
    ...(studentId && { studentId }),
    ...(classId && { student: { classId } }),
    ...(dateFrom || dateTo ? {
      lesson: {
        date: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      },
    } : {}),
  };

  // Gesamtlektionen aus Absenzen
  const [total, entschuldigt, unentschuldigt] = await Promise.all([
    prisma.absence.count({ where: { ...where, status: { not: AbsenceStatus.ANWESEND } } }),
    prisma.absence.count({ where: { ...where, status: AbsenceStatus.ENTSCHULDIGT } }),
    prisma.absence.count({ where: { ...where, status: AbsenceStatus.UNENTSCHULDIGT } }),
  ]);

  return {
    totalAbsences: total,
    entschuldigt,
    unentschuldigt,
    quote: total > 0 ? Math.round((unentschuldigt / total) * 100) : 0,
  };
}

export async function getThresholdAlerts(threshold: number) {
  // Schüler mit >= threshold unentschuldigten Absenzen
  const grouped = await prisma.absence.groupBy({
    by: ['studentId'],
    where: { status: AbsenceStatus.UNENTSCHULDIGT },
    _count: { id: true },
    having: { id: { _count: { gte: threshold } } },
  });

  const studentIds = grouped.map((g) => g.studentId);

  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    include: { class: { select: { name: true } } },
  });

  return students.map((student) => ({
    student,
    unentschuldigteAbsenzen: grouped.find((g) => g.studentId === student.id)?._count.id ?? 0,
  }));
}
