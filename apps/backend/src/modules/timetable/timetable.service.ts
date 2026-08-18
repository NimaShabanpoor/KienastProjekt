// Stundenplan-Service: Tagesstruktur + Wochenvorlage + Ausnahmen + Materialisierung

import { Role, TimetableExceptionType, TimetableRowType } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler.middleware';
import { DEFAULT_TIMETABLE_STRUCTURE, toSchoolDayOfWeek } from '../../config/timetable';

const slotInclude = {
  subject: { select: { id: true, name: true, color: true } },
  teacher: { select: { id: true, firstName: true, lastName: true } },
} as const;

const TIME_RE = /^\d{2}:\d{2}$/;

export type StructureRowDto = {
  id: string;
  sortOrder: number;
  type: 'LESSON' | 'BREAK';
  label: string;
  startTime: string | null;
  endTime: string | null;
  period: number | null;
};

export type PeriodDto = {
  period: number;
  startTime: string;
  endTime: string;
  label: string;
};

function toDto(row: {
  id: string;
  sortOrder: number;
  type: TimetableRowType;
  label: string;
  startTime: string | null;
  endTime: string | null;
  period: number | null;
}): StructureRowDto {
  return {
    id: row.id,
    sortOrder: row.sortOrder,
    type: row.type,
    label: row.label,
    startTime: row.startTime,
    endTime: row.endTime,
    period: row.period,
  };
}

function periodsFromStructure(structure: StructureRowDto[]): PeriodDto[] {
  return structure
    .filter((r) => r.type === 'LESSON' && r.period != null && r.startTime && r.endTime)
    .map((r) => ({
      period: r.period!,
      startTime: r.startTime!,
      endTime: r.endTime!,
      label: r.label,
    }));
}

/** Lädt Struktur; legt Standard an, falls leer. */
export async function ensureStructure(): Promise<StructureRowDto[]> {
  const existing = await prisma.timetableStructureRow.findMany({
    orderBy: { sortOrder: 'asc' },
  });
  if (existing.length > 0) {
    return existing.map(toDto);
  }
  return seedDefaultStructure();
}

async function seedDefaultStructure(): Promise<StructureRowDto[]> {
  let lessonPeriod = 0;
  const created = [];
  for (let i = 0; i < DEFAULT_TIMETABLE_STRUCTURE.length; i++) {
    const row = DEFAULT_TIMETABLE_STRUCTURE[i]!;
    const period = row.type === 'LESSON' ? ++lessonPeriod : null;
    created.push(
      await prisma.timetableStructureRow.create({
        data: {
          sortOrder: i + 1,
          type: row.type as TimetableRowType,
          label: row.label,
          startTime: row.startTime ?? null,
          endTime: row.endTime ?? null,
          period,
        },
      })
    );
  }
  return created.map(toDto);
}

export async function getStructure() {
  const structure = await ensureStructure();
  return { structure, periods: periodsFromStructure(structure) };
}

export async function saveStructure(
  rows: Array<{
    type: 'LESSON' | 'BREAK';
    label: string;
    startTime?: string | null;
    endTime?: string | null;
  }>
) {
  if (rows.length === 0) {
    throw new ApiError('Mindestens eine Zeile erforderlich.', 'STRUCTURE_EMPTY', 400);
  }

  let lessonCount = 0;
  for (const row of rows) {
    const label = row.label.trim();
    if (!label) {
      throw new ApiError('Jede Zeile braucht eine Bezeichnung.', 'STRUCTURE_LABEL', 400);
    }
    if (row.type === 'LESSON') {
      lessonCount += 1;
      if (!row.startTime || !row.endTime || !TIME_RE.test(row.startTime) || !TIME_RE.test(row.endTime)) {
        throw new ApiError(
          `Lektion «${label}» braucht Start- und Endzeit (HH:MM).`,
          'STRUCTURE_TIME',
          400
        );
      }
      if (row.startTime >= row.endTime) {
        throw new ApiError(
          `Bei «${label}» muss die Endzeit nach der Startzeit liegen.`,
          'STRUCTURE_TIME_ORDER',
          400
        );
      }
    }
  }

  if (lessonCount === 0) {
    throw new ApiError('Mindestens eine Lektion ist erforderlich.', 'STRUCTURE_NO_LESSON', 400);
  }

  const validPeriods = new Set<number>();
  await prisma.$transaction(async (tx) => {
    await tx.timetableStructureRow.deleteMany();
    let lessonPeriod = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const period = row.type === 'LESSON' ? ++lessonPeriod : null;
      if (period != null) validPeriods.add(period);
      await tx.timetableStructureRow.create({
        data: {
          sortOrder: i + 1,
          type: row.type as TimetableRowType,
          label: row.label.trim(),
          startTime: row.type === 'LESSON' ? row.startTime! : (row.startTime?.trim() || null),
          endTime: row.type === 'LESSON' ? row.endTime! : (row.endTime?.trim() || null),
          period,
        },
      });
    }

    // Verwaiste Vorlagen/Ausnahmen zu entfernten Perioden löschen
    await tx.timetableSlot.deleteMany({
      where: { period: { notIn: [...validPeriods] } },
    });
    await tx.timetableException.deleteMany({
      where: { period: { notIn: [...validPeriods] } },
    });
  });

  return getStructure();
}

