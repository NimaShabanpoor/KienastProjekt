// Absenzen-Service: Batch-Erfassung, Statistiken, Validierung
// Geschäftsregeln:
// - Keine Absenzen für ausgefallene Lektionen
// - Lehrer (Klassenlehrer) darf nur Anwesend/Abwesend erfassen
// - Leiter entschuldigt Absenzen (ENTSCHULDIGT)
// - Upsert: bestehende Absenz wird aktualisiert

import { AbsenceStatus, Role } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import type { File } from 'multer';
import { prisma } from '../../config/database';
import { getMedicalCertificateDir } from '../../config/upload';
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

function validateTestExcuse(absence: {
  lesson: { isTest: boolean };
  hasMedicalCertificate: boolean | null;
  medicalCertificatePath: string | null;
}, targetStatus: AbsenceStatus): void {
  if (!absence.lesson.isTest || targetStatus !== AbsenceStatus.ENTSCHULDIGT) return;

  if (absence.hasMedicalCertificate === null) {
    throw new ApiError(
      'Bei Test-Tagen muss zuerst erfasst werden, ob ein Arztzeugnis vorliegt.',
      'MEDICAL_CERTIFICATE_REQUIRED',
      400
    );
  }

  if (absence.hasMedicalCertificate && !absence.medicalCertificatePath) {
    throw new ApiError(
      'Bei vorhandenem Arztzeugnis muss der Scan hochgeladen werden.',
      'MEDICAL_CERTIFICATE_FILE_REQUIRED',
      400
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
  _userId: string,
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

  validateTestExcuse(absence, status);

  return prisma.absence.update({
    where: { id },
    data: { status, note: note ?? null },
  });
}

export async function recordMedicalCertificate(
  absenceId: string,
  hasMedicalCertificate: boolean,
  file: File | undefined,
  role: Role
) {
  if (role !== Role.ABTEILUNGSLEITUNG) {
    throw new ApiError('Nur der Leiter kann Arztzeugnisse erfassen.', 'FORBIDDEN', 403);
  }

  const absence = await prisma.absence.findUnique({
    where: { id: absenceId },
    include: { lesson: true },
  });

  if (!absence) throw new ApiError('Absenz nicht gefunden.', 'ABSENCE_NOT_FOUND', 404);
  if (!absence.lesson.isTest) {
    throw new ApiError('Arztzeugnis wird nur bei Test-Lektionen erfasst.', 'NOT_A_TEST', 400);
  }

  if (hasMedicalCertificate && !file && !absence.medicalCertificatePath) {
    throw new ApiError(
      'Bitte den Scan des Arztzeugnisses hochladen.',
      'MEDICAL_CERTIFICATE_FILE_REQUIRED',
      400
    );
  }

  if (!hasMedicalCertificate && absence.medicalCertificatePath) {
    const oldPath = path.join(getMedicalCertificateDir(), absence.medicalCertificatePath);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  return prisma.absence.update({
    where: { id: absenceId },
    data: {
      hasMedicalCertificate,
      ...(hasMedicalCertificate && file
        ? {
            medicalCertificatePath: file.filename,
            medicalCertificateFileName: file.originalname,
            medicalCertificateUploadedAt: new Date(),
          }
        : {}),
      ...(!hasMedicalCertificate
        ? {
            medicalCertificatePath: null,
            medicalCertificateFileName: null,
            medicalCertificateUploadedAt: null,
          }
        : {}),
    },
  });
}

export async function getMedicalCertificateFile(absenceId: string, role: Role) {
  if (role !== Role.ABTEILUNGSLEITUNG) {
    throw new ApiError('Keine Berechtigung.', 'FORBIDDEN', 403);
  }

  const absence = await prisma.absence.findUnique({ where: { id: absenceId } });
  if (!absence?.medicalCertificatePath) {
    throw new ApiError('Kein Arztzeugnis hinterlegt.', 'FILE_NOT_FOUND', 404);
  }

  const filePath = path.join(getMedicalCertificateDir(), absence.medicalCertificatePath);
  if (!fs.existsSync(filePath)) {
    throw new ApiError('Datei nicht gefunden.', 'FILE_NOT_FOUND', 404);
  }

  return {
    filePath,
    fileName: absence.medicalCertificateFileName ?? absence.medicalCertificatePath,
  };
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
          isTest: true,
          subject: { select: { name: true } },
        },
      },
      recordedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [
      { student: { class: { name: 'asc' } } },
      { student: { lastName: 'asc' } },
      { student: { firstName: 'asc' } },
      { lesson: { date: 'desc' } },
    ],
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
