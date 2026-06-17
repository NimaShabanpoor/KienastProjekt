// Auth-Service: Geschäftslogik für Authentifizierung
// Login, 2FA-Setup, 2FA-Verify, Token-Refresh, Logout

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import crypto from 'crypto';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { ApiError } from '../../middleware/errorHandler.middleware';
import { BCRYPT_ROUNDS, BACKUP_CODE_CONFIG, JWT_CONSTANTS } from '../../config/constants';
import { Role } from '@prisma/client';

// Token-Payload-Interfaces
interface AccessTokenPayload {
  sub: string;
  role: Role;
}

interface TempTokenPayload {
  sub: string;
  purpose: '2fa';
}

interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
}

// --------------------------------------------------------
// LOGIN
// --------------------------------------------------------
export async function login(email: string, password: string) {
  // Benutzer suchen (inkl. inaktive prüfen)
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.isActive) {
    // Gleiche Fehlermeldung für nicht-existierende und deaktivierte Benutzer
    // (Verhindert User-Enumeration-Angriffe)
    throw new ApiError(
      'Ungültige Anmeldedaten.',
      'INVALID_CREDENTIALS',
      401
    );
  }

  // Passwort prüfen
  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    throw new ApiError('Ungültige Anmeldedaten.', 'INVALID_CREDENTIALS', 401);
  }

  // 2FA aktiviert: Temp-Token zurückgeben
  if (user.totpEnabled && user.totpSecret) {
    const tempToken = jwt.sign(
      { sub: user.id, purpose: '2fa' } satisfies TempTokenPayload,
      env.JWT_SECRET,
      { expiresIn: JWT_CONSTANTS.TEMP_TOKEN_EXPIRES_IN }
    );

    return {
      requiresTOTP: true as const,
      tempToken,
      user: { id: user.id, totpEnabled: true },
    };
  }

  // Kein 2FA: Direkt Tokens ausstellem
  const { accessToken, refreshToken } = await issueTokens(user.id, user.role);

  // Letzten Login aktualisieren
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  logger.info('Benutzer angemeldet', { userId: user.id, email: user.email });

  return {
    requiresTOTP: false as const,
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      totpEnabled: user.totpEnabled,
    },
  };
}

// --------------------------------------------------------
// 2FA VERIFIZIEREN (nach Login mit tempToken)
// --------------------------------------------------------
export async function verify2FA(tempToken: string, totpCode: string) {
  // Temp-Token verifizieren
  let payload: TempTokenPayload;
  try {
    payload = jwt.verify(tempToken, env.JWT_SECRET) as TempTokenPayload;
  } catch {
    throw new ApiError('Ungültiger oder abgelaufener Token.', 'INVALID_TOKEN', 401);
  }

  if (payload.purpose !== '2fa') {
    throw new ApiError('Ungültiger Token-Typ.', 'INVALID_TOKEN', 401);
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive || !user.totpSecret) {
    throw new ApiError('Benutzer nicht gefunden.', 'USER_NOT_FOUND', 404);
  }

  // TOTP-Code prüfen
  const valid = speakeasy.totp.verify({
    secret: user.totpSecret,
    encoding: 'base32',
    token: totpCode,
    window: JWT_CONSTANTS.TOTP_WINDOW,
  });

  if (!valid) {
    throw new ApiError('Ungültiger 2FA-Code.', 'INVALID_TOTP', 401);
  }

  const { accessToken, refreshToken } = await issueTokens(user.id, user.role);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  logger.info('2FA erfolgreich verifiziert', { userId: user.id });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      totpEnabled: user.totpEnabled,
    },
  };
}

// --------------------------------------------------------
// 2FA SETUP – QR-Code und Backup-Codes generieren
// --------------------------------------------------------
export async function setup2FA(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError('Benutzer nicht gefunden.', 'USER_NOT_FOUND', 404);

  if (user.totpEnabled) {
    throw new ApiError(
      '2FA ist bereits aktiv. Bitte erst zurücksetzen.',
      '2FA_ALREADY_ENABLED',
      409
    );
  }

  // TOTP-Secret generieren
  const secret = speakeasy.generateSecret({
    name: `${env.TOTP_APP_NAME} (${user.email})`,
    issuer: env.TOTP_ISSUER,
    length: 20,
  });

  // QR-Code als Data-URL generieren
  const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url ?? '');

  // Backup-Codes generieren (noch nicht in DB speichern – erst nach Confirm)
  const backupCodes = generateBackupCodes();

  // Secret temporär in DB speichern (noch nicht aktiviert)
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: secret.base32 },
  });

  logger.info('2FA-Setup initiiert', { userId });

  return {
    qrCodeUrl,
    secret: secret.base32, // Nur für manuelle Eingabe
    backupCodes, // Im Klartext anzeigen – danach nicht mehr abrufbar!
  };
}