function canDoubleFromPeriod(structure: StructureRowDto[], period: number): boolean {
  const idx = structure.findIndex((r) => r.type === 'LESSON' && r.period === period);
  if (idx < 0 || idx >= structure.length - 1) return false;
  const next = structure[idx + 1];
  return Boolean(next && next.type === 'LESSON' && next.period === period + 1);
}

async function getPeriodMap(): Promise<Map<number, PeriodDto>> {
  const structure = await ensureStructure();
  const map = new Map<number, PeriodDto>();
  for (const p of periodsFromStructure(structure)) {
    map.set(p.period, p);
  }
  return map;
}

function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function periodTimesOverlap(
  periodMap: Map<number, PeriodDto>,
  periodA: number,
  periodB: number
): boolean {
  const a = periodMap.get(periodA);
  const b = periodMap.get(periodB);
  if (!a || !b) return periodA === periodB;
  return timesOverlap(a.startTime, a.endTime, b.startTime, b.endTime);
}

/**
 * Prüft, ob die Lehrperson am Wochentag schon zur gleichen Zeit
 * (gleiche oder zeitlich überlappende Periode) eingetragen ist.
 */
async function assertTeacherWeeklyFree(params: {
  teacherId: string;
  dayOfWeek: number;
  periods: number[];
  /** Diese Zellen werden überschrieben und zählen nicht als Konflikt */
  excludeClassId: string;
}): Promise<void> {
  const periodMap = await getPeriodMap();
  const existing = await prisma.timetableSlot.findMany({
    where: {
      teacherId: params.teacherId,
      dayOfWeek: params.dayOfWeek,
    },
    include: {
      subject: { select: { name: true } },
      class: { select: { name: true } },
    },
  });

  for (const slot of existing) {
    // Upsert der gleichen Zelle (Klasse + Periode) ist ok
    if (slot.classId === params.excludeClassId && params.periods.includes(slot.period)) {
      continue;
    }

    for (const period of params.periods) {
      const samePeriod = slot.period === period;
      const overlap = samePeriod || periodTimesOverlap(periodMap, period, slot.period);
      if (!overlap) continue;

      const when = periodMap.get(slot.period);
      const timeLabel = when ? `${when.startTime}–${when.endTime}` : `${slot.period}. Lektion`;
      throw new ApiError(
        `Überschneidung: Die Lehrperson unterrichtet bereits «${slot.subject.name}» in Klasse ${slot.class.name} (${timeLabel}). Eine Person kann nicht gleichzeitig zwei Lektionen halten.`,
        'TEACHER_CONFLICT',
        409,
        {
          conflictingClassId: slot.classId,
          conflictingPeriod: slot.period,
          conflictingSubject: slot.subject.name,
        }
      );
    }
  }
}

/**
 * Effektive Lehrperson-Belegung an einem Datum (Vorlage + Ausnahmen).
 * Verhindert Überschneidungen bei OVERRIDE-Ausnahmen.
 */
