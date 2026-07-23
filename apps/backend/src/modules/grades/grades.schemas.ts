// Zod-Schemas für Noten-Validierung
// Schweizer Notenskala: 1.0 bis 6.0, 0.5er-Schritte

import { z } from 'zod';
import { GRADE_LIMITS } from '../../config/constants';

// Schweizer Notenwert-Validator
const SwissGradeSchema = z
  .number()
  .min(GRADE_LIMITS.MIN, `Note muss mindestens ${GRADE_LIMITS.MIN} sein`)
  .max(GRADE_LIMITS.MAX, `Note darf höchstens ${GRADE_LIMITS.MAX} sein`)
  .refine(
    (val) => Math.round(val * 2) === val * 2,
    `Note muss in ${GRADE_LIMITS.STEP}er-Schritten sein (z.B. 4.0, 4.5, 5.0)`
  );

export const CreateGradeBodySchema = z.object({
  studentId: z.string().cuid('Ungültige Schüler-ID'),
  subjectId: z.string().cuid('Ungültige Fach-ID'),
  categoryId: z.string().cuid('Ungültige Kategorie-ID'),
  value: SwissGradeSchema,
  description: z.string().min(1, 'Testtitel erforderlich').max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum muss YYYY-MM-DD sein'),
});

export const CreateGradeBatchBodySchema = z.object({
  subjectId: z.string().cuid('Ungültige Fach-ID'),
  categoryId: z.string().cuid('Ungültige Kategorie-ID'),
  title: z.string().min(1, 'Testtitel erforderlich').max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum muss YYYY-MM-DD sein'),
  entries: z
    .array(
      z.object({
        studentId: z.string().cuid('Ungültige Schüler-ID'),
        value: SwissGradeSchema,
      })
    )
    .min(1, 'Mindestens eine Note erforderlich'),
});

export const CorrectGradeBodySchema = z.object({
  newValue: SwissGradeSchema,
  reason: z
    .string()
    .min(10, 'Begründung muss mindestens 10 Zeichen lang sein')
    .max(500),
});

export const CreateGradeCategoryBodySchema = z.object({
  name: z.string().min(1, 'Name erforderlich').max(100),
  weight: z
    .number()
    .min(0.01, 'Gewichtung muss grösser als 0 sein')
    .max(1.0, 'Gewichtung darf höchstens 1.0 sein'),
});
