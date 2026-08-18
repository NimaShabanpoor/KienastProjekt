// Zod-Schemas für Fächer/Module-Validierung

import { z } from 'zod';

const colorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Ungültige Farbe');

export const CreateSubjectBodySchema = z.object({
  name: z.string().min(1, 'Name/Modul erforderlich').max(100),
  color: colorSchema.optional(),
  teacherIds: z.array(z.string().cuid('Ungültige Lehrpersonen-ID')).min(1, 'Mindestens eine Lehrperson'),
});

export const UpdateSubjectBodySchema = z
  .object({
    name: z.string().min(1).max(100),
    color: colorSchema,
    teacherIds: z.array(z.string().cuid()).min(1),
    isActive: z.boolean(),
  })
  .partial();
