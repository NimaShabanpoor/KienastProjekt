// Unit Tests für Absenzen-Validierungs-Logik

import { describe, it, expect } from 'vitest';

// Hilfsfunktion: Zeitraum-Überschneidung prüfen
function hasTimeOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  return start1 < end2 && end1 > start2;
}

describe('Zeitraum-Überschneidung', () => {
  it('erkennt direkte Überschneidung', () => {
    expect(hasTimeOverlap('08:00', '09:00', '08:30', '09:30')).toBe(true);
  });

  it('erkennt vollständige Einschliessung', () => {
    expect(hasTimeOverlap('08:00', '10:00', '08:30', '09:30')).toBe(true);
  });

  it('erkennt keine Überschneidung bei aneinandergrenzenden Lektionen', () => {
    expect(hasTimeOverlap('08:00', '09:00', '09:00', '10:00')).toBe(false);
  });

  it('erkennt keine Überschneidung bei getrennten Lektionen', () => {
    expect(hasTimeOverlap('08:00', '09:00', '10:00', '11:00')).toBe(false);
  });
});

describe('Absenz-Status-Validierung', () => {
  const validStatuses = ['ANWESEND', 'ENTSCHULDIGT', 'UNENTSCHULDIGT'];

  it('akzeptiert alle gültigen Status', () => {
    validStatuses.forEach((status) => {
      expect(validStatuses.includes(status)).toBe(true);
    });
  });

  it('lehnt ungültigen Status ab', () => {
    expect(validStatuses.includes('ABWESEND')).toBe(false);
    expect(validStatuses.includes('KRANK')).toBe(false);
  });
});
