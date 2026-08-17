// Unit Tests für die echten Lektions-Zod-Schemas (Produktionscode)

import { describe, it, expect } from 'vitest';
import {
  CreateLessonBodySchema,
  UpdateLessonBodySchema,
} from '../../src/modules/lessons/lessons.schemas';

const validCuid = 'clh1234567890abcdefghijkl';

const base = {
  subjectId: validCuid,
  date: '2024-09-01',
  startTime: '08:00',
  endTime: '08:45',
};

describe('CreateLessonBodySchema', () => {
  it('akzeptiert eine gültige Lektion', () => {
    expect(CreateLessonBodySchema.safeParse(base).success).toBe(true);
  });

  it('lehnt Startzeit >= Endzeit ab', () => {
    expect(CreateLessonBodySchema.safeParse({ ...base, startTime: '09:00', endTime: '08:00' }).success).toBe(false);
    expect(CreateLessonBodySchema.safeParse({ ...base, startTime: '08:00', endTime: '08:00' }).success).toBe(false);
  });

  it('lehnt ungültige Zeitformate ab', () => {
    expect(CreateLessonBodySchema.safeParse({ ...base, startTime: '8:00' }).success).toBe(false);
    expect(CreateLessonBodySchema.safeParse({ ...base, endTime: '24:00' }).success).toBe(false);
  });

  it('lehnt ein ungültiges Datumsformat ab', () => {
    expect(CreateLessonBodySchema.safeParse({ ...base, date: '01.09.2024' }).success).toBe(false);
  });

  it('lehnt eine ungültige Fach-ID ab', () => {
    expect(CreateLessonBodySchema.safeParse({ ...base, subjectId: 'nicht-cuid' }).success).toBe(false);
  });
});

describe('UpdateLessonBodySchema', () => {
  it('akzeptiert ein Teil-Update nur mit Raum', () => {
    expect(UpdateLessonBodySchema.safeParse({ room: 'B12' }).success).toBe(true);
  });

  it('lehnt ein Teil-Update mit invertierten Zeiten ab', () => {
    expect(UpdateLessonBodySchema.safeParse({ startTime: '10:00', endTime: '09:00' }).success).toBe(false);
  });

  it('akzeptiert ein Teil-Update mit nur einer Zeitangabe (Cross-Feld-Prüfung erfolgt im Service)', () => {
    // Das Schema kann startTime allein nicht gegen die bestehende endTime prüfen –
    // diese Prüfung übernimmt lessons.service.updateLesson.
    expect(UpdateLessonBodySchema.safeParse({ startTime: '07:30' }).success).toBe(true);
  });
});
