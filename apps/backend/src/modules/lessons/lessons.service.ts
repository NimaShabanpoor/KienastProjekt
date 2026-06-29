// Lektionen-Service: CRUD + Konfliktprüfung
// Validiert: Lehrpersonen-Konflikt, Raum-Konflikt, Zeitformat

import { Role } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler.middleware';
import { logger } from '../../config/logger';
import { getHomeroomClassIds } from '../../utils/teacherAccess';

interface CreateLessonInput {
  subjectId: string;
  date: string;
  startTime: string;
  endTime: string;
  room?: string | null;
  isTest?: boolean;
  excludeLessonId?: string;
}

// --------------------------------------------------------
// KONFLIKTPRÜFUNG
// Geschäftsregel: Keine Zeituberschneidungen für Lehrperson/Raum
// --------------------------------------------------------
async function checkLessonConflicts(input: CreateLessonInput): Promise<void> {
  const subject = await prisma.subject.findUnique({
    where: { id: input.subjectId },
    select: { teacherId: true, class: { select: { name: true } } },
  });

  if (!subject) {
    throw new ApiError('Fach nicht gefunden.', 'SUBJECT_NOT_FOUND', 404);
  }

  const lessonDate = new Date(input.date);

  // 1. Lehrpersonen-Konflikt prüfen
  const teacherConflict = await prisma.lesson.findFirst({
    where: {
      isCancelled: false,
      date: lessonDate,
      subject: { teacherId: subject.teacherId },
      ...(input.excludeLessonId && { NOT: { id: input.excludeLessonId } }),
      AND: [
        { startTime: { lt: input.endTime } },
        { endTime: { gt: input.startTime } },
      ],
    },
    include: { subject: { select: { name: true } } },
  });

  if (teacherConflict) {
    throw new ApiError(
      `Lehrperson hat eine Zeituberschneidung mit Lektion "${teacherConflict.subject.name}" (${teacherConflict.startTime}-${teacherConflict.endTime}).`,
      'TEACHER_CONFLICT',
      409
    );
  }

  // 2. Raum-Konflikt prüfen (nur wenn Raum angegeben)
  if (input.room) {
    const roomConflict = await prisma.lesson.findFirst({
      where: {
        isCancelled: false,
        date: lessonDate,
        room: input.room,
        ...(input.excludeLessonId && { NOT: { id: input.excludeLessonId } }),
        AND: [
          { startTime: { lt: input.endTime } },
          { endTime: { gt: input.startTime } },
        ],
      },
      include: { subject: { select: { name: true } } },
    });

    if (roomConflict) {
      throw new ApiError(
        `Raum "${input.room}" ist von ${roomConflict.startTime}-${roomConflict.endTime} bereits durch "${roomConflict.subject.name}" belegt.`,
        'ROOM_CONFLICT',
        409
      );
    }
  }
}

export async function listLessons(params: {
  page: number;
  limit: number;
  subjectId?: string;
  classId?: string;
  dateFrom?: string;
  dateTo?: string;
  isCancelled?: boolean;
  requestingUserId?: string;
  requestingUserRole?: Role;
}) {
  const { page, limit, subjectId, classId, dateFrom, dateTo, isCancelled, requestingUserId, requestingUserRole } = params;
  const skip = (page - 1) * limit;

  let allowedClassIds: string[] | undefined;
  if (requestingUserRole === Role.LEHRPERSON && requestingUserId) {
    allowedClassIds = await getHomeroomClassIds(requestingUserId);
    if (allowedClassIds.length === 0) {
      return { lessons: [], total: 0, page, limit, totalPages: 0 };
    }
  }

  const where = {
    ...(subjectId && { subjectId }),
    ...(classId && { subject: { classId } }),
    ...(allowedClassIds && { subject: { classId: { in: allowedClassIds } } }),
    ...(dateFrom && { date: { gte: new Date(dateFrom) } }),
    ...(dateTo && { date: { lte: new Date(dateTo) } }),
    ...(isCancelled !== undefined && { isCancelled }),
  };

  const [lessons, total] = await Promise.all([
    prisma.lesson.findMany({
      where, skip, take: limit,
      include: {
        subject: {
          include: {
            teacher: { select: { id: true, firstName: true, lastName: true } },
            class: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    }),
    prisma.lesson.count({ where }),
  ]);

  return { lessons, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getLessonById(id: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: {
      subject: {
        include: { teacher: { select: { id: true, firstName: true, lastName: true } }, class: true },
      },
    },
  });
  if (!lesson) throw new ApiError('Lektion nicht gefunden.', 'LESSON_NOT_FOUND', 404);
  return lesson;
}

export async function createLesson(input: CreateLessonInput) {
  await checkLessonConflicts(input);

  return prisma.lesson.create({
    data: {
      subjectId: input.subjectId,
      date: new Date(input.date),
      startTime: input.startTime,
      endTime: input.endTime,
      room: input.room ?? null,
      isTest: input.isTest ?? false,
    },
    include: { subject: { select: { name: true } } },
  });
}

export async function updateLesson(id: string, input: Partial<CreateLessonInput>) {
  const existing = await getLessonById(id);

  if (input.date || input.startTime || input.endTime || input.room !== undefined) {
    await checkLessonConflicts({
      subjectId: input.subjectId ?? existing.subjectId,
      date: input.date ?? existing.date.toISOString().split('T')[0]!,
      startTime: input.startTime ?? existing.startTime,
      endTime: input.endTime ?? existing.endTime,
      room: input.room !== undefined ? input.room : existing.room,
      excludeLessonId: id,
    });
  }

  return prisma.lesson.update({
    where: { id },
    data: {
      ...input,
      date: input.date ? new Date(input.date) : undefined,
      isTest: input.isTest,
    },
  });
}

export async function cancelLesson(id: string, reason: string) {
  const lesson = await getLessonById(id);

  if (lesson.isCancelled) {
    throw new ApiError('Lektion ist bereits als ausgefallen markiert.', 'ALREADY_CANCELLED', 409);
  }

  logger.info('Lektion ausgefallen', { lessonId: id, reason });

  return prisma.lesson.update({
    where: { id },
    data: { isCancelled: true, cancelReason: reason },
    select: { id: true, isCancelled: true, cancelReason: true },
  });
}

export async function deleteLesson(id: string) {
  await getLessonById(id);
  return prisma.lesson.delete({ where: { id } });
}
