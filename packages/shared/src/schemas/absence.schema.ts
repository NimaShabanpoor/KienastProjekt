// Zod-Validierungsschemas für Absenzen-Endpunkte

import { z } from 'zod';
import { AbsenceStatus } from '../types/roles';

// Einzelne Absenz in einem Batch
export const AbsenceEntrySchema = z.object({
  studentId: z.string().cuid('Ungültige Schüler-ID'),
  status: z.nativeEnum(AbsenceStatus),
  note: z.string().max(500).optional().nullable(),
});

export type AbsenceEntryInput = z.infer<typeof AbsenceEntrySchema>;

// Batch-Erfassung für eine Lektion
export const CreateAbsenceBatchSchema = z.object({
  lessonId: z.string().cuid('Ungültige Lektions-ID'),
  absences: z
    .array(AbsenceEntrySchema)
    .min(1, 'Mindestens eine Absenz-Eintragung erforderlich'),
});

export type CreateAbsenceBatchInput = z.infer<typeof CreateAbsenceBatchSchema>;

// Einzelne Absenz aktualisieren
export const UpdateAbsenceSchema = z.object({
  status: z.nativeEnum(AbsenceStatus),
  note: z.string().max(500).optional().nullable(),
});

export type UpdateAbsenceInput = z.infer<typeof UpdateAbsenceSchema>;

// Abfrage-Parameter
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

export type AbsenceQueryInput = z.infer<typeof AbsenceQuerySchema>;