async function assertTeacherFreeOnDate(params: {
  teacherId: string;
  date: string;
  dayOfWeek: number;
  period: number;
  excludeClassId: string;
}): Promise<void> {
  const periodMap = await getPeriodMap();
  const dateObj = new Date(params.date);

  const [slots, exceptions] = await Promise.all([
    prisma.timetableSlot.findMany({
      where: { dayOfWeek: params.dayOfWeek },
      include: {
        subject: { select: { name: true } },
        class: { select: { name: true } },
      },
    }),
    prisma.timetableException.findMany({
      where: { date: dateObj },
      include: {
        subject: { select: { name: true } },
        class: { select: { name: true } },
      },
    }),
  ]);

  type Busy = {
    classId: string;
    period: number;
    className: string;
    subjectName: string;
  };

  const busy = new Map<string, Busy>();
  const teacherByKey = new Map<string, string>();

  for (const slot of slots) {
    const key = `${slot.classId}:${slot.period}`;
    busy.set(key, {
      classId: slot.classId,
      period: slot.period,
      className: slot.class.name,
      subjectName: slot.subject.name,
    });
    teacherByKey.set(key, slot.teacherId);
  }

  for (const ex of exceptions) {
    const key = `${ex.classId}:${ex.period}`;
    if (ex.type === TimetableExceptionType.CANCEL) {
      busy.delete(key);
      teacherByKey.delete(key);
      continue;
    }
    if (ex.type === TimetableExceptionType.OVERRIDE && ex.teacherId) {
      teacherByKey.set(key, ex.teacherId);
      busy.set(key, {
        classId: ex.classId,
        period: ex.period,
        className: ex.class.name,
        subjectName: ex.subject?.name ?? 'Stellvertretung',
      });
    }
  }

  // Zelle, die wir gerade setzen, ausnehmen
  const excludeKey = `${params.excludeClassId}:${params.period}`;
  busy.delete(excludeKey);
  teacherByKey.delete(excludeKey);

  for (const [key, teacherId] of teacherByKey) {
    if (teacherId !== params.teacherId) continue;
    const entry = busy.get(key);
    if (!entry) continue;
    if (!periodTimesOverlap(periodMap, params.period, entry.period)) continue;
    const when = periodMap.get(entry.period);
    const timeLabel = when ? `${when.startTime}–${when.endTime}` : `Periode ${entry.period}`;
    throw new ApiError(
      `Überschneidung: Die Lehrperson unterrichtet an diesem Datum bereits «${entry.subjectName}» in Klasse ${entry.className} (${timeLabel}).`,
      'TEACHER_CONFLICT',
      409,
      {
        conflictingClassId: entry.classId,
        conflictingPeriod: entry.period,
        conflictingSubject: entry.subjectName,
      }
    );
  }
}

export async function getClassTimetable(classId: string) {
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) throw new ApiError('Klasse nicht gefunden.', 'CLASS_NOT_FOUND', 404);

  const structure = await ensureStructure();
  const slots = await prisma.timetableSlot.findMany({
    where: { classId },
    include: slotInclude,
    orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }],
  });

  return {
    class: cls,
    structure,
    periods: periodsFromStructure(structure),
    slots,
  };
}

