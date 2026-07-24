// Zod-Schemas für Auth-Endpunkte (Backend-spezifisch)

import { z } from 'zod';

export const LoginBodySchema = z.object({
  email: z
    .string()
    .email('Ungültige E-Mail-Adresse')
    .transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1, 'Passwort erforderlich'),
});

export const TwoFactorVerifyBodySchema = z.object({
  tempToken: z.string().min(1, 'Temporärer Token erforderlich'),
  totpCode: z
    .string()
    .length(6, 'TOTP-Code muss genau 6 Stellen haben')
    .regex(/^\d{6}$/, 'TOTP-Code darf nur Ziffern enthalten'),
});

export const TwoFactorConfirmBodySchema = z.object({
  totpCode: z
    .string()
    .length(6, 'TOTP-Code muss genau 6 Stellen haben')
    .regex(/^\d{6}$/, 'TOTP-Code darf nur Ziffern enthalten'),
});

export const ChangePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1, 'Aktuelles Passwort erforderlich'),
    newPassword: z
      .string()
      .min(12, 'Neues Passwort muss mindestens 12 Zeichen lang sein')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
        'Passwort muss Gross-/Kleinbuchstaben, Zahl und Sonderzeichen enthalten'
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwörter stimmen nicht überein',
    path: ['confirmPassword'],
  });
