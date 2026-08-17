// Klassen-Service: CRUD

import { Role } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler.middleware';
import { assertClassAccessible } from '../../utils/access';

interface CreateClassInput {
  name: string;
  semester: number;
  schoolYear: string;
}

export async function listClasses(params: {
  page: number;
  limit: number;
  schoolYear?: string;
  semester?: number;
  isActive?: boolean;
}) {
  const { page, limit, schoolYear, semester, isActive } = params;
  const skip = (page - 1) * limit;

  const where = {
    ...(schoolYear && { schoolYear }),
    ...(semester !== undefined && { semester }),
    ...(isActive !== undefined ? { isActive } : { isActive: true }),
  };

  const [classes, total] = await Promise.all([
    prisma.class.findMany({
      where, skip, take: limit,
      include: { _count: { select: { students: true, subjects: true } } },
      orderBy: [{ schoolYear: 'desc' }, { name: 'asc' }],
    }),
    prisma.class.count({ where }),
  ]);

  return { classes, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getClassById(id: string, requestingUserId: string, requestingUserRole: Role) {
  await assertClassAccessible(id, requestingUserId, requestingUserRole);
  const cls = await prisma.class.findUnique({
    where: { id },
    include: { _count: { select: { students: true, subjects: true } } },
  });
  if (!cls) throw new ApiError('Klasse nicht gefunden.', 'CLASS_NOT_FOUND', 404);
  return cls;
}

export async function createClass(input: CreateClassInput) {
  const existing = await prisma.class.findUnique({
    where: { name_semester_schoolYear: { name: input.name, semester: input.semester, schoolYear: input.schoolYear } },
  });
  if (existing) throw new ApiError('Klasse existiert bereits.', 'CLASS_ALREADY_EXISTS', 409);
  // Nur bekannte Felder an Prisma übergeben (kein Mass-Assignment)
  return prisma.class.create({
    data: { name: input.name, semester: input.semester, schoolYear: input.schoolYear },
  });
}

export async function updateClass(id: string, input: Partial<CreateClassInput>) {
  const existing = await prisma.class.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new ApiError('Klasse nicht gefunden.', 'CLASS_NOT_FOUND', 404);
  // Nur explizit erlaubte Felder aktualisieren
  const data: Partial<CreateClassInput> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.semester !== undefined) data.semester = input.semester;
  if (input.schoolYear !== undefined) data.schoolYear = input.schoolYear;
  return prisma.class.update({ where: { id }, data });
}

export async function getClassStudents(classId: string, requestingUserId: string, requestingUserRole: Role) {
  await assertClassAccessible(classId, requestingUserId, requestingUserRole);
  return prisma.student.findMany({
    where: { classId, isActive: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });
}

export async function getClassSubjects(classId: string, requestingUserId: string, requestingUserRole: Role) {
  await assertClassAccessible(classId, requestingUserId, requestingUserRole);
  return prisma.subject.findMany({
    where: { classId, isActive: true },
    include: { teacher: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function getClassTimetable(
  classId: string,
  requestingUserId: string,
  requestingUserRole: Role,
  dateFrom?: string,
  dateTo?: string
) {
  await assertClassAccessible(classId, requestingUserId, requestingUserRole);
  return prisma.lesson.findMany({
    where: {
      subject: { classId },
      ...(dateFrom && { date: { gte: new Date(dateFrom) } }),
      ...(dateTo && { date: { lte: new Date(dateTo) } }),
    },
    include: {
      subject: { include: { teacher: { select: { id: true, firstName: true, lastName: true } } } },
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
}
