// Tageszeiten kommen aus der API (/timetable/structure).
// Diese Konstanten dienen nur noch als Fallback / Typ-Referenz.

export interface TimetablePeriod {
  period: number;
  startTime: string;
  endTime: string;
  label: string;
}

/** Fallback, falls die API noch keine Struktur liefert */
export const TIMETABLE_PERIODS: TimetablePeriod[] = [
  { period: 1, startTime: '08:00', endTime: '08:45', label: '1. Lektion' },
  { period: 2, startTime: '08:45', endTime: '09:30', label: '2. Lektion' },
  { period: 3, startTime: '09:50', endTime: '10:35', label: '3. Lektion' },
  { period: 4, startTime: '10:35', endTime: '11:20', label: '4. Lektion' },
  { period: 5, startTime: '13:00', endTime: '13:45', label: '5. Lektion' },
  { period: 6, startTime: '13:45', endTime: '14:30', label: '6. Lektion' },
  { period: 7, startTime: '14:50', endTime: '15:35', label: '7. Lektion' },
  { period: 8, startTime: '15:35', endTime: '16:20', label: '8. Lektion' },
];

export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Mo',
  2: 'Di',
  3: 'Mi',
  4: 'Do',
  5: 'Fr',
};

export function getPeriod(period: number): TimetablePeriod | undefined {
  return TIMETABLE_PERIODS.find((p) => p.period === period);
}

/** JS getDay(): 0=So … → Schul-dayOfWeek 1=Mo … 5=Fr, sonst null */
export function toSchoolDayOfWeek(date: Date): number | null {
  const js = date.getDay();
  if (js === 0 || js === 6) return null;
  return js;
}
