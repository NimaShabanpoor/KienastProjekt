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

  const where =
    requestingUserRole === Role.LEHRPERSON
      ? {
          ...(studentId && { studentId }),
          ...(categoryId && { categoryId }),
          subject: {
            teacherId: requestingUserId,
            ...(subjectId && { id: subjectId }),
            ...(classId && { classId }),
          },
        }
      : {
          ...(subjectId && { subjectId }),
          ...(studentId && { studentId }),
          ...(categoryId && { categoryId }),
          ...(classId && { subject: { classId } }),
        };

  return prisma.grade.findMany({
    where,
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      subject: { select: { id: true, name: true, classId: true, teacherId: true } },
      category: { select: { id: true, name: true, weight: true } },
      corrections: {
        orderBy: { correctedAt: 'desc' },
        include: { correctedBy: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
    orderBy: [{ date: 'desc' }, { student: { lastName: 'asc' } }],
  });
}

async function assertCanCreateGrade(
  subjectId: string,
  userId: string,
  role: Role
): Promise<{ classId: string }> {
  if (role === Role.ABTEILUNGSLEITUNG) {
    throw new ApiError(
      'Der Leiter trägt keine Noten ein – nur Korrekturen. Noten vergibt der Fachlehrer.',
      'FORBIDDEN',
      403
    );
  }

  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: { id: true, teacherId: true, classId: true, isActive: true },
  });
  if (!subject || !subject.isActive) {
    throw new ApiError('Fach nicht gefunden.', 'SUBJECT_NOT_FOUND', 404);
  }
  if (subject.teacherId !== userId) {
    throw new ApiError(
      'Du kannst nur Noten für deine eigenen Fächer eintragen.',
      'FORBIDDEN',
      403
    );
  }
  return { classId: subject.classId };
}

export async function createGrade(input: CreateGradeInput, createdById: string, role: Role) {
  await assertCanCreateGrade(input.subjectId, createdById, role);

  if (!input.description?.trim()) {
    throw new ApiError('Testtitel ist erforderlich (z.B. „Test 1“).', 'TITLE_REQUIRED', 400);
  }

  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    select: { classId: true, isActive: true },
  });
  if (!student?.isActive) {
    throw new ApiError('Schüler nicht gefunden.', 'STUDENT_NOT_FOUND', 404);
  }

  const subject = await prisma.subject.findUnique({
    where: { id: input.subjectId },
    select: { classId: true },
  });
  if (student.classId !== subject?.classId) {
    throw new ApiError('Schüler gehört nicht zu diesem Fach/Klasse.', 'STUDENT_CLASS_MISMATCH', 400);
  }

  return prisma.grade.create({
    data: {
      studentId: input.studentId,
      subjectId: input.subjectId,
      categoryId: input.categoryId,
      value: input.value,
      description: input.description.trim(),
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

export async function createGradeBatch(
  input: {
    subjectId: string;
    categoryId: string;
    title: string;
    date: string;
    entries: Array<{ studentId: string; value: number }>;
  },
  createdById: string,
  role: Role
) {
  const { classId } = await assertCanCreateGrade(input.subjectId, createdById, role);

  const title = input.title.trim();
  if (!title) {
    throw new ApiError('Testtitel ist erforderlich (z.B. „Test 1“).', 'TITLE_REQUIRED', 400);
  }

  const category = await prisma.gradeCategory.findFirst({
    where: { id: input.categoryId, subjectId: input.subjectId },
  });
  if (!category) {
    throw new ApiError('Kategorie gehört nicht zu diesem Fach.', 'CATEGORY_NOT_FOUND', 404);
  }

  const students = await prisma.student.findMany({
    where: {
      id: { in: input.entries.map((e) => e.studentId) },
      classId,
      isActive: true,
    },
    select: { id: true },
  });
  if (students.length !== input.entries.length) {
    throw new ApiError(
      'Ein oder mehrere Schüler gehören nicht zu dieser Klasse.',
      'STUDENT_CLASS_MISMATCH',
      400
    );
  }

  const created = await prisma.$transaction(
    input.entries.map((entry) =>
      prisma.grade.create({
        data: {
          studentId: entry.studentId,
          subjectId: input.subjectId,
          categoryId: input.categoryId,
          value: entry.value,
          description: title,
          date: new Date(input.date),
          isLocked: true,
          lockedAt: new Date(),
          createdById,
        },
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
          category: { select: { name: true } },
        },
      })
    )
  );

  return created;
}

export async function listTeacherSubjects(teacherId: string) {
  return prisma.subject.findMany({
    where: { teacherId, isActive: true },
    include: {
      class: { select: { id: true, name: true } },
      gradeCategories: { select: { id: true, name: true, weight: true } },
    },
    orderBy: [{ class: { name: 'asc' } }, { name: 'asc' }],
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

      if (validAverages.length === 0) {
        return {
          student: { id: student.id, firstName: student.firstName, lastName: student.lastName },
          status: 'KEINE_NOTEN' as const,
          overallAverage: null,
          failingSubjects: 0,
        };
      }

      const overallAverage =
        Math.round((validAverages.reduce((a, b) => a + b, 0) / validAverages.length) * 100) / 100;
      const failingSubjects = validAverages.filter((a) => a < GRADE_LIMITS.PASS_THRESHOLD).length;
      const passed = overallAverage >= rule.minAverage && failingSubjects <= rule.maxFailing;

      return {
        student: { id: student.id, firstName: student.firstName, lastName: student.lastName },
        status: passed ? ('BESTANDEN' as const) : ('NICHT_BESTANDEN' as const),
        overallAverage,
        failingSubjects,
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