export async function upsertSlot(input: {
  classId: string;
  dayOfWeek: number;
  period: number;
  subjectId: string;
  teacherId: string;
  room: string;
  isTest?: boolean;
  doubleLesson?: boolean;
}) {
  const room = input.room.trim();
  if (!room) {
    throw new ApiError('Raum ist erforderlich.', 'ROOM_REQUIRED', 400);
  }

  await assertTeacherTeachesSubject(input.subjectId, input.teacherId);
  await assertTeacher(input.teacherId);

  const structure = await ensureStructure();
  const periodMeta = periodsFromStructure(structure).find((p) => p.period === input.period);
  if (!periodMeta) {
    throw new ApiError('Ungültige Periode.', 'INVALID_PERIOD', 400);
  }

  const periodsToWrite = [input.period];
  if (input.doubleLesson) {
    if (!canDoubleFromPeriod(structure, input.period)) {
      throw new ApiError(
        'Doppellektion nur möglich, wenn die nächste Zeile eine Lektion ohne Pause dazwischen ist.',
        'DOUBLE_LESSON_INVALID',
        400
      );
    }
    periodsToWrite.push(input.period + 1);
  }

  await assertTeacherWeeklyFree({
    teacherId: input.teacherId,
    dayOfWeek: input.dayOfWeek,
    periods: periodsToWrite,
    excludeClassId: input.classId,
  });

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
        room,
        isTest: input.isTest ?? false,
      },
      update: {
        subjectId: input.subjectId,
        teacherId: input.teacherId,
        room,
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

export async function listHolidays(dateFrom?: string, dateTo?: string) {
  return prisma.schoolHoliday.findMany({
    where: {
      ...(dateFrom || dateTo
        ? {
            date: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && { lte: new Date(dateTo) }),
            },
          }
        : {}),
    },
    orderBy: { date: 'asc' },
  });
}

export async function upsertHoliday(input: { date: string; name: string }) {
  const name = input.name.trim();
  if (!name) {
    throw new ApiError('Bezeichnung erforderlich.', 'HOLIDAY_NAME_REQUIRED', 400);
  }

  return prisma.schoolHoliday.upsert({
    where: { date: new Date(input.date) },
    create: {
      date: new Date(input.date),
      name,
    },
    update: { name },
  });
}

export async function deleteHoliday(id: string) {
  const holiday = await prisma.schoolHoliday.findUnique({ where: { id } });
  if (!holiday) throw new ApiError('Feiertag nicht gefunden.', 'HOLIDAY_NOT_FOUND', 404);
  await prisma.schoolHoliday.delete({ where: { id } });
  return { deleted: true };
}

