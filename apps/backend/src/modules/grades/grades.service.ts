// Noten-Service
// Geschäftsregeln:
// - Nach Eintragung: isLocked=true (kein Überschreiben)
// - Korrektur nur durch Abteilungsleitung mit Pflichtbegründung
// - Gewichteter Durchschnitt nach Schweizer 0.5er-Skala
// - Promotionsprüfung: minAverage + maxFailing

import { Role } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler.middleware';
import { GRADE_LIMITS } from '../../config/constants';
import { assertStudentAccessible, assertSubjectAccessible } from '../../utils/access';

interface CreateGradeInput {
  studentId: string;
  subjectId: string;
  categoryId: string;
  value: number;
  description?: string | null;
  date: string;
}

export async function listGrades(params: {
  subjectId?: string;
  studentId?: string;
  classId?: string;
  categoryId?: string;
  requestingUserId: string;
  requestingUserRole: Role;
}) {
  const { subjectId, studentId, classId, categoryId, requestingUserId, requestingUserRole } = params;

  // Lehrperson: nur eigene Fächer
  let allowedSubjectIds: string[] | undefined;
  if (requestingUserRole === Role.LEHRPERSON) {
    const subjects = await prisma.subject.findMany({
      where: { teacherId: requestingUserId },
      select: { id: true },
    });
    allowedSubjectIds = subjects.map((s) => s.id);
  }

  // Fach-Filter: expliziter subjectId-Wunsch mit der Lehrpersonen-Beschränkung
  // verschneiden (Spread-Kollision würde sonst einen Filter überschreiben).
  let subjectIdWhere: string | { in: string[] } | undefined;
  if (allowedSubjectIds) {
    subjectIdWhere = subjectId
      ? (allowedSubjectIds.includes(subjectId) ? subjectId : { in: [] as string[] })
      : { in: allowedSubjectIds };
  } else if (subjectId) {
    subjectIdWhere = subjectId;
  }

  const where = {
    ...(subjectIdWhere !== undefined && { subjectId: subjectIdWhere }),
    ...(studentId && { studentId }),
    ...(categoryId && { categoryId }),
    ...(classId && { subject: { classId } }),
  };

  return prisma.grade.findMany({
    where,
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      subject: { select: { id: true, name: true } },
      category: { select: { id: true, name: true, weight: true } },
      corrections: {
        orderBy: { correctedAt: 'desc' },
        include: { correctedBy: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
    orderBy: { date: 'desc' },
  });
}

export async function createGrade(input: CreateGradeInput, createdById: string, role: Role) {
  // Lehrperson: nur eigene Fächer
  const subject = await prisma.subject.findUnique({
    where: { id: input.subjectId },
  });
  if (!subject) throw new ApiError('Fach nicht gefunden.', 'SUBJECT_NOT_FOUND', 404);

  if (role === Role.LEHRPERSON && subject.teacherId !== createdById) {
    throw new ApiError(
      'Keine Berechtigung: Noten können nur im eigenen Fach eingetragen werden.',
      'FORBIDDEN',
      403
    );
  }

  // Datenintegrität: Kategorie muss zum Fach gehören
  const category = await prisma.gradeCategory.findUnique({
    where: { id: input.categoryId },
    select: { subjectId: true },
  });
  if (!category || category.subjectId !== input.subjectId) {
    throw new ApiError('Notenkategorie gehört nicht zu diesem Fach.', 'CATEGORY_MISMATCH', 400);
  }

  // Datenintegrität: Schüler muss zur Klasse des Fachs gehören
  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    select: { classId: true },
  });
  if (!student) throw new ApiError('Schüler nicht gefunden.', 'STUDENT_NOT_FOUND', 404);
  if (student.classId !== subject.classId) {
    throw new ApiError('Schüler gehört nicht zur Klasse dieses Fachs.', 'STUDENT_NOT_IN_CLASS', 400);
  }

  // Note erstellen und sofort sperren
  return prisma.grade.create({
    data: {
      studentId: input.studentId,
      subjectId: input.subjectId,
      categoryId: input.categoryId,
      value: input.value,
      description: input.description ?? null,
      date: new Date(input.date),
      isLocked: true,
      lockedAt: new Date(),
      createdById,
    },
    include: {
      student: { select: { firstName: true, lastName: true } },
      category: { select: { name: true, weight: true } },
    },
  });
}

export async function correctGrade(
  gradeId: string,
  newValue: number,
  reason: string,
  correctedById: string
) {
  const grade = await prisma.grade.findUnique({ where: { id: gradeId } });
  if (!grade) throw new ApiError('Note nicht gefunden.', 'GRADE_NOT_FOUND', 404);

  // Korrektur erstellen und Note aktualisieren (Transaktion)
  const [correction] = await prisma.$transaction([
    prisma.gradeCorrection.create({
      data: {
        gradeId,
        oldValue: grade.value,
        newValue,
        reason,
        correctedById,
      },
    }),
    prisma.grade.update({
      where: { id: gradeId },
      data: { value: newValue },
    }),
  ]);

  return correction;
}

