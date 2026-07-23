// Stundenplan-Service: Wochenvorlage + Ausnahmen + Materialisierung zu Lessons

import { Role, TimetableExceptionType } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler.middleware';
import { TIMETABLE_PERIODS, getPeriod, toSchoolDayOfWeek } from '../../config/timetable';

const slotInclude = {
  subject: { select: { id: true, name: true, classId: true } },
  teacher: { select: { id: true, firstName: true, lastName: true } },
} as const;

export async function getClassTimetable(classId: string) {
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) throw new ApiError('Klasse nicht gefunden.', 'CLASS_NOT_FOUND', 404);

  const slots = await prisma.timetableSlot.findMany({
    where: { classId },
    include: slotInclude,
    orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }],
  });

  return { class: cls, periods: TIMETABLE_PERIODS, slots };
}

export async function upsertSlot(input: {
  classId: string;
  dayOfWeek: number;
  period: number;
  subjectId: string;
  teacherId: string;
  room?: string | null;
  isTest?: boolean;
  doubleLesson?: boolean;
}) {
  await assertSubjectBelongsToClass(input.subjectId, input.classId);
  await assertTeacher(input.teacherId);

  const periodsToWrite = [input.period];
  if (input.doubleLesson) {
    if (input.period >= 8) {
      throw new ApiError('Doppellektion ab Periode 8 nicht möglich.', 'DOUBLE_LESSON_INVALID', 400);
    }
    // Keine Doppellektion über die Mittagspause (4→5) oder Pausen hinweg erzwingen:
    // erlaubt 1-2, 3-4, 5-6, 7-8
    const pairs = new Set([1, 3, 5, 7]);
    if (!pairs.has(input.period)) {
      throw new ApiError(
        'Doppellektion nur ab Periode 1, 3, 5 oder 7 möglich.',
        'DOUBLE_LESSON_INVALID',
        400
      );
    }
    periodsToWrite.push(input.period + 1);
  }

  const results = [];
  for (const period of periodsToWrite) {
    const slot = await prisma.timetableSlot.upsert({
      where: {
        classId_dayOfWeek_period: {
          classId: input.classId,
          dayOfWeek: input.dayOfWeek,
          period,
        },
      },
      create: {
        classId: input.classId,
        dayOfWeek: input.dayOfWeek,
        period,
        subjectId: input.subjectId,
        teacherId: input.teacherId,
        room: input.room ?? null,
        isTest: input.isTest ?? false,
      },
      update: {
        subjectId: input.subjectId,
        teacherId: input.teacherId,
        room: input.room ?? null,
        isTest: input.isTest ?? false,
      },
      include: slotInclude,
    });
    results.push(slot);
  }
  return results;
}

export async function deleteSlot(id: string) {
  const slot = await prisma.timetableSlot.findUnique({ where: { id } });
  if (!slot) throw new ApiError('Stundenplan-Eintrag nicht gefunden.', 'SLOT_NOT_FOUND', 404);
  await prisma.timetableSlot.delete({ where: { id } });
  return { deleted: true };
}

export async function listExceptions(classId: string, dateFrom?: string, dateTo?: string) {
  return prisma.timetableException.findMany({
    where: {
      classId,
      ...(dateFrom || dateTo
        ? {
            date: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && { lte: new Date(dateTo) }),
            },
          }
        : {}),
    },
    include: {
      subject: { select: { id: true, name: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ date: 'asc' }, { period: 'asc' }],
  });
}

