// Zod-Validierungsschemas für Schüler-Endpunkte

import { z } from 'zod';

// Schüler erstellen
export const CreateStudentSchema = z.object({
  firstName: z.string().min(1, 'Vorname erforderlich').max(100),
  lastName: z.string().min(1, 'Nachname erforderlich').max(100),
  email: z.string().email('Ungültige E-Mail-Adresse').optional().nullable(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum muss im Format YYYY-MM-DD sein')
    .optional()
    .nullable(),
  gender: z.enum(['M', 'F', 'D']).optional().nullable(),
  classId: z.string().cuid('Ungültige Klassen-ID'),
});

export type CreateStudentInput = z.infer<typeof CreateStudentSchema>;

// Schüler aktualisieren (alle Felder optional)
export const UpdateStudentSchema = CreateStudentSchema.partial();

export type UpdateStudentInput = z.infer<typeof UpdateStudentSchema>;

// Suchparameter für Schüler-Liste
export const StudentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  classId: z.string().cuid().optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().max(100).optional(),
});

export type StudentQueryInput = z.infer<typeof StudentQuerySchema>;