// --------------------------------------------------------
// 2FA BESTÄTIGEN – Setup abschliessen
// --------------------------------------------------------
export async function confirm2FA(userId: string, totpCode: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.totpSecret) {
    throw new ApiError(
      '2FA-Setup nicht initiiert. Bitte erst /2fa/setup aufrufen.',
      '2FA_NOT_SETUP',
      400
    );
  }

  // Code gegen temporär gespeichertes Secret prüfen
  const valid = speakeasy.totp.verify({
    secret: user.totpSecret,
    encoding: 'base32',
    token: totpCode,
    window: JWT_CONSTANTS.TOTP_WINDOW,
  });

  if (!valid) {
    throw new ApiError(
      'Ungültiger 2FA-Code. Bitte Authenticator-App prüfen.',
      'INVALID_TOTP',
      401
    );
  }

  // Neue Backup-Codes erstellen und hashen
  const plainBackupCodes = generateBackupCodes();
  const hashedBackupCodes = await Promise.all(
    plainBackupCodes.map((code) => bcrypt.hash(code, BCRYPT_ROUNDS))
  );

  // 2FA aktivieren und Backup-Codes speichern
  await prisma.user.update({
    where: { id: userId },
    data: {
      totpEnabled: true,
      backupCodes: JSON.stringify(hashedBackupCodes),
    },
  });

  logger.info('2FA aktiviert', { userId });

  return { backupCodes: plainBackupCodes };
}

// --------------------------------------------------------
// TOKEN REFRESH
// --------------------------------------------------------
export async function refreshAccessToken(refreshToken: string) {
  let payload: RefreshTokenPayload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  } catch {
    throw new ApiError('Ungültiger oder abgelaufener Refresh-Token.', 'INVALID_REFRESH_TOKEN', 401);
  }

  if (payload.type !== 'refresh') {
    throw new ApiError('Ungültiger Token-Typ.', 'INVALID_TOKEN', 401);
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) {
    throw new ApiError('Benutzer nicht gefunden oder deaktiviert.', 'USER_NOT_FOUND', 401);
  }

  // Refresh-Token gegen gespeicherten Hash prüfen (Token-Rotation-Sicherheit)
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  if (user.refreshTokenHash !== tokenHash) {
    logger.warn('Refresh-Token-Wiederverwendung erkannt!', { userId: user.id });
    throw new ApiError('Ungültiger Refresh-Token.', 'INVALID_REFRESH_TOKEN', 401);
  }

  const { accessToken, refreshToken: newRefreshToken } = await issueTokens(user.id, user.role);

  return { accessToken, refreshToken: newRefreshToken };
}

// --------------------------------------------------------
// LOGOUT
// --------------------------------------------------------
export async function logout(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshTokenHash: null },
  });
  logger.info('Benutzer abgemeldet', { userId });
}

// --------------------------------------------------------
// AKTUELLEM BENUTZER LADEN
// --------------------------------------------------------
export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      totpEnabled: true,
      lastLoginAt: true,
    },
  });

  if (!user) throw new ApiError('Benutzer nicht gefunden.', 'USER_NOT_FOUND', 404);
  return user;
}

// --------------------------------------------------------
// HILFSFUNKTIONEN
// --------------------------------------------------------

// Access + Refresh Token ausstellen und Refresh-Hash in DB speichern
async function issueTokens(userId: string, role: Role) {
  const accessToken = jwt.sign(
    { sub: userId, role } satisfies AccessTokenPayload,
    env.JWT_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
  );

  const refreshToken = jwt.sign(
    { sub: userId, type: 'refresh' } satisfies RefreshTokenPayload,
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
  );

  // SHA256-Hash des Refresh-Tokens in DB speichern
  const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await prisma.user.update({
    where: { id: userId },
    data: { refreshTokenHash },
  });

  return { accessToken, refreshToken };
}

// Zufällige Backup-Codes generieren
function generateBackupCodes(): string[] {
  return Array.from({ length: BACKUP_CODE_CONFIG.COUNT }, () =>
    crypto
      .randomBytes(Math.ceil(BACKUP_CODE_CONFIG.LENGTH / 2))
      .toString('hex')
      .slice(0, BACKUP_CODE_CONFIG.LENGTH)
      .toUpperCase()
  );
}