export async function upsertException(input: {
  classId: string;
  date: string;
  period: number;
  type: 'CANCEL' | 'OVERRIDE';
  subjectId?: string | null;
  teacherId?: string | null;
  room?: string | null;
  isTest?: boolean | null;
}) {
  const day = toSchoolDayOfWeek(new Date(input.date + 'T12:00:00'));
  if (day === null) {
    throw new ApiError('Ausnahmen nur für Mo–Fr möglich.', 'WEEKEND_NOT_ALLOWED', 400);
  }

  if (input.type === 'OVERRIDE') {
    if (!input.subjectId || !input.teacherId) {
      throw new ApiError('OVERRIDE benötigt Fach und Lehrperson.', 'MISSING_FIELDS', 400);
    }
    await assertSubjectBelongsToClass(input.subjectId, input.classId);
    await assertTeacher(input.teacherId);
  }

  return prisma.timetableException.upsert({
    where: {
      classId_date_period: {
        classId: input.classId,
        date: new Date(input.date),
        period: input.period,
      },
    },
    create: {
      classId: input.classId,
      date: new Date(input.date),
      period: input.period,
      type: input.type as TimetableExceptionType,
      subjectId: input.type === 'OVERRIDE' ? input.subjectId! : null,
      teacherId: input.type === 'OVERRIDE' ? input.teacherId! : null,
      room: input.type === 'OVERRIDE' ? (input.room ?? null) : null,
      isTest: input.type === 'OVERRIDE' ? (input.isTest ?? false) : null,
    },
    update: {
      type: input.type as TimetableExceptionType,
      subjectId: input.type === 'OVERRIDE' ? input.subjectId! : null,
      teacherId: input.type === 'OVERRIDE' ? input.teacherId! : null,
      room: input.type === 'OVERRIDE' ? (input.room ?? null) : null,
      isTest: input.type === 'OVERRIDE' ? (input.isTest ?? false) : null,
    },
    include: {
      subject: { select: { id: true, name: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function deleteException(id: string) {
  const ex = await prisma.timetableException.findUnique({ where: { id } });
  if (!ex) throw new ApiError('Ausnahme nicht gefunden.', 'EXCEPTION_NOT_FOUND', 404);
  await prisma.timetableException.delete({ where: { id } });
  return { deleted: true };
}

/**
 * Materialisiert aus Vorlage + Ausnahmen konkrete Lesson-Zeilen für Absenzen.
 * Wird von listLessons genutzt.
 */
export async function materializeLessonsForRange(params: {
  classId?: string;
  dateFrom: string;
  dateTo: string;
}): Promise<void> {
  const classFilter = params.classId
    ? { id: params.classId }
    : { isActive: true };

  const classes = await prisma.class.findMany({
    where: classFilter,
    select: { id: true },
  });

  const from = new Date(params.dateFrom + 'T12:00:00');
  const to = new Date(params.dateTo + 'T12:00:00');

  for (const cls of classes) {
    const slots = await prisma.timetableSlot.findMany({ where: { classId: cls.id } });
    if (slots.length === 0) continue;

    const exceptions = await prisma.timetableException.findMany({
      where: {
        classId: cls.id,
        date: { gte: new Date(params.dateFrom), lte: new Date(params.dateTo) },
      },
    });

    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = toSchoolDayOfWeek(d);
      if (dayOfWeek === null) continue;
      const dateStr = d.toISOString().slice(0, 10);

      const daySlots = slots.filter((s) => s.dayOfWeek === dayOfWeek);
      for (const slot of daySlots) {
        const periodMeta = getPeriod(slot.period);
        if (!periodMeta) continue;

        const ex = exceptions.find(
          (e) =>
            e.period === slot.period &&
            e.date.toISOString().slice(0, 10) === dateStr
        );

        if (ex?.type === TimetableExceptionType.CANCEL) {
          await cancelMaterializedLesson(slot.subjectId, dateStr, periodMeta.startTime);
          continue;
        }

        const subjectId = ex?.type === TimetableExceptionType.OVERRIDE && ex.subjectId
          ? ex.subjectId
          : slot.subjectId;
        const room =
          ex?.type === TimetableExceptionType.OVERRIDE ? (ex.room ?? null) : slot.room;
        const isTest =
          ex?.type === TimetableExceptionType.OVERRIDE
            ? (ex.isTest ?? false)
            : slot.isTest;

        await upsertMaterializedLesson({
          subjectId,
          date: dateStr,
          startTime: periodMeta.startTime,
          endTime: periodMeta.endTime,
          room,
          isTest,
        });
      }

      // OVERRIDE ohne Slot (zusätzliche Lektion an einem Tag)
      const dayExceptions = exceptions.filter(
        (e) => e.date.toISOString().slice(0, 10) === dateStr
      );
      for (const ex of dayExceptions) {
        if (ex.type !== TimetableExceptionType.OVERRIDE || !ex.subjectId) continue;
        const hasSlot = daySlots.some((s) => s.period === ex.period);
        if (hasSlot) continue;
        const periodMeta = getPeriod(ex.period);
        if (!periodMeta) continue;
        await upsertMaterializedLesson({
          subjectId: ex.subjectId,
          date: dateStr,
          startTime: periodMeta.startTime,
          endTime: periodMeta.endTime,
          room: ex.room ?? null,
          isTest: ex.isTest ?? false,
        });
      }
    }
  }
}

async function upsertMaterializedLesson(data: {
  subjectId: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string | null;
  isTest: boolean;
}): Promise<void> {
  const existing = await prisma.lesson.findFirst({
    where: {
      subjectId: data.subjectId,
      date: new Date(data.date),
      startTime: data.startTime,
    },
  });

  if (existing) {
    await prisma.lesson.update({
      where: { id: existing.id },
      data: {
        endTime: data.endTime,
        room: data.room,
        isTest: data.isTest,
        isCancelled: false,
        cancelReason: null,
      },
    });
  } else {
    await prisma.lesson.create({
      data: {
        subjectId: data.subjectId,
        date: new Date(data.date),
        startTime: data.startTime,
        endTime: data.endTime,
        room: data.room,
        isTest: data.isTest,
        isCancelled: false,
      },
    });
  }
}

async function cancelMaterializedLesson(
  subjectId: string,
  date: string,
  startTime: string
): Promise<void> {
  const existing = await prisma.lesson.findFirst({
    where: { subjectId, date: new Date(date), startTime },
  });
  if (existing && !existing.isCancelled) {
    await prisma.lesson.update({
      where: { id: existing.id },
      data: { isCancelled: true, cancelReason: 'Stundenplan-Ausnahme (Ausfall)' },
    });
  }
}

async function assertSubjectBelongsToClass(subjectId: string, classId: string): Promise<void> {
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject || subject.classId !== classId) {
    throw new ApiError('Fach gehört nicht zu dieser Klasse.', 'SUBJECT_CLASS_MISMATCH', 400);
  }
}

async function assertTeacher(teacherId: string): Promise<void> {
  const teacher = await prisma.user.findFirst({
    where: { id: teacherId, role: Role.LEHRPERSON, isActive: true, deletedAt: null },
  });
  if (!teacher) {
    throw new ApiError('Ungültige Lehrperson.', 'INVALID_TEACHER', 400);
  }
}
