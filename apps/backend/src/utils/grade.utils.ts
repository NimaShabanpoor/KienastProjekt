// Hilfsutilities für Notenberechnung
// Werden auch in Unit Tests verwendet

import { GRADE_LIMITS } from '../config/constants';

/**
 * Rundet einen Notenwert auf 0.5er-Schritte (Schweizer Konvention)
 * @param value Rohwert
 * @returns Gerundeter Wert
 */
export function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

/**
 * Prüft ob ein Notenwert gültig ist (1.0 - 6.0, 0.5er-Schritte)
 */
export function isValidSwissGrade(value: number): boolean {
  return (
    value >= GRADE_LIMITS.MIN &&
    value <= GRADE_LIMITS.MAX &&
    Math.round(value * 2) === value * 2
  );
}

/**
 * Berechnet gewichteten Durchschnitt aus Kategorien
 * @param categories Array von { average, weight }
 * @returns Gewichteter Durchschnitt (gerundet auf 0.5er) oder null
 */
export function calculateWeightedAverage(
  categories: Array<{ average: number; weight: number }>
): number | null {
  if (categories.length === 0) return null;

  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight === 0) return null;

  const weightedSum = categories.reduce((sum, c) => sum + c.average * c.weight, 0);
  return roundToHalf(weightedSum / totalWeight);
}

/**
 * Prüft Promotionsbedingungen
 * @param averages Array aller Fachdurchschnitte
 * @param rule Promotionsregel
 * @returns Promotionsergebnis
 */
export function checkPromotionConditions(
  averages: number[],
  rule: { minAverage: number; maxFailing: number }
): { passed: boolean; overallAverage: number; failingCount: number } {
  if (averages.length === 0) {
    return { passed: false, overallAverage: 0, failingCount: 0 };
  }

  const overallAverage =
    Math.round((averages.reduce((a, b) => a + b, 0) / averages.length) * 100) / 100;
  const failingCount = averages.filter((a) => a < GRADE_LIMITS.PASS_THRESHOLD).length;
  const passed = overallAverage >= rule.minAverage && failingCount <= rule.maxFailing;

  return { passed, overallAverage, failingCount };
}