async function findHolidayOnDate(date: string) {
  return prisma.schoolHoliday.findUnique({
    where: { date: new Date(date) },
  });
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
      subject: { select: { id: true, name: true, color: true } },
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

  const holiday = await findHolidayOnDate(input.date);
  if (holiday) {
    throw new ApiError(
      `Am ${input.date} ist schulfrei («${holiday.name}»). Einzelne Ausnahmen sind nicht nötig.`,
      'HOLIDAY_DAY',
      400
    );
  }

  const periodMap = await getPeriodMap();
  if (!periodMap.has(input.period)) {
    throw new ApiError('Ungültige Periode.', 'INVALID_PERIOD', 400);
  }

  const room = input.room?.trim() || null;

  if (input.type === 'OVERRIDE') {
    if (!input.subjectId || !input.teacherId) {
      throw new ApiError('OVERRIDE benötigt Fach und Lehrperson.', 'MISSING_FIELDS', 400);
    }
    if (!room) {
      throw new ApiError('Raum ist erforderlich.', 'ROOM_REQUIRED', 400);
    }
    await assertTeacher(input.teacherId);
    await assertTeacherFreeOnDate({
      teacherId: input.teacherId,
      date: input.date,
      dayOfWeek: day,
      period: input.period,
      excludeClassId: input.classId,
    });
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
      room: input.type === 'OVERRIDE' ? room : null,
      isTest: input.type === 'OVERRIDE' ? (input.isTest ?? false) : null,
    },
    update: {
      type: input.type as TimetableExceptionType,
      subjectId: input.type === 'OVERRIDE' ? input.subjectId! : null,
      teacherId: input.type === 'OVERRIDE' ? input.teacherId! : null,
      room: input.type === 'OVERRIDE' ? room : null,
      isTest: input.type === 'OVERRIDE' ? (input.isTest ?? false) : null,
    },
    include: {
      subject: { select: { id: true, name: true, color: true } },
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
 */
export async function materializeLessonsForRange(params: {
  classId?: string;
  dateFrom: string;
  dateTo: string;
}): Promise<void> {
  const classFilter = params.classId ? { id: params.classId } : { isActive: true };

  const classes = await prisma.class.findMany({
    where: classFilter,
    select: { id: true },
  });

  const periodMap = await getPeriodMap();
  const from = new Date(params.dateFrom + 'T12:00:00');
  const to = new Date(params.dateTo + 'T12:00:00');

  const holidays = await prisma.schoolHoliday.findMany({
    where: {
      date: { gte: new Date(params.dateFrom), lte: new Date(params.dateTo) },
    },
  });
  const holidayDates = new Set(
    holidays.map((h) => h.date.toISOString().slice(0, 10))
  );

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

      // Feiertag: alle geplanten Lektionen als Ausfall markieren
      if (holidayDates.has(dateStr)) {
        for (const slot of daySlots) {
          const periodMeta = periodMap.get(slot.period);
          if (!periodMeta) continue;
          await cancelMaterializedLesson(cls.id, dateStr, periodMeta.startTime);
        }
        continue;
      }

      for (const slot of daySlots) {
        const periodMeta = periodMap.get(slot.period);
        if (!periodMeta) continue;

        const ex = exceptions.find(
          (e) =>
            e.period === slot.period &&
            e.date.toISOString().slice(0, 10) === dateStr
        );

        if (ex?.type === TimetableExceptionType.CANCEL) {
          await cancelMaterializedLesson(cls.id, dateStr, periodMeta.startTime);
          continue;
        }

        const subjectId =
          ex?.type === TimetableExceptionType.OVERRIDE && ex.subjectId
            ? ex.subjectId
            : slot.subjectId;
        const room =
          ex?.type === TimetableExceptionType.OVERRIDE ? (ex.room ?? null) : slot.room;
        const isTest =
          ex?.type === TimetableExceptionType.OVERRIDE
            ? (ex.isTest ?? false)
            : slot.isTest;

        const teacherId =
          ex?.type === TimetableExceptionType.OVERRIDE && ex.teacherId
            ? ex.teacherId
            : slot.teacherId;

        await upsertMaterializedLesson({
          classId: cls.id,
          subjectId,
          teacherId,
          date: dateStr,
          startTime: periodMeta.startTime,
          endTime: periodMeta.endTime,
          room,
          isTest,
        });
      }

      const dayExceptions = exceptions.filter(
        (e) => e.date.toISOString().slice(0, 10) === dateStr
      );
      for (const ex of dayExceptions) {
        if (ex.type !== TimetableExceptionType.OVERRIDE || !ex.subjectId) continue;
        const hasSlot = daySlots.some((s) => s.period === ex.period);
        if (hasSlot) continue;
        const periodMeta = periodMap.get(ex.period);
        if (!periodMeta) continue;
        await upsertMaterializedLesson({
          classId: cls.id,
          subjectId: ex.subjectId,
          teacherId: ex.teacherId!,
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
  classId: string;
  subjectId: string;
  teacherId: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string | null;
  isTest: boolean;
}): Promise<void> {
  const existing = await prisma.lesson.findFirst({
    where: {
      classId: data.classId,
      date: new Date(data.date),
      startTime: data.startTime,
    },
  });

  if (existing) {
    await prisma.lesson.update({
      where: { id: existing.id },
      data: {
        subjectId: data.subjectId,
        teacherId: data.teacherId,
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
        classId: data.classId,
        subjectId: data.subjectId,
        teacherId: data.teacherId,
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
  classId: string,
  date: string,
  startTime: string
): Promise<void> {
  const existing = await prisma.lesson.findFirst({
    where: { classId, date: new Date(date), startTime },
  });
  if (existing && !existing.isCancelled) {
    await prisma.lesson.update({
      where: { id: existing.id },
      data: { isCancelled: true, cancelReason: 'Stundenplan-Ausnahme (Ausfall)' },
    });
  }
}

async function assertTeacherTeachesSubject(subjectId: string, teacherId: string): Promise<void> {
  const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true, isActive: true } });
  if (!subject || !subject.isActive) {
    throw new ApiError('Fach nicht gefunden.', 'SUBJECT_NOT_FOUND', 404);
  }
  const assigned = await prisma.subjectTeacher.findUnique({
    where: { subjectId_teacherId: { subjectId, teacherId } },
  });
  if (!assigned) {
    throw new ApiError(
      'Diese Lehrperson ist dem Modul nicht zugewiesen.',
      'TEACHER_NOT_ON_SUBJECT',
      400
    );
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
