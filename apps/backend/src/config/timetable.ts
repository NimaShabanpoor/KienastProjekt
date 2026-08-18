// Standard-Tagesstruktur (als Seed, wenn noch nichts konfiguriert)

export interface StructureRowInput {
  type: 'LESSON' | 'BREAK';
  label: string;
  startTime?: string | null;
  endTime?: string | null;
}

export const DEFAULT_TIMETABLE_STRUCTURE: StructureRowInput[] = [
  { type: 'LESSON', label: '1. Lektion', startTime: '07:20', endTime: '08:05' },
  { type: 'LESSON', label: '2. Lektion', startTime: '08:15', endTime: '09:00' },
  { type: 'LESSON', label: '3. Lektion', startTime: '09:10', endTime: '09:55' },
  { type: 'BREAK', label: 'Pause', startTime: '09:55', endTime: '10:15' },
  { type: 'LESSON', label: '4. Lektion', startTime: '10:15', endTime: '11:00' },
  { type: 'LESSON', label: '5. Lektion', startTime: '11:10', endTime: '11:55' },
  { type: 'LESSON', label: '6. Lektion', startTime: '12:05', endTime: '12:50' },
  { type: 'BREAK', label: 'Mittagspause', startTime: '12:50', endTime: '13:00' },
  { type: 'LESSON', label: '7. Lektion', startTime: '13:00', endTime: '13:45' },
  { type: 'LESSON', label: '8. Lektion', startTime: '13:55', endTime: '14:40' },
  { type: 'LESSON', label: '9. Lektion', startTime: '14:55', endTime: '15:40' },
  { type: 'LESSON', label: '10. Lektion', startTime: '15:50', endTime: '16:35' },
  { type: 'LESSON', label: '11. Lektion', startTime: '16:45', endTime: '17:30' },
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