export async function getGradeCorrections(gradeId: string) {
  return prisma.gradeCorrection.findMany({
    where: { gradeId },
    include: { correctedBy: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { correctedAt: 'desc' },
  });
}

// --------------------------------------------------------
// GEWICHTETER DURCHSCHNITT (Schweizer 0.5er-Skala)
// --------------------------------------------------------
export async function calculateWeightedAverage(
  studentId: string,
  subjectId: string
): Promise<number | null> {
  const grades = await prisma.grade.findMany({
    where: { studentId, subjectId },
    include: { category: { select: { weight: true } } },
  });

  if (grades.length === 0) return null;

  // Nach Kategorie gruppieren
  const categoryMap = new Map<string, { values: number[]; weight: number }>();

  for (const grade of grades) {
    const key = grade.categoryId;
    if (!categoryMap.has(key)) {
      categoryMap.set(key, { values: [], weight: grade.category.weight });
    }
    categoryMap.get(key)!.values.push(grade.value);
  }

  // Kategorie-Durchschnitte berechnen
  let weightedSum = 0;
  let totalWeight = 0;

  for (const { values, weight } of categoryMap.values()) {
    const categoryAvg = values.reduce((a, b) => a + b, 0) / values.length;
    weightedSum += categoryAvg * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return null;

  // Auf 0.5er-Schritte runden (Schweizer Konvention)
  const raw = weightedSum / totalWeight;
  return Math.round(raw * 2) / 2;
}

// Gescopeter Zugriff auf den Fachdurchschnitt eines Schülers.
// Lehrperson: nur eigene Fächer und Schüler der eigenen Klassen.
export async function getStudentSubjectAverage(
  studentId: string,
  subjectId: string,
  requestingUserId: string,
  requestingUserRole: Role
): Promise<number | null> {
  await assertSubjectAccessible(subjectId, requestingUserId, requestingUserRole);
  await assertStudentAccessible(studentId, requestingUserId, requestingUserRole);
  return calculateWeightedAverage(studentId, subjectId);
}

// --------------------------------------------------------
// PROMOTIONSPRÜFUNG
// --------------------------------------------------------
export async function checkPromotion(classId: string, schoolYear: string) {
  const rule = await prisma.promotionRule.findUnique({
    where: { classId_schoolYear: { classId, schoolYear } },
  });

  if (!rule) {
    return {
      status: 'KEINE_REGEL' as const,
      details: 'Keine Promotionsregel für diese Klasse/Schuljahr definiert.',
    };
  }

  const students = await prisma.student.findMany({
    where: { classId, isActive: true },
  });

  const subjects = await prisma.subject.findMany({ where: { classId } });

  const results = await Promise.all(
    students.map(async (student) => {
      const averages = await Promise.all(
        subjects.map((s) => calculateWeightedAverage(student.id, s.id))
      );

      const validAverages = averages.filter((a): a is number => a !== null);
      const missingSubjects = averages.length - validAverages.length;

      if (validAverages.length === 0) {
        return {
          student: { id: student.id, firstName: student.firstName, lastName: student.lastName },
          status: 'KEINE_NOTEN' as const,
          overallAverage: null,
          failingSubjects: 0,
          missingSubjects,
        };
      }

      const overallAverage =
        Math.round((validAverages.reduce((a, b) => a + b, 0) / validAverages.length) * 100) / 100;
      const failingSubjects = validAverages.filter((a) => a < GRADE_LIMITS.PASS_THRESHOLD).length;

      // Bei fehlenden Fachnoten keine (womöglich falsch-positive) Promotionsentscheidung treffen
      if (missingSubjects > 0) {
        return {
          student: { id: student.id, firstName: student.firstName, lastName: student.lastName },
          status: 'UNVOLLSTAENDIG' as const,
          overallAverage,
          failingSubjects,
          missingSubjects,
        };
      }

      const passed = overallAverage >= rule.minAverage && failingSubjects <= rule.maxFailing;

      return {
        student: { id: student.id, firstName: student.firstName, lastName: student.lastName },
        status: passed ? ('BESTANDEN' as const) : ('NICHT_BESTANDEN' as const),
        overallAverage,
        failingSubjects,
        missingSubjects,
      };
    })
  );

  return {
    status: 'OK' as const,
    rule: { minAverage: rule.minAverage, maxFailing: rule.maxFailing },
    results,
  };
}

// --------------------------------------------------------
// NOTENKATEGORIEN
// --------------------------------------------------------
export async function getGradeCategories(subjectId: string) {
  return prisma.gradeCategory.findMany({ where: { subjectId } });
}

export async function createGradeCategory(
  subjectId: string,
  name: string,
  weight: number
) {
  // Summe aller Gewichtungen prüfen (darf 1.0 nicht überschreiten)
  const existing = await prisma.gradeCategory.findMany({ where: { subjectId } });
  const currentTotal = existing.reduce((sum, c) => sum + c.weight, 0);

  if (currentTotal + weight > 1.0 + 0.001) {
    throw new ApiError(
      `Gewichtungs-Summe überschreitet 1.0 (aktuell: ${currentTotal.toFixed(2)}, neu: ${weight}).`,
      'WEIGHT_EXCEEDS_LIMIT',
      400
    );
  }

  return prisma.gradeCategory.create({ data: { subjectId, name, weight } });
}
