// Absenzen-Erfassungsseite (Lehrer)
// Pro Schüler: Dropdown «X von N Lektionen anwesend»

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import type { Lesson, Student } from '@schuladmin/shared';
import { AbsenceStatus } from '@schuladmin/shared';
import { usePermissions } from '../../hooks/usePermissions';

type LessonBlock = {
  key: string;
  subjectName: string;
  classId: string;
  className: string;
  lessons: Lesson[];
};

function lessonLabel(count: number): string {
  if (count === 0) return '0 Lektionen anwesend';
  if (count === 1) return '1 Lektion anwesend';
  return `${count} Lektionen anwesend`;
}

export default function AbsencesPage() {
  const queryClient = useQueryClient();
  const { isTeacher } = usePermissions();
  const [selectedBlockKey, setSelectedBlockKey] = useState('');
  /** studentId → Anzahl Lektionen anwesend */
  const [presentCounts, setPresentCounts] = useState<Record<string, number>>({});

  const today = new Date().toISOString().split('T')[0]!;

  const { data: lessons } = useQuery({
    queryKey: ['lessons-today', today],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Lesson[] }>(
        `/api/v1/lessons?dateFrom=${today}&dateTo=${today}`
      );
      return data.data
        .filter((l) => !l.isCancelled)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
    },
  });

  const blocks = useMemo((): LessonBlock[] => {
    const map = new Map<string, LessonBlock>();
    for (const lesson of lessons ?? []) {
      const classId = lesson.subject?.class?.id ?? 'unknown';
      const subjectId = lesson.subjectId;
      const key = `${classId}:${subjectId}`;
      const existing = map.get(key);
      if (existing) {
        existing.lessons.push(lesson);
      } else {
        map.set(key, {
          key,
          subjectName: lesson.subject?.name ?? 'Fach',
          classId,
          className: lesson.subject?.class?.name ?? '–',
          lessons: [lesson],
        });
      }
    }
    return [...map.values()].map((b) => ({
      ...b,
      lessons: [...b.lessons].sort((a, c) => a.startTime.localeCompare(c.startTime)),
    }));
  }, [lessons]);

  const selectedBlock = blocks.find((b) => b.key === selectedBlockKey);
  const lessonIds = selectedBlock?.lessons.map((l) => l.id) ?? [];
  const maxLessons = lessonIds.length;

  const { data: students } = useQuery({
    queryKey: ['students', selectedBlock?.classId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Student[] }>(
        `/api/v1/students?classId=${selectedBlock!.classId}`
      );
      return data.data;
    },
    enabled: !!selectedBlock?.classId,
  });

  const setPresentCount = (studentId: string, count: number): void => {
    setPresentCounts((prev) => ({
      ...prev,
      [studentId]: Math.min(Math.max(count, 0), maxLessons),
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBlock || lessonIds.length === 0) {
        throw new Error('Keine Lektionen ausgewählt');
      }
      const entries = (students ?? []).map((s) => {
        const presentLessonCount = presentCounts[s.id] ?? maxLessons;
        return {
          studentId: s.id,
          status:
            presentLessonCount === maxLessons
              ? AbsenceStatus.ANWESEND
              : AbsenceStatus.UNENTSCHULDIGT,
          presentLessonCount,
        };
      });
      await apiClient.post('/api/v1/absences', {
        lessonIds,
        absences: entries,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['absences'] });
    },
  });

  if (!isTeacher) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Absenzen erfassen</h1>
        <p className="text-neutral-500">
          Als Leiter erfasst du keine Anwesenheit. Nutze stattdessen{' '}
          <a href="/absences/excuse" className="text-brand-red underline">
            Absenzen entschuldigen
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-neutral-900 mb-1">Anwesenheit erfassen</h1>
      <p className="text-sm text-neutral-500 mb-4">
        Wähle das Fach / den Block und gib pro Schüler an, in wie vielen Lektionen er anwesend war.
      </p>

      <div className="mb-6">
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Fach / Lektionsblock (heute)
        </label>
        <select
          value={selectedBlockKey}
          onChange={(e) => {
            setSelectedBlockKey(e.target.value);
            setPresentCounts({});
          }}
          className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
        >
          <option value="">-- Block auswählen --</option>
          {blocks.map((block) => (
            <option key={block.key} value={block.key}>
              {block.subjectName} · Klasse {block.className} · {block.lessons.length}{' '}
              Lektion{block.lessons.length === 1 ? '' : 'en'} (
              {block.lessons.map((l) => `${l.startTime}–${l.endTime}`).join(', ')})
            </option>
          ))}
        </select>
        {blocks.length === 0 && (
          <p className="text-sm text-amber-600 mt-2">
            Keine Lektionen für heute – der Leiter muss den Stundenplan pflegen.
          </p>
        )}
        {selectedBlock && (
          <p className="text-xs text-neutral-500 mt-2">
            Für diesen Block: {maxLessons} Lektion{maxLessons === 1 ? '' : 'en'}. Pro Schüler wählst
            du, wie viele davon anwesend waren (z.&nbsp;B. 1 von 2 = erste Lektion da, zweite nicht).
          </p>
        )}
      </div>

      {selectedBlock && students && (
        <div className="space-y-3">
          {students.map((student) => {
            const presentCount = presentCounts[student.id] ?? maxLessons;
            return (
              <div
                key={student.id}
                className="bg-white rounded-xl border border-neutral-200 p-4"
              >
                <p className="font-medium text-neutral-900 mb-3">
                  {student.lastName}, {student.firstName}
                </p>
                <label className="block text-sm text-neutral-600 mb-1">
                  Anwesend in wie vielen Lektionen?
                </label>
                <select
                  value={presentCount}
                  onChange={(e) => setPresentCount(student.id, Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
                >
                  {Array.from({ length: maxLessons + 1 }, (_, i) => (
                    <option key={i} value={i}>
                      {lessonLabel(i)}
                      {i < maxLessons ? ` (von ${maxLessons})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || maxLessons === 0}
            className="w-full bg-brand-red hover:bg-brand-red-dark text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50 mt-4"
          >
            {saveMutation.isPending ? 'Speichern...' : 'Anwesenheit speichern'}
          </button>

          {saveMutation.isSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <p className="text-green-700 text-sm font-medium">Anwesenheit gespeichert!</p>
            </div>
          )}
          {saveMutation.isError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
              <p className="text-red-700 text-sm font-medium">
                Speichern fehlgeschlagen. Bitte erneut versuchen.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
