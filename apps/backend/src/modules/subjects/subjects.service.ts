// Fächer-/Module-Service: CRUD
// Module sind schulweit. Mehrere Lehrpersonen können ein Modul unterrichten.

import { Role } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler.middleware';

const COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const PALETTE = [
  '#2563EB',
  '#0EA5E9',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#D97706',
  '#64748B',
];

const teacherSelect = { id: true, firstName: true, lastName: true } as const;
const subjectInclude = {
  teachers: { include: { teacher: { select: teacherSelect } } },
  _count: { select: { lessons: true, grades: true, gradeCategories: true } },
} as const;

function flattenSubject<T extends { teachers: Array<{ teacher: { id: string; firstName: string; lastName: string } }> }>(
  subject: T
) {
  const { teachers, ...rest } = subject;
  return { ...rest, teachers: teachers.map((t) => t.teacher) };
}

interface CreateSubjectInput {
  name: string;
  color?: string;
  teacherIds: string[];
}

interface UpdateSubjectInput {
  name?: string;
  color?: string;
  teacherIds?: string[];
  isActive?: boolean;
}

function assertColor(color: string | undefined): string | undefined {
  if (color === undefined) return undefined;
  if (!COLOR_RE.test(color)) {
    throw new ApiError('Farbe muss ein Hex-Wert sein (z. B. #C8102E).', 'INVALID_COLOR', 400);
  }
  return color.toUpperCase();
}

async function assertTeachers(teacherIds: string[]): Promise<void> {
  const unique = [...new Set(teacherIds)];
  if (unique.length === 0) {
    throw new ApiError('Mindestens eine Lehrperson zuweisen.', 'TEACHERS_REQUIRED', 400);
  }
  const teachers = await prisma.user.findMany({
    where: { id: { in: unique }, role: Role.LEHRPERSON, isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (teachers.length !== unique.length) {
    throw new ApiError('Eine oder mehrere Lehrpersonen sind ungültig oder inaktiv.', 'TEACHER_NOT_FOUND', 404);
  }
}

export async function listSubjects(params: {
  teacherId?: string;
  isActive?: boolean;
  requestingUserId: string;
  requestingUserRole: Role;
}) {
  const { teacherId, isActive, requestingUserId, requestingUserRole } = params;

  const where = {
    ...(isActive !== undefined ? { isActive } : {}),
    ...(teacherId ? { teachers: { some: { teacherId } } } : {}),
    ...(requestingUserRole === Role.LEHRPERSON
      ? { teachers: { some: { teacherId: requestingUserId } } }
      : {}),
  };

  const rows = await prisma.subject.findMany({
    where,
    include: subjectInclude,
    orderBy: [{ name: 'asc' }],
  });
  return rows.map(flattenSubject);
}

export async function createSubject(input: CreateSubjectInput) {
  await assertTeachers(input.teacherIds);
  const name = input.name.trim();
  const existing = await prisma.subject.findUnique({ where: { name } });
  if (existing) {
    throw new ApiError('Ein Modul mit diesem Namen existiert bereits.', 'SUBJECT_EXISTS', 409);
  }

  const count = await prisma.subject.count();
  const color = assertColor(input.color) ?? PALETTE[count % PALETTE.length]!;

  const created = await prisma.subject.create({
    data: {
      name,
      color,
      teachers: { create: [...new Set(input.teacherIds)].map((teacherId) => ({ teacherId })) },
      gradeCategories: {
        create: [
          { name: 'Prüfung', weight: 0.6 },
          { name: 'Mündlich', weight: 0.4 },
        ],
      },
    },
    include: {
      teachers: { include: { teacher: { select: teacherSelect } } },
    },
  });
  return flattenSubject(created);
}

export async function updateSubject(id: string, input: UpdateSubjectInput) {
  const existing = await prisma.subject.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new ApiError('Fach nicht gefunden.', 'SUBJECT_NOT_FOUND', 404);

  if (input.teacherIds) await assertTeachers(input.teacherIds);
  if (input.name) {
    const clash = await prisma.subject.findFirst({
      where: { name: input.name.trim(), NOT: { id } },
      select: { id: true },
    });
    if (clash) throw new ApiError('Ein Modul mit diesem Namen existiert bereits.', 'SUBJECT_EXISTS', 409);
  }

  const color = assertColor(input.color);

  const updated = await prisma.$transaction(async (tx) => {
    if (input.teacherIds) {
      await tx.subjectTeacher.deleteMany({ where: { subjectId: id } });
      await tx.subjectTeacher.createMany({
        data: [...new Set(input.teacherIds)].map((teacherId) => ({ subjectId: id, teacherId })),
      });
    }
    return tx.subject.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(color !== undefined ? { color } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: {
        teachers: { include: { teacher: { select: teacherSelect } } },
      },
    });
  });

  return flattenSubject(updated);
}

export async function deactivateSubject(id: string) {
  const existing = await prisma.subject.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new ApiError('Fach nicht gefunden.', 'SUBJECT_NOT_FOUND', 404);
  return prisma.subject.update({
    where: { id },
    data: { isActive: false },
    select: { id: true, isActive: true },
  });
}

export async function activateSubject(id: string) {
  const existing = await prisma.subject.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new ApiError('Fach nicht gefunden.', 'SUBJECT_NOT_FOUND', 404);
  return prisma.subject.update({
    where: { id },
    data: { isActive: true },
    select: { id: true, isActive: true },
  });
}
