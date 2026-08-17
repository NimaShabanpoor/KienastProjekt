// Schüler-Service: CRUD mit Soft Delete
// Lehrperson: nur eigene Klassen
// Abteilungsleitung: alle Schüler

import { Role } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler.middleware';
import { PAGINATION } from '../../config/constants';
import { getHomeroomClassIds } from '../../utils/teacherAccess';
import { assertStudentAccessible } from '../../utils/access';

interface CreateStudentInput {
  firstName: string;
  lastName: string;
  email?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  classId: string;
}

interface ListStudentsParams {
  page: number;
  limit: number;
  classId?: string;
  isActive?: boolean;
  search?: string;
  requestingUserId: string;
  requestingUserRole: Role;
}

export async function listStudents(params: ListStudentsParams) {
  const {
    page = PAGINATION.DEFAULT_PAGE,
    limit = PAGINATION.DEFAULT_LIMIT,
    classId,
    isActive,
    search,
    requestingUserId,
    requestingUserRole,
  } = params;

  const skip = (page - 1) * limit;

  // Lehrer: nur Schüler der zugewiesenen Klasse
  let allowedClassIds: string[] | undefined;
  if (requestingUserRole === Role.LEHRPERSON) {
    allowedClassIds = await getHomeroomClassIds(requestingUserId);
    if (allowedClassIds.length === 0) {
      return { students: [], total: 0, page, limit, totalPages: 0 };
    }
  }

  const where = {
    ...(requestingUserRole === Role.LEHRPERSON
      ? { isActive: true }
      : isActive !== undefined
        ? { isActive }
        : {}),
    ...(classId ? { classId } : {}),
    ...(allowedClassIds ? { classId: { in: allowedClassIds } } : {}),
    ...(search ? {
      OR: [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
      ],
    } : {}),
  };

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      skip,
      take: limit,
      include: { class: { select: { id: true, name: true, schoolYear: true } } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    prisma.student.count({ where }),
  ]);

  return { students, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getStudentById(id: string, requestingUserId: string, requestingUserRole: Role) {
  await assertStudentAccessible(id, requestingUserId, requestingUserRole);
  const student = await prisma.student.findUnique({
    where: { id },
    include: { class: { select: { id: true, name: true, schoolYear: true, semester: true } } },
  });
  if (!student) throw new ApiError('Schüler nicht gefunden.', 'STUDENT_NOT_FOUND', 404);
  return student;
}

export async function createStudent(input: CreateStudentInput) {
  if (input.email) {
    const existing = await prisma.student.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ApiError('E-Mail-Adresse bereits vergeben.', 'EMAIL_ALREADY_EXISTS', 409);
    }
  }

  return prisma.student.create({
    data: {
      ...input,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
    },
    include: { class: { select: { id: true, name: true } } },
  });
}

async function assertStudentExists(id: string): Promise<void> {
  const student = await prisma.student.findUnique({ where: { id }, select: { id: true } });
  if (!student) throw new ApiError('Schüler nicht gefunden.', 'STUDENT_NOT_FOUND', 404);
}

export async function updateStudent(id: string, input: Partial<CreateStudentInput>) {
  await assertStudentExists(id);
  return prisma.student.update({
    where: { id },
    data: {
      ...input,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
    },
    include: { class: { select: { id: true, name: true } } },
  });
}

export async function deactivateStudent(id: string) {
  await assertStudentExists(id);
  // Nur inaktiv – kein Soft-Delete
  return prisma.student.update({
    where: { id },
    data: { isActive: false, deletedAt: null },
    select: { id: true, isActive: true },
  });
}

export async function activateStudent(id: string) {
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) throw new ApiError('Schüler nicht gefunden.', 'STUDENT_NOT_FOUND', 404);
  return prisma.student.update({
    where: { id },
    data: { isActive: true, deletedAt: null },
    select: { id: true, isActive: true },
  });
}

export async function getStudentAbsences(
  studentId: string,
  requestingUserId: string,
  requestingUserRole: Role
) {
  await assertStudentAccessible(studentId, requestingUserId, requestingUserRole);
  return prisma.absence.findMany({
    where: { studentId },
    include: {
      lesson: {
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
          isTest: true,
          isCancelled: true,
          room: true,
          subject: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ lesson: { date: 'desc' } }, { lesson: { startTime: 'desc' } }],
  });
}

export async function getStudentGrades(
  studentId: string,
  requestingUserId: string,
  requestingUserRole: Role
) {
  await assertStudentAccessible(studentId, requestingUserId, requestingUserRole);

  // Lehrperson sieht nur Noten der eigenen Fächer; Abteilungsleitung sieht alle.
  let subjectFilter: { subjectId: { in: string[] } } | undefined;
  if (requestingUserRole === Role.LEHRPERSON) {
    const subjects = await prisma.subject.findMany({
      where: { teacherId: requestingUserId, isActive: true },
      select: { id: true },
    });
    subjectFilter = { subjectId: { in: subjects.map((s) => s.id) } };
  }

  return prisma.grade.findMany({
    where: { studentId, ...(subjectFilter ?? {}) },
    include: {
      subject: { select: { id: true, name: true } },
      category: { select: { id: true, name: true, weight: true } },
      corrections: { orderBy: { correctedAt: 'desc' } },
    },
    orderBy: [{ subject: { name: 'asc' } }, { date: 'desc' }],
  });
}
