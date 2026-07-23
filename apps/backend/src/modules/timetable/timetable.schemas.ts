// Zod-Schemas für Stundenplan-Vorlage und Ausnahmen

import { z } from 'zod';

export const UpsertTimetableSlotBodySchema = z.object({
  classId: z.string().cuid(),
  dayOfWeek: z.coerce.number().int().min(1).max(5),
  period: z.coerce.number().int().min(1).max(8),
  subjectId: z.string().cuid(),
  teacherId: z.string().cuid(),
  room: z.string().max(50).optional().nullable(),
  isTest: z.coerce.boolean().optional().default(false),
  /** Belegt auch die nächste Periode am selben Tag */
  doubleLesson: z.coerce.boolean().optional().default(false),
});

export const UpsertTimetableExceptionBodySchema = z.object({
  classId: z.string().cuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period: z.coerce.number().int().min(1).max(8),
  type: z.enum(['CANCEL', 'OVERRIDE']),
  subjectId: z.string().cuid().optional().nullable(),
  teacherId: z.string().cuid().optional().nullable(),
  room: z.string().max(50).optional().nullable(),
  isTest: z.coerce.boolean().optional().nullable(),
}).refine(
  (d) => d.type === 'CANCEL' || (Boolean(d.subjectId) && Boolean(d.teacherId)),
  { message: 'Bei OVERRIDE sind Fach und Lehrperson erforderlich.', path: ['subjectId'] }
);

export const TimetableQuerySchema = z.object({
  classId: z.string().cuid(),
});
