// Absenzen-Erfassungsseite (Lehrer)
// Anwesend/Abwesend inkl. Anzahl fehlender Lektionen – Entschuldigung durch Leiter

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import type { Lesson, Student } from '@schuladmin/shared';
import { AbsenceStatus } from '@schuladmin/shared';
import { usePermissions } from '../../hooks/usePermissions';
import { CheckCircle2, XCircle } from 'lucide-react';

type StudentAttendance = {
  present: boolean;
  absentLessonCount: number;
};

export default function AbsencesPage() {
  const queryClient = useQueryClient();
  const { isTeacher } = usePermissions();
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [attendance, setAttendance] = useState<Record<string, StudentAttendance>>({});

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

  const selectedLessons = useMemo(
    () => (lessons ?? []).filter((l) => selectedLessonIds.includes(l.id)),
    [lessons, selectedLessonIds]
  );

  const selectedClassId = selectedLessons[0]?.subject?.class?.id;

  const { data: students } = useQuery({
    queryKey: ['students', selectedClassId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Student[] }>(
        `/api/v1/students?classId=${selectedClassId}`
      );
      return data.data;
    },
    enabled: !!selectedClassId,
  });

  const maxLessons = selectedLessonIds.length;

  const toggleLesson = (lessonId: string, classId: string | undefined): void => {
    setSelectedLessonIds((prev) => {
      const already = prev.includes(lessonId);
      if (already) {
        const next = prev.filter((id) => id !== lessonId);
        setAttendance((att) => {
          const updated: Record<string, StudentAttendance> = {};
          for (const [sid, val] of Object.entries(att)) {
            updated[sid] = {
              ...val,
              absentLessonCount: Math.min(val.absentLessonCount, Math.max(next.length, 1)),
            };
          }
          return updated;
        });
        return next;
      }

      // Nur Lektionen derselben Klasse mischen
      const firstSelected = lessons?.find((l) => prev[0] === l.id);
      if (prev.length > 0 && firstSelected?.subject?.class?.id !== classId) {
        alert('Bitte nur Lektionen derselben Klasse auswählen.');
        return prev;
      }

      return [...prev, lessonId];
    });
  };

  const setPresent = (studentId: string, present: boolean): void => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: {
        present,
        absentLessonCount: prev[studentId]?.absentLessonCount ?? Math.max(maxLessons, 1),
      },
    }));
  };

  const setAbsentCount = (studentId: string, count: number): void => {
    const clamped = Math.min(Math.max(count, 1), Math.max(maxLessons, 1));
    setAttendance((prev) => ({
      ...prev,
      [studentId]: { present: false, absentLessonCount: clamped },
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (selectedLessonIds.length === 0) {
        throw new Error('Keine Lektion ausgewählt');
      }
      const entries = (students ?? []).map((s) => {
        const row = attendance[s.id] ?? { present: true, absentLessonCount: maxLessons };
        if (row.present) {
          return { studentId: s.id, status: AbsenceStatus.ANWESEND };
        }
        return {
          studentId: s.id,
          status: AbsenceStatus.UNENTSCHULDIGT,
          absentLessonCount: row.absentLessonCount,
        };
      });
      await apiClient.post('/api/v1/absences', {
        lessonIds: selectedLessonIds,
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
        Wähle die Lektionen und trage pro Schüler Anwesend oder Abwesend inkl. Anzahl Lektionen ein.
      </p>

      <div className="mb-6">
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Lektionen auswählen (heute)
        </label>
        <div className="space-y-2 bg-white rounded-xl border border-neutral-200 p-3">
          {(lessons ?? []).length === 0 && (
            <p className="text-sm text-amber-600">
              Keine Lektionen für heute – der Leiter muss den Stundenplan pflegen.
            </p>
          )}
          {(lessons ?? []).map((lesson) => {
            const checked = selectedLessonIds.includes(lesson.id);
            const className = lesson.subject?.class?.name ?? '–';
            return (
              <label
                key={lesson.id}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-neutral-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleLesson(lesson.id, lesson.subject?.class?.id)}
                  className="mt-1"
                />
                <span className="text-sm text-neutral-800">
                  <span className="font-medium">{lesson.subject?.name}</span>
                  {' · '}
                  {lesson.startTime}–{lesson.endTime}
                  {' · '}
                  Klasse {className}
                </span>
              </label>
            );
          })}
        </div>
        {maxLessons > 0 && (
          <p className="text-xs text-neutral-500 mt-2">
            {maxLessons} Lektion{maxLessons === 1 ? '' : 'en'} ausgewählt
          </p>
        )}
      </div>

      {selectedClassId && students && (
        <div className="space-y-3">
          {students.map((student) => {
            const row = attendance[student.id] ?? {
              present: true,
              absentLessonCount: maxLessons,
            };
            const isPresent = row.present;
            return (
              <div
                key={student.id}
                className="bg-white rounded-xl border border-neutral-200 p-4"
              >
                <p className="font-medium text-neutral-900 mb-3">
                  {student.lastName}, {student.firstName}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPresent(student.id, true)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                      isPresent
                        ? 'bg-green-500 text-white'
                        : 'bg-white border border-neutral-300 text-neutral-600 hover:bg-green-50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Anwesend
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresent(student.id, false)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                      !isPresent
                        ? 'bg-red-500 text-white'
                        : 'bg-white border border-neutral-300 text-neutral-600 hover:bg-red-50'
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    Abwesend
                  </button>
                </div>

                {!isPresent && (
                  <div className="mt-3 flex items-center gap-3">
                    <label className="text-sm text-neutral-600 whitespace-nowrap">
                      Anzahl Lektionen fehlend
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={maxLessons}
                      value={row.absentLessonCount}
                      onChange={(e) => setAbsentCount(student.id, Number(e.target.value))}
                      className="w-20 px-2 py-1.5 border border-neutral-300 rounded-lg text-sm text-center"
                    />
                    <span className="text-xs text-neutral-500">von {maxLessons}</span>
                  </div>
                )}
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
              <p className="text-red-700 text-sm font-medium">Speichern fehlgeschlagen. Bitte erneut versuchen.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
