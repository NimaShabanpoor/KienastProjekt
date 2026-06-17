// Zod-Schemas für Absenzen-Validierung

import { z } from 'zod';
import { AbsenceStatus } from '@prisma/client';

export const AbsenceEntrySchema = z.object({
  studentId: z.string().cuid('Ungültige Schüler-ID'),
  status: z.nativeEnum(AbsenceStatus),
  note: z.string().max(500).optional().nullable(),
});

export const CreateAbsenceBatchBodySchema = z.object({
  lessonId: z.string().cuid('Ungültige Lektions-ID'),
  absences: z.array(AbsenceEntrySchema).min(1, 'Mindestens eine Absenz-Eintragung erforderlich'),
});

export const UpdateAbsenceBodySchema = z.object({
  status: z.nativeEnum(AbsenceStatus),
  note: z.string().max(500).optional().nullable(),
});

export const AbsenceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  lessonId: z.string().cuid().optional(),
  studentId: z.string().cuid().optional(),
  classId: z.string().cuid().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.nativeEnum(AbsenceStatus).optional(),
});
