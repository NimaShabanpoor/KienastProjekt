// Zod-Validierungsschemas für Auth-Endpunkte
// Werden sowohl im Frontend als auch Backend verwendet

import { z } from 'zod';

// Login-Anfrage
export const LoginSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(8, 'Passwort muss mindestens 8 Zeichen lang sein'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

// 2FA-Verifizierung
export const TwoFactorVerifySchema = z.object({
  tempToken: z.string().min(1, 'Temporärer Token erforderlich'),
  totpCode: z
    .string()
    .length(6, 'TOTP-Code muss genau 6 Stellen haben')
    .regex(/^\d{6}$/, 'TOTP-Code darf nur Ziffern enthalten'),
});

export type TwoFactorVerifyInput = z.infer<typeof TwoFactorVerifySchema>;

// 2FA-Bestätigung (Setup abschliessen)
export const TwoFactorConfirmSchema = z.object({
  totpCode: z
    .string()
    .length(6, 'TOTP-Code muss genau 6 Stellen haben')
    .regex(/^\d{6}$/, 'TOTP-Code darf nur Ziffern enthalten'),
});

export type TwoFactorConfirmInput = z.infer<typeof TwoFactorConfirmSchema>;

// Passwort-Änderung
export const ChangePasswordSchema = z
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

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
