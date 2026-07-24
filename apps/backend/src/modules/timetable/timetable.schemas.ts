// Zod-Schemas für Stundenplan-Vorlage, Struktur und Ausnahmen

import { z } from 'zod';

const timeOptional = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'Zeitformat HH:MM')
  .optional()
  .nullable();

export const UpsertTimetableSlotBodySchema = z.object({
  classId: z.string().cuid(),
  dayOfWeek: z.coerce.number().int().min(1).max(5),
  period: z.coerce.number().int().min(1).max(20),
  subjectId: z.string().cuid(),
  teacherId: z.string().cuid(),
  room: z.string().trim().min(1, 'Raum ist erforderlich.').max(50),
  isTest: z.coerce.boolean().optional().default(false),
  /** Belegt auch die nächste Lektion (ohne Pause dazwischen) */
  doubleLesson: z.coerce.boolean().optional().default(false),
});

export const UpsertTimetableExceptionBodySchema = z
  .object({
    classId: z.string().cuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    period: z.coerce.number().int().min(1).max(20),
    type: z.enum(['CANCEL', 'OVERRIDE']),
    subjectId: z.string().cuid().optional().nullable(),
    teacherId: z.string().cuid().optional().nullable(),
    room: z.string().trim().max(50).optional().nullable(),
    isTest: z.coerce.boolean().optional().nullable(),
  })
  .refine(
    (d) => d.type === 'CANCEL' || (Boolean(d.subjectId) && Boolean(d.teacherId)),
    { message: 'Bei OVERRIDE sind Fach und Lehrperson erforderlich.', path: ['subjectId'] }
  )
  .refine(
    (d) => d.type === 'CANCEL' || Boolean(d.room?.trim()),
    { message: 'Raum ist erforderlich.', path: ['room'] }
  );

export const SaveTimetableStructureBodySchema = z.object({
  rows: z
    .array(
      z.object({
        type: z.enum(['LESSON', 'BREAK']),
        label: z.string().min(1).max(80),
        startTime: timeOptional,
        endTime: timeOptional,
      })
    )
    .min(1)
    .max(40),
});

export const UpsertSchoolHolidayBodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(1).max(120),
});

export const TimetableQuerySchema = z.object({
  classId: z.string().cuid(),
});
