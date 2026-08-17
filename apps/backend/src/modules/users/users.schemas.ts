// Zod-Schemas für Benutzer-Validierung
// Verhindert Mass-Assignment: nur diese Felder erreichen den Service/Prisma.

import { z } from 'zod';
import { Role } from '@prisma/client';

export const CreateUserBodySchema = z.object({
  email: z.string().email('Ungültige E-Mail').max(255),
  firstName: z.string().min(1, 'Vorname erforderlich').max(100),
  lastName: z.string().min(1, 'Nachname erforderlich').max(100),
  role: z.nativeEnum(Role),
  password: z.string().min(12, 'Passwort muss mindestens 12 Zeichen haben').max(200),
});

export const UpdateUserBodySchema = z
  .object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    email: z.string().email('Ungültige E-Mail').max(255),
    role: z.nativeEnum(Role),
  })
  .partial();
