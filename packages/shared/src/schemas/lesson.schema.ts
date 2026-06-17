// Zod-Validierungsschemas für Lektionen-Endpunkte

import { z } from 'zod';

// Zeitformat HH:mm validieren
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

// Lektion erstellen
export const CreateLessonSchema = z
  .object({
    subjectId: z.string().cuid('Ungültige Fach-ID'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum muss im Format YYYY-MM-DD sein'),
    startTime: z.string().regex(timeRegex, 'Startzeit muss im Format HH:mm sein'),
    endTime: z.string().regex(timeRegex, 'Endzeit muss im Format HH:mm sein'),
    room: z.string().max(50).optional().nullable(),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: 'Startzeit muss vor der Endzeit liegen',
    path: ['endTime'],
  });

export type CreateLessonInput = z.infer<typeof CreateLessonSchema>;

// Lektion aktualisieren
export const UpdateLessonSchema = CreateLessonSchema.partial();

export type UpdateLessonInput = z.infer<typeof UpdateLessonSchema>;

// Lektion absagen
export const CancelLessonSchema = z.object({
  reason: z.string().min(1, 'Grund für den Ausfall ist erforderlich').max(500),
});

export type CancelLessonInput = z.infer<typeof CancelLessonSchema>;

// Abfrage-Parameter für Lektionen
export const LessonQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  subjectId: z.string().cuid().optional(),
  classId: z.string().cuid().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  isCancelled: z.coerce.boolean().optional(),
});

export type LessonQueryInput = z.infer<typeof LessonQuerySchema>;
