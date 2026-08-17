// Unit Tests für die Verschlüsselung sensibler Werte (echter Produktionscode)

import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret } from '../../src/utils/crypto';

describe('encryptSecret / decryptSecret', () => {
  it('verschlüsselt und entschlüsselt verlustfrei (Round-Trip)', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP';
    const cipher = encryptSecret(plaintext);
    expect(cipher).not.toBe(plaintext);
    expect(cipher.startsWith('enc:v1:')).toBe(true);
    expect(decryptSecret(cipher)).toBe(plaintext);
  });

  it('erzeugt bei gleichem Klartext unterschiedliche Chiffrate (zufälliger IV)', () => {
    const a = encryptSecret('same-secret-value');
    const b = encryptSecret('same-secret-value');
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe('same-secret-value');
    expect(decryptSecret(b)).toBe('same-secret-value');
  });

  it('gibt Alt-Bestände im Klartext unverändert zurück (Rückwärtskompatibilität)', () => {
    const legacyPlaintext = 'PLAINTEXTSECRET123';
    expect(decryptSecret(legacyPlaintext)).toBe(legacyPlaintext);
  });

  it('erkennt Manipulation am Chiffrat (Auth-Tag)', () => {
    const cipher = encryptSecret('tamper-me');
    // Letztes Zeichen des Datenteils verändern
    const tampered = cipher.slice(0, -2) + (cipher.endsWith('A') ? 'B=' : 'A=');
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
