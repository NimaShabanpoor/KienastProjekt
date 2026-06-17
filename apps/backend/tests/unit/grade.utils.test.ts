// Unit Tests für Notenberechnungs-Utilities
// Vitest-Framework

import { describe, it, expect } from 'vitest';
import {
  roundToHalf,
  isValidSwissGrade,
  calculateWeightedAverage,
  checkPromotionConditions,
} from '../../src/utils/grade.utils';

describe('roundToHalf', () => {
  it('rundet 4.25 auf 4.5', () => {
    expect(roundToHalf(4.25)).toBe(4.5);
  });

  it('rundet 4.74 auf 4.5', () => {
    expect(roundToHalf(4.74)).toBe(4.5);
  });

  it('rundet 4.75 auf 5.0', () => {
    expect(roundToHalf(4.75)).toBe(5.0);
  });

  it('lässt 4.0 unverändert', () => {
    expect(roundToHalf(4.0)).toBe(4.0);
  });
});

describe('isValidSwissGrade', () => {
  it('akzeptiert gültige Noten (1.0 - 6.0, 0.5er-Schritte)', () => {
    expect(isValidSwissGrade(1.0)).toBe(true);
    expect(isValidSwissGrade(4.5)).toBe(true);
    expect(isValidSwissGrade(6.0)).toBe(true);
  });

  it('lehnt Noten ausserhalb des Bereichs ab', () => {
    expect(isValidSwissGrade(0.5)).toBe(false);
    expect(isValidSwissGrade(6.5)).toBe(false);
  });

  it('lehnt Noten ohne 0.5er-Schritte ab', () => {
    expect(isValidSwissGrade(4.3)).toBe(false);
    expect(isValidSwissGrade(5.1)).toBe(false);
  });
});

describe('calculateWeightedAverage', () => {
  it('berechnet gewichteten Durchschnitt korrekt', () => {
    // Prüfung (60%): Note 5.0, Hausaufgaben (40%): Note 4.0
    // Erwartet: 5.0 * 0.6 + 4.0 * 0.4 = 3.0 + 1.6 = 4.6 → gerundet 4.5
    const result = calculateWeightedAverage([
      { average: 5.0, weight: 0.6 },
      { average: 4.0, weight: 0.4 },
    ]);
    expect(result).toBe(4.5);
  });

  it('gibt null zurück bei leerer Liste', () => {
    expect(calculateWeightedAverage([])).toBeNull();
  });

  it('gibt null zurück bei Gesamtgewicht 0', () => {
    expect(calculateWeightedAverage([{ average: 5.0, weight: 0 }])).toBeNull();
  });
});

describe('checkPromotionConditions', () => {
  const rule = { minAverage: 4.0, maxFailing: 1 };

  it('bestanden: Durchschnitt >= 4.0, max. 1 Fach unter 4.0', () => {
    const result = checkPromotionConditions([5.0, 4.5, 3.5, 4.0], rule);
    expect(result.passed).toBe(true);
    expect(result.failingCount).toBe(1);
  });

  it('nicht bestanden: Durchschnitt unter 4.0', () => {
    const result = checkPromotionConditions([3.0, 3.5, 4.0], rule);
    expect(result.passed).toBe(false);
  });

  it('nicht bestanden: mehr als 1 Fach unter 4.0', () => {
    const result = checkPromotionConditions([5.0, 3.5, 3.0, 4.0], rule);
    expect(result.passed).toBe(false);
    expect(result.failingCount).toBe(2);
  });
});
