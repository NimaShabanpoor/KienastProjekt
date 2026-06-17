// Zod-Validierungsschemas für Noten-Endpunkte
// Schweizer Notenskala: 1.0 bis 6.0

import { z } from 'zod';

// Schweizer Notenwert (1.0 - 6.0, 0.5er-Schritte)
export const SwissGradeSchema = z
  .number()
  .min(1.0, 'Note muss mindestens 1.0 sein')
  .max(6.0, 'Note darf höchstens 6.0 sein')
  .refine(
    (val) => Math.round(val * 2) === val * 2,
    'Note muss in 0.5er-Schritten sein (z.B. 4.0, 4.5, 5.0)'
  );

// Note erstellen
export const CreateGradeSchema = z.object({
  studentId: z.string().cuid('Ungültige Schüler-ID'),
  subjectId: z.string().cuid('Ungültige Fach-ID'),
  categoryId: z.string().cuid('Ungültige Kategorie-ID'),
  value: SwissGradeSchema,
  description: z.string().max(200).optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum muss im Format YYYY-MM-DD sein'),
});

export type CreateGradeInput = z.infer<typeof CreateGradeSchema>;

// Notenkorrektur (nur Abteilungsleitung)
export const CorrectGradeSchema = z.object({
  newValue: SwissGradeSchema,
  reason: z
    .string()
    .min(10, 'Begründung muss mindestens 10 Zeichen lang sein')
    .max(500, 'Begründung darf höchstens 500 Zeichen lang sein'),
});

export type CorrectGradeInput = z.infer<typeof CorrectGradeSchema>;

// Notenkategorie erstellen
export const CreateGradeCategorySchema = z.object({
  name: z.string().min(1, 'Name erforderlich').max(100),
  weight: z
    .number()
    .min(0.01, 'Gewichtung muss grösser als 0 sein')
    .max(1.0, 'Gewichtung darf höchstens 1.0 sein'),
});

export type CreateGradeCategoryInput = z.infer<typeof CreateGradeCategorySchema>;

// Abfrage-Parameter
export const GradeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  subjectId: z.string().cuid().optional(),
  studentId: z.string().cuid().optional(),
  classId: z.string().cuid().optional(),
  categoryId: z.string().cuid().optional(),
});

export type GradeQueryInput = z.infer<typeof GradeQuerySchema>;
