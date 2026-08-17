// Zod-Schemas für Klassen-Validierung
// Verhindert Mass-Assignment: nur diese Felder erreichen den Service/Prisma.

import { z } from 'zod';

export const CreateClassBodySchema = z.object({
  name: z.string().min(1, 'Name erforderlich').max(50),
  semester: z.number().int().min(1).max(2),
  schoolYear: z
    .string()
    .regex(/^\d{4}\/\d{2}$/, 'Schuljahr muss das Format YYYY/YY haben'),
  homeroomTeacherId: z.string().cuid('Ungültige Lehrpersonen-ID').nullable().optional(),
});

export const UpdateClassBodySchema = CreateClassBodySchema.partial();
