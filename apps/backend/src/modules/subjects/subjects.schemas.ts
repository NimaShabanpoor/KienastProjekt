// Zod-Schemas für Fächer/Module-Validierung

import { z } from 'zod';

export const CreateSubjectBodySchema = z.object({
  name: z.string().min(1, 'Name/Modul erforderlich').max(100),
  classId: z.string().cuid('Ungültige Klassen-ID'),
  teacherId: z.string().cuid('Ungültige Lehrpersonen-ID'),
});

export const UpdateSubjectBodySchema = z
  .object({
    name: z.string().min(1).max(100),
    teacherId: z.string().cuid(),
    isActive: z.boolean(),
  })
  .partial();
