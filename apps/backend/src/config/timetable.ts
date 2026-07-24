// Standard-Tagesstruktur (als Seed, wenn noch nichts konfiguriert)

export interface StructureRowInput {
  type: 'LESSON' | 'BREAK';
  label: string;
  startTime?: string | null;
  endTime?: string | null;
}

export const DEFAULT_TIMETABLE_STRUCTURE: StructureRowInput[] = [
  { type: 'LESSON', label: '1. Lektion', startTime: '08:00', endTime: '08:45' },
  { type: 'LESSON', label: '2. Lektion', startTime: '08:45', endTime: '09:30' },
  { type: 'BREAK', label: 'Pause' },
  { type: 'LESSON', label: '3. Lektion', startTime: '09:50', endTime: '10:35' },
  { type: 'LESSON', label: '4. Lektion', startTime: '10:35', endTime: '11:20' },
  { type: 'BREAK', label: 'Mittagspause' },
  { type: 'LESSON', label: '5. Lektion', startTime: '13:00', endTime: '13:45' },
  { type: 'LESSON', label: '6. Lektion', startTime: '13:45', endTime: '14:30' },
  { type: 'BREAK', label: 'Pause' },
  { type: 'LESSON', label: '7. Lektion', startTime: '14:50', endTime: '15:35' },
  { type: 'LESSON', label: '8. Lektion', startTime: '15:35', endTime: '16:20' },
];

export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Mo',
  2: 'Di',
  3: 'Mi',
  4: 'Do',
  5: 'Fr',
};

export function toSchoolDayOfWeek(date: Date): number | null {
  const js = date.getDay();
  if (js === 0 || js === 6) return null;
  return js;
}
