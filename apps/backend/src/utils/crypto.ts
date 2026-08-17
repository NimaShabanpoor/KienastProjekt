// Verschlüsselung sensibler Werte im Ruhezustand (at rest), z. B. TOTP-Secrets.
// AES-256-GCM (authentifizierte Verschlüsselung).
// nDSG: 2FA-Secrets dürfen nicht im Klartext in der Datenbank liegen.

import crypto from 'crypto';
import { env } from '../config/env';

const PREFIX = 'enc:v1:';

// 32-Byte-Schlüssel deterministisch ableiten. Bevorzugt ENCRYPTION_KEY,
// sonst Ableitung aus dem JWT_SECRET (kein zwingend neuer Env-Wert nötig).
const key = crypto.scryptSync(
  env.ENCRYPTION_KEY ?? env.JWT_SECRET,
  'schuladmin-totp-v1',
  32
);

/** Verschlüsselt einen Klartext und gibt einen selbstbeschreibenden String zurück. */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

/**
 * Entschlüsselt einen zuvor mit encryptSecret erzeugten Wert.
 * Werte ohne Prefix werden als Alt-Bestand (Klartext) unverändert zurückgegeben,
 * damit bestehende Enrolments nicht brechen.
 */
export function decryptSecret(value: string): string {
  if (!value.startsWith(PREFIX)) return value; // Legacy-Klartext
  const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Ungültiges Chiffrat-Format.');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivB64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}
