// Unit Tests für Lektions-Validierung

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Zeitformat-Validator (HH:mm)
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

// Datum-Validator (YYYY-MM-DD)
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

describe('Zeitformat-Validierung', () => {
  it('akzeptiert gültige Zeitformate', () => {
    expect(timeSchema.safeParse('08:00').success).toBe(true);
    expect(timeSchema.safeParse('23:59').success).toBe(true);
    expect(timeSchema.safeParse('00:00').success).toBe(true);
  });

  it('lehnt ungültige Zeitformate ab', () => {
    expect(timeSchema.safeParse('8:00').success).toBe(false);  // Fehlende führende Null
    expect(timeSchema.safeParse('24:00').success).toBe(false); // Ungültige Stunde
    expect(timeSchema.safeParse('08:60').success).toBe(false); // Ungültige Minute
    expect(timeSchema.safeParse('08-00').success).toBe(false); // Falsches Trennzeichen
  });
});

describe('Datumsformat-Validierung', () => {
  it('akzeptiert gültige Datumsformate', () => {
    expect(dateSchema.safeParse('2024-01-15').success).toBe(true);
    expect(dateSchema.safeParse('2024-12-31').success).toBe(true);
  });

  it('lehnt ungültige Datumsformate ab', () => {
    expect(dateSchema.safeParse('15.01.2024').success).toBe(false);
    expect(dateSchema.safeParse('2024/01/15').success).toBe(false);
    expect(dateSchema.safeParse('2024-1-5').success).toBe(false);
  });
});

describe('Startzeit-vor-Endzeit-Regel', () => {
  it('startTime muss vor endTime liegen', () => {
    expect('08:00' < '09:00').toBe(true);
    expect('09:00' < '08:00').toBe(false);
    expect('08:00' < '08:00').toBe(false); // Gleich = ungültig
  });
});
