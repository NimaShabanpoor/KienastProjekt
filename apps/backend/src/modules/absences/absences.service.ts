// Absenzen-Service: Batch-Erfassung, Statistiken, Validierung
// Geschäftsregeln:
// - Keine Absenzen für ausgefallene Lektionen
// - Lehrer (Klassenlehrer) darf nur Anwesend/Abwesend erfassen
// - Leiter entschuldigt Absenzen (ENTSCHULDIGT)
// - Upsert: bestehende Absenz wird aktualisiert

import { AbsenceStatus, Role } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../config/database';
import { getMedicalCertificateDir } from '../../config/upload';
import { ApiError } from '../../middleware/errorHandler.middleware';
import { logger } from '../../config/logger';
import { assertTeacherHasClassAccess } from '../../utils/teacherAccess';
import { getTeacherClassIds } from '../../utils/access';

interface AbsenceEntry {
  studentId: string;
  status: AbsenceStatus;
  note?: string | null;
  /** Wie viele der ausgewählten Lektionen der Schüler abwesend war (ältere Clients) */
  absentLessonCount?: number;
  /** Wie viele der ausgewählten Lektionen der Schüler anwesend war (bevorzugt) */
  presentLessonCount?: number;
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
  lessonIdsInput: string | string[],
  absences: AbsenceEntry[],
  recordedById: string,
  role: Role
) {
  const lessonIds = Array.isArray(lessonIdsInput) ? [...new Set(lessonIdsInput)] : [lessonIdsInput];
  if (lessonIds.length === 0) {
    throw new ApiError('Mindestens eine Lektion erforderlich.', 'MISSING_LESSONS', 400);
  }

  // Alle Lektionen validieren und chronologisch sortieren
  const lessons = await prisma.lesson.findMany({
    where: { id: { in: lessonIds } },
    include: { subject: { select: { classId: true } } },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });

  if (lessons.length !== lessonIds.length) {
    throw new ApiError('Eine oder mehrere Lektionen wurden nicht gefunden.', 'LESSON_NOT_FOUND', 404);
  }

  const classIds = new Set(lessons.map((l) => l.subject.classId));
  if (classIds.size > 1) {
    throw new ApiError(
      'Alle Lektionen müssen zur selben Klasse gehören.',
      'MIXED_CLASSES',
      400
    );
  }

  // Nur Schüler der Klasse dieser Lektionen dürfen erfasst werden (keine fremden studentIds)
  const batchClassId = lessons[0]!.subject.classId;
  const studentIds = [...new Set(absences.map((a) => a.studentId))];
  const validStudents = await prisma.student.findMany({
    where: { id: { in: studentIds }, classId: batchClassId },
    select: { id: true },
  });
  if (validStudents.length !== studentIds.length) {
    throw new ApiError(
      'Mindestens ein Schüler gehört nicht zur Klasse dieser Lektion.',
      'STUDENT_NOT_IN_CLASS',
      400
    );
  }

  for (const lesson of lessons) {
    await validateAbsenceCreation(lesson.id, recordedById, role);
  }

  const entries =
    role === Role.LEHRPERSON
      ? absences.map(sanitizeTeacherAbsenceEntry)
      : absences;

  const sortedLessonIds = lessons.map((l) => l.id);
  const ops = [];

  for (const entry of entries) {
    const total = sortedLessonIds.length;
    let presentCount: number;

    if (typeof entry.presentLessonCount === 'number') {
      presentCount = Math.min(Math.max(entry.presentLessonCount, 0), total);
    } else if (entry.status === AbsenceStatus.ANWESEND) {
      presentCount = total;
    } else {
      const absentCount = Math.min(entry.absentLessonCount ?? total, total);
      presentCount = total - absentCount;
    }

    for (let i = 0; i < total; i++) {
      const lessonId = sortedLessonIds[i]!;
      // Erste presentCount Lektionen = anwesend, Rest = unentschuldigt abwesend
      const statusForLesson =
        i < presentCount ? AbsenceStatus.ANWESEND : AbsenceStatus.UNENTSCHULDIGT;

      ops.push(
        prisma.absence.upsert({
          where: { studentId_lessonId: { studentId: entry.studentId, lessonId } },
          create: {
            studentId: entry.studentId,
            lessonId,
            status: statusForLesson,
            note: entry.note ?? null,
            recordedById,
          },
          update: {
            status: statusForLesson,
            note: entry.note ?? null,
            recordedById,
          },
          include: { student: { select: { firstName: true, lastName: true } } },
        })
      );
    }
  }

  const results = await prisma.$transaction(ops);

  logger.info('Absenzen erfasst', {
    lessonIds: sortedLessonIds,
    count: results.length,
    recordedById,
  });
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
  file: Express.Multer.File | undefined,
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

// Absenzen auflisten – für eine Lehrperson auf ihre zugänglichen Klassen begrenzt
export async function listAbsences(params: {
  lessonId?: string;
  studentId?: string;
  status?: AbsenceStatus;
  classId?: string;
  requestingUserId: string;
  requestingUserRole: Role;
}) {
  const { lessonId, studentId, status, classId, requestingUserId, requestingUserRole } = params;

  // Lehrperson: nur Absenzen aus den eigenen (unterrichteten/zugewiesenen) Klassen.
  // Expliziter classId-Filter wird mit der Beschränkung verschnitten (keine Spread-Kollision).
  let studentClassFilter: { classId: string | { in: string[] } } | undefined;
  if (requestingUserRole === Role.LEHRPERSON) {
    const allowedClassIds = await getTeacherClassIds(requestingUserId);
    studentClassFilter = {
      classId: classId
        ? (allowedClassIds.includes(classId) ? classId : { in: [] as string[] })
        : { in: allowedClassIds },
    };
  } else if (classId) {
    studentClassFilter = { classId };
  }

  return prisma.absence.findMany({
    where: {
      ...(lessonId && { lessonId }),
      ...(studentId && { studentId }),
      ...(status && { status }),
      ...(studentClassFilter && { student: studentClassFilter }),
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
  requestingUserId: string;
  requestingUserRole: Role;
}) {
  const { classId, studentId, dateFrom, dateTo, requestingUserId, requestingUserRole } = params;

  const where = {
    ...(studentId && { studentId }),
    ...(classId && { student: { classId } }),
    // Lehrperson: nur Absenzen aus eigenen Lektionen
    ...(requestingUserRole === Role.LEHRPERSON
      ? { lesson: { subject: { teacherId: requestingUserId } } }
      : {}),
    ...(dateFrom || dateTo ? {
      lesson: {
        ...(requestingUserRole === Role.LEHRPERSON
          ? { subject: { teacherId: requestingUserId } }
          : {}),
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
