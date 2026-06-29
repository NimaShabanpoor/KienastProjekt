// Absenzen-Service: Batch-Erfassung, Statistiken, Validierung
// Geschäftsregeln:
// - Keine Absenzen für ausgefallene Lektionen
// - Lehrer (Klassenlehrer) darf nur Anwesend/Abwesend erfassen
// - Leiter entschuldigt Absenzen (ENTSCHULDIGT)
// - Upsert: bestehende Absenz wird aktualisiert

import { AbsenceStatus, Role } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler.middleware';
import { logger } from '../../config/logger';
import { assertTeacherHasClassAccess } from '../../utils/teacherAccess';

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
): Promise<string> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { subject: { select: { classId: true } } },
  });

  if (!lesson) throw new ApiError('Lektion nicht gefunden.', 'LESSON_NOT_FOUND', 404);

  if (lesson.isCancelled) {
    throw new ApiError(
      'Für ausgefallene Lektionen können keine Absenzen erfasst werden.',
      'LESSON_CANCELLED',
      400
    );
  }

  const classId = lesson.subject.classId;

  // Lehrer: nur zugewiesene Klasse
  if (role === Role.LEHRPERSON) {
    await assertTeacherHasClassAccess(teacherId, classId);
  }

  return classId;
}

function sanitizeTeacherAbsenceEntry(entry: AbsenceEntry): AbsenceEntry {
  if (entry.status === AbsenceStatus.ENTSCHULDIGT) {
    throw new ApiError(
      'Lehrer können Absenzen nicht entschuldigen. Bitte den Leiter kontaktieren.',
      'FORBIDDEN',
      403
    );
  }
  if (entry.status === AbsenceStatus.ANWESEND) {
    return entry;
  }
  // Abwesend → automatisch unentschuldigt bis der Leiter entschuldigt
  return { ...entry, status: AbsenceStatus.UNENTSCHULDIGT };
}

export async function createAbsenceBatch(
  lessonId: string,
  absences: AbsenceEntry[],
  recordedById: string,
  role: Role
) {
  await validateAbsenceCreation(lessonId, recordedById, role);

  const entries =
    role === Role.LEHRPERSON
      ? absences.map(sanitizeTeacherAbsenceEntry)
      : absences;

  const results = await prisma.$transaction(
    entries.map((entry) =>
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
    include: { lesson: { include: { subject: { select: { classId: true } } } } },
  });

  if (!absence) throw new ApiError('Absenz nicht gefunden.', 'ABSENCE_NOT_FOUND', 404);

  // Nur der Leiter darf Absenzen bearbeiten/entschuldigen
  if (role === Role.LEHRPERSON) {
    throw new ApiError(
      'Nur der Leiter kann Absenzen bearbeiten oder entschuldigen.',
      'FORBIDDEN',
      403
    );
  }

  return prisma.absence.update({
    where: { id },
    data: { status, note: note ?? null },
  });
}

export async function listAbsences(params: {
  lessonId?: string;
  studentId?: string;
  status?: AbsenceStatus;
  classId?: string;
}) {
  const { lessonId, studentId, status, classId } = params;

  return prisma.absence.findMany({
    where: {
      ...(lessonId && { lessonId }),
      ...(studentId && { studentId }),
      ...(status && { status }),
      ...(classId && { student: { classId } }),
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          class: { select: { id: true, name: true } },
        },
      },
      lesson: {
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
          subject: { select: { name: true } },
        },
      },
      recordedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { lesson: { date: 'desc' } },
    take: 200,
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
