// Klassen-Service: CRUD + Klassenlehrer-Zuweisung

import { Role } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler.middleware';
import { getHomeroomClassIds } from '../../utils/teacherAccess';

interface CreateClassInput {
  name: string;
  semester: number;
  schoolYear: string;
  homeroomTeacherId?: string | null;
}

interface UpdateClassInput extends Partial<CreateClassInput> {}

export async function listClasses(params: {
  page: number;
  limit: number;
  schoolYear?: string;
  semester?: number;
  isActive?: boolean;
  requestingUserId?: string;
  requestingUserRole?: Role;
}) {
  const { page, limit, schoolYear, semester, isActive, requestingUserId, requestingUserRole } = params;
  const skip = (page - 1) * limit;

  if (requestingUserRole === Role.LEHRPERSON && requestingUserId) {
    const classIds = await getHomeroomClassIds(requestingUserId);
    if (classIds.length === 0) {
      return { classes: [], total: 0, page, limit, totalPages: 0 };
    }
    // Lehrer sieht nur seine zugewiesene(n) Klasse(n)
    const whereTeacher = {
      id: { in: classIds },
      ...(schoolYear && { schoolYear }),
      ...(semester !== undefined && { semester }),
      ...(isActive !== undefined ? { isActive } : { isActive: true }),
    };
    const [classes, total] = await Promise.all([
      prisma.class.findMany({
        where: whereTeacher,
        skip,
        take: limit,
        include: {
          homeroomTeacher: { select: { id: true, firstName: true, lastName: true, email: true } },
          _count: { select: { students: true, subjects: true } },
        },
        orderBy: [{ schoolYear: 'desc' }, { name: 'asc' }],
      }),
      prisma.class.count({ where: whereTeacher }),
    ]);
    return { classes, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  const where = {
    ...(schoolYear && { schoolYear }),
    ...(semester !== undefined && { semester }),
    ...(isActive !== undefined ? { isActive } : { isActive: true }),
  };

  const [classes, total] = await Promise.all([
    prisma.class.findMany({
      where, skip, take: limit,
      include: {
        homeroomTeacher: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { students: true, subjects: true } },
      },
      orderBy: [{ schoolYear: 'desc' }, { name: 'asc' }],
    }),
    prisma.class.count({ where }),
  ]);

  return { classes, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getClassById(id: string) {
  const cls = await prisma.class.findUnique({
    where: { id },
    include: {
      homeroomTeacher: { select: { id: true, firstName: true, lastName: true, email: true } },
      _count: { select: { students: true, subjects: true } },
    },
  });
  if (!cls) throw new ApiError('Klasse nicht gefunden.', 'CLASS_NOT_FOUND', 404);
  return cls;
}

async function validateHomeroomTeacher(teacherId: string | null | undefined): Promise<void> {
  if (!teacherId) return;
  const teacher = await prisma.user.findFirst({
    where: { id: teacherId, role: Role.LEHRPERSON, isActive: true, deletedAt: null },
  });
  if (!teacher) {
    throw new ApiError('Ungültiger Klassenlehrer.', 'INVALID_HOMEROOM_TEACHER', 400);
  }
}

export async function createClass(input: CreateClassInput) {
  const existing = await prisma.class.findUnique({
    where: { name_semester_schoolYear: { name: input.name, semester: input.semester, schoolYear: input.schoolYear } },
  });
  if (existing) throw new ApiError('Klasse existiert bereits.', 'CLASS_ALREADY_EXISTS', 409);
  await validateHomeroomTeacher(input.homeroomTeacherId);
  return prisma.class.create({
    data: {
      name: input.name,
      semester: input.semester,
      schoolYear: input.schoolYear,
      homeroomTeacherId: input.homeroomTeacherId ?? null,
    },
    include: {
      homeroomTeacher: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
}

export async function updateClass(id: string, input: UpdateClassInput) {
  await getClassById(id);
  if (input.homeroomTeacherId !== undefined) {
    await validateHomeroomTeacher(input.homeroomTeacherId);
  }
  return prisma.class.update({
    where: { id },
    data: input,
    include: {
      homeroomTeacher: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
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
