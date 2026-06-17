// Klassen-Service: CRUD

import { prisma } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler.middleware';

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

export async function getClassById(id: string) {
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
  return prisma.class.create({ data: input });
}

export async function updateClass(id: string, input: Partial<CreateClassInput>) {
  await getClassById(id);
  return prisma.class.update({ where: { id }, data: input });
}

export async function getClassStudents(classId: string) {
  return prisma.student.findMany({
    where: { classId, isActive: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });
}

export async function getClassSubjects(classId: string) {
  return prisma.subject.findMany({
    where: { classId, isActive: true },
    include: { teacher: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function getClassTimetable(classId: string, dateFrom?: string, dateTo?: string) {
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
