// Fächer-/Module-Service: CRUD
// Ein Fach/Modul (z. B. "Modul 120") gehört zu genau einer Klasse und einer Lehrperson.
// Lehrperson: sieht nur eigene Fächer. Anlegen/Ändern: nur Abteilungsleitung.

import { Role } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler.middleware';

interface CreateSubjectInput {
  name: string;
  classId: string;
  teacherId: string;
}

interface UpdateSubjectInput {
  name?: string;
  teacherId?: string;
  isActive?: boolean;
}

export async function listSubjects(params: {
  classId?: string;
  teacherId?: string;
  isActive?: boolean;
  requestingUserId: string;
  requestingUserRole: Role;
}) {
  const { classId, teacherId, isActive, requestingUserId, requestingUserRole } = params;

  const where = {
    ...(classId ? { classId } : {}),
    ...(teacherId ? { teacherId } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
    // Lehrperson: nur eigene Fächer/Module
    ...(requestingUserRole === Role.LEHRPERSON ? { teacherId: requestingUserId } : {}),
  };

  return prisma.subject.findMany({
    where,
    include: {
      class: { select: { id: true, name: true, schoolYear: true, semester: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { lessons: true, grades: true, gradeCategories: true } },
    },
    orderBy: [{ name: 'asc' }],
  });
}

async function assertClassAndTeacherExist(classId: string, teacherId: string): Promise<void> {
  const [cls, teacher] = await Promise.all([
    prisma.class.findUnique({ where: { id: classId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: teacherId }, select: { id: true, isActive: true } }),
  ]);
  if (!cls) throw new ApiError('Klasse nicht gefunden.', 'CLASS_NOT_FOUND', 404);
  if (!teacher || !teacher.isActive) {
    throw new ApiError('Lehrperson nicht gefunden oder inaktiv.', 'TEACHER_NOT_FOUND', 404);
  }
}

export async function createSubject(input: CreateSubjectInput) {
  await assertClassAndTeacherExist(input.classId, input.teacherId);

  return prisma.subject.create({
    data: { name: input.name, classId: input.classId, teacherId: input.teacherId },
    include: {
      class: { select: { id: true, name: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function updateSubject(id: string, input: UpdateSubjectInput) {
  const existing = await prisma.subject.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new ApiError('Fach nicht gefunden.', 'SUBJECT_NOT_FOUND', 404);

  if (input.teacherId) {
    const teacher = await prisma.user.findUnique({
      where: { id: input.teacherId },
      select: { id: true, isActive: true },
    });
    if (!teacher || !teacher.isActive) {
      throw new ApiError('Lehrperson nicht gefunden oder inaktiv.', 'TEACHER_NOT_FOUND', 404);
    }
  }

  // Nur explizit erlaubte Felder aktualisieren (kein Mass-Assignment)
  const data: UpdateSubjectInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.teacherId !== undefined) data.teacherId = input.teacherId;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  return prisma.subject.update({
    where: { id },
    data,
    include: {
      class: { select: { id: true, name: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
    },
  });
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
