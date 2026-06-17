// Zod-Schemas für Lektionen-Validierung

import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const CreateLessonBodySchema = z
  .object({
    subjectId: z.string().cuid('Ungültige Fach-ID'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum muss YYYY-MM-DD sein'),
    startTime: z.string().regex(timeRegex, 'Startzeit muss HH:mm sein'),
    endTime: z.string().regex(timeRegex, 'Endzeit muss HH:mm sein'),
    room: z.string().max(50).optional().nullable(),
  })
  .refine((d) => d.startTime < d.endTime, {
    message: 'Startzeit muss vor Endzeit liegen',
    path: ['endTime'],
  });

export const UpdateLessonBodySchema = CreateLessonBodySchema.partial();

export const CancelLessonBodySchema = z.object({
  reason: z.string().min(1, 'Grund für Ausfall erforderlich').max(500),
});

export const LessonQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  subjectId: z.string().cuid().optional(),
  classId: z.string().cuid().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  isCancelled: z.coerce.boolean().optional(),
});
