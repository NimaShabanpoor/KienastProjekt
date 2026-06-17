// Globale Konstanten – keine Magic Numbers im Code
// Alle konfigurierbaren Werte hier zentralisiert

// JWT-Konfiguration
export const JWT_CONSTANTS = {
  // Temp-Token für 2FA-Zwischenschritt: 15 Minuten
  TEMP_TOKEN_EXPIRES_IN: '15m',
  // 2FA-TOTP-Toleranzfenster (Anzahl 30s-Perioden)
  TOTP_WINDOW: 1,
} as const;

// Passwort-Hashing
export const BCRYPT_ROUNDS = 12;

// Backup-Codes für 2FA
export const BACKUP_CODE_CONFIG = {
  COUNT: 8,       // Anzahl Backup-Codes
  LENGTH: 10,     // Länge jedes Codes
} as const;

// Paginierung
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// Noten-Grenzen (Schweizer Skala)
export const GRADE_LIMITS = {
  MIN: 1.0,
  MAX: 6.0,
  PASS_THRESHOLD: 4.0,   // Mindestbestehensnote
  STEP: 0.5,             // Rundungsschritt
} as const;

// Absenzen
export const ABSENCE_CONSTANTS = {
  // Standard-Schwellenwert für Alarm (wird durch Config überschrieben)
  DEFAULT_THRESHOLD: 5,
  // Cooldown für Benachrichtigungen (7 Tage in Millisekunden)
  NOTIFICATION_COOLDOWN_MS: 7 * 24 * 60 * 60 * 1000,
} as const;

// AuditLog-Aktionen
export const AUDIT_ACTIONS = {
  GRADE_CREATED: 'GRADE_CREATED',
  GRADE_CORRECTED: 'GRADE_CORRECTED',
  STUDENT_ACTIVATED: 'STUDENT_ACTIVATED',
  STUDENT_DEACTIVATED: 'STUDENT_DEACTIVATED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  USER_ACTIVATED: 'USER_ACTIVATED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  LESSON_CANCELLED: 'LESSON_CANCELLED',
  TIMETABLE_IMPORTED: 'TIMETABLE_IMPORTED',
  ABSENCE_UPDATED: 'ABSENCE_UPDATED',
  ABSENCE_CREATED: 'ABSENCE_CREATED',
  PROMOTION_RULE_CHANGED: 'PROMOTION_RULE_CHANGED',
  USER_2FA_RESET: 'USER_2FA_RESET',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
