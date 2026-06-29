// Zod-validierte Umgebungsvariablen
// Fehler beim Start wenn Pflichtfelder fehlen – kein Silent-Fail

import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Lokal: .env aus Backend-Ordner oder Monorepo-Root
// Produktion (Railway/Vercel): Variablen kommen aus der Plattform
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
}

const EnvSchema = z.object({
  // Datenbank (Railway MySQL: DATABASE_URL=${{MySQL.MYSQL_URL}})
  DATABASE_URL: z.string().min(1, 'DATABASE_URL ist erforderlich'),

  // JWT – mindestens 32 Zeichen für ausreichende Entropie
  JWT_SECRET: z.string().min(32, 'JWT_SECRET muss mindestens 32 Zeichen lang sein'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET muss mindestens 32 Zeichen lang sein'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // App
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  FRONTEND_URL: z.string().url('FRONTEND_URL muss eine gültige URL sein'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),

  // 2FA
  TOTP_APP_NAME: z.string().default('SchulAdmin'),
  TOTP_ISSUER: z.string().default('IT Bénédict Zürich'),

  // Absenzen-Schwellenwert
  ABSENCE_THRESHOLD: z.coerce.number().int().min(1).default(5),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE_PATH: z.string().default('./logs'),

  // Uploads (Railway Volume empfohlen: /app/uploads)
  UPLOAD_DIR: z.string().default('./uploads'),
});

// Validierung beim Modulstart – wirft Fehler bei ungültiger Konfiguration
const result = EnvSchema.safeParse(process.env);

if (!result.success) {
  console.error('Ungültige Umgebungsvariablen:');
  console.error(result.error.format());
  process.exit(1);
}

export const env = result.data;
