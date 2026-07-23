// Absenzen-Erfassungsseite (Lehrer)
// Liste: Name (A–Z) | Anwesend / Nicht anwesend | Lektionen-Dropdown

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import type { Lesson, Student } from '@schuladmin/shared';
import { AbsenceStatus } from '@schuladmin/shared';
import { usePermissions } from '../../hooks/usePermissions';
import { CheckCircle2, XCircle } from 'lucide-react';

type LessonBlock = {
  key: string;
  subjectName: string;
  classId: string;
  className: string;
  lessons: Lesson[];
};

export default function AbsencesPage() {
  const queryClient = useQueryClient();
  const { isTeacher } = usePermissions();
  const [selectedBlockKey, setSelectedBlockKey] = useState('');
  /** studentId → Anzahl Lektionen anwesend (0 … max) */
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

  const sortedStudents = useMemo(() => {
    return [...(students ?? [])].sort((a, b) => {
      const byLast = a.lastName.localeCompare(b.lastName, 'de');
      if (byLast !== 0) return byLast;
      return a.firstName.localeCompare(b.firstName, 'de');
    });
  }, [students]);

  const getPresentCount = (studentId: string): number =>
    presentCounts[studentId] ?? maxLessons;

  const setFullyPresent = (studentId: string): void => {
    setPresentCounts((prev) => ({ ...prev, [studentId]: maxLessons }));
  };

  const setNotFullyPresent = (studentId: string): void => {
    setPresentCounts((prev) => {
      const current = prev[studentId] ?? maxLessons;
      return { ...prev, [studentId]: current >= maxLessons ? 0 : current };
    });
  };

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
      const entries = sortedStudents.map((s) => {
        const presentLessonCount = getPresentCount(s.id);
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
      <div className="p-6 max-w-4xl mx-auto text-center">
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
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-neutral-900 mb-1">Anwesenheit erfassen</h1>
      <p className="text-sm text-neutral-500 mb-4">
        Fach wählen, dann pro Schüler Anwesend / Nicht anwesend und ggf. die Lektionenanzahl.
      </p>

      <div className="mb-5">
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
      </div>

      {selectedBlock && sortedStudents.length > 0 && (
        <>
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2 bg-neutral-50 border-b border-neutral-200 text-xs font-medium text-neutral-500 uppercase tracking-wide">
              <span>Schüler (A–Z)</span>
              <span className="w-[220px] text-center">Status</span>
              <span className="w-[140px] text-center">Lektionen</span>
            </div>

            <ul className="divide-y divide-neutral-100">
              {sortedStudents.map((student) => {
                const presentCount = getPresentCount(student.id);
                const isFullyPresent = presentCount === maxLessons;

                return (
                  <li
                    key={student.id}
                    className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto] gap-3 sm:items-center px-4 py-3"
                  >
                    <p className="font-medium text-neutral-900 min-w-0 truncate">
                      {student.lastName}, {student.firstName}
                    </p>

                    <div className="flex gap-2 w-full sm:w-[220px]">
                      <button
                        type="button"
                        onClick={() => setFullyPresent(student.id)}
                        className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-medium min-h-[40px] ${
                          isFullyPresent
                            ? 'bg-green-500 text-white'
                            : 'bg-white border border-neutral-300 text-neutral-600 hover:bg-green-50'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        Anwesend
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotFullyPresent(student.id)}
                        className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-medium min-h-[40px] ${
                          !isFullyPresent
                            ? 'bg-red-500 text-white'
                            : 'bg-white border border-neutral-300 text-neutral-600 hover:bg-red-50'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                        Nicht anwesend
                      </button>
                    </div>

                    <select
                      value={presentCount}
                      onChange={(e) => setPresentCount(student.id, Number(e.target.value))}
                      disabled={maxLessons <= 1 && isFullyPresent}
                      className="w-full sm:w-[140px] px-2 py-2 border border-neutral-300 rounded-lg text-sm disabled:opacity-50"
                      title="Wie viele Lektionen anwesend"
                    >
                      {Array.from({ length: maxLessons + 1 }, (_, i) => (
                        <option key={i} value={i}>
                          {i === 0
                            ? '0 Lektionen'
                            : i === 1
                              ? '1 Lektion'
                              : `${i} Lektionen`}
                        </option>
                      ))}
                    </select>
                  </li>
                );
              })}
            </ul>
          </div>

          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || maxLessons === 0}
            className="w-full bg-brand-red hover:bg-brand-red-dark text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50 mt-4"
          >
            {saveMutation.isPending ? 'Speichern...' : 'Anwesenheit speichern'}
          </button>

          {saveMutation.isSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center mt-3">
              <p className="text-green-700 text-sm font-medium">Anwesenheit gespeichert!</p>
            </div>
          )}
          {saveMutation.isError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center mt-3">
              <p className="text-red-700 text-sm font-medium">
                Speichern fehlgeschlagen. Bitte erneut versuchen.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
