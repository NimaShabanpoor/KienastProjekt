// Absenzen-Erfassungsseite (Lehrer)
// Einfach Anwesend/Abwesend – Entschuldigung erfolgt durch den Leiter

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import type { Lesson, Student } from '@schuladmin/shared';
import { AbsenceStatus } from '@schuladmin/shared';
import { usePermissions } from '../../hooks/usePermissions';
import { CheckCircle2, XCircle } from 'lucide-react';

type AbsenceEntry = { studentId: string; status: AbsenceStatus; note?: string | null };

export default function AbsencesPage() {
  const queryClient = useQueryClient();
  const { isTeacher } = usePermissions();
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [absences, setAbsences] = useState<Record<string, boolean>>({}); // true = anwesend

  const today = new Date().toISOString().split('T')[0];

  const { data: lessons } = useQuery({
    queryKey: ['lessons-today', today],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Lesson[] }>(
        `/api/v1/lessons?dateFrom=${today}&dateTo=${today}`
      );
      return data.data;
    },
  });

  const selectedLessonData = lessons?.find((l) => l.id === selectedLesson);
  const { data: students } = useQuery({
    queryKey: ['students', selectedLessonData?.subject?.class?.id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Student[] }>(
        `/api/v1/students?classId=${selectedLessonData?.subject?.class?.id}`
      );
      return data.data;
    },
    enabled: !!selectedLessonData?.subject?.class?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries: AbsenceEntry[] = (students ?? []).map((s) => ({
        studentId: s.id,
        status: (absences[s.id] ?? true)
          ? AbsenceStatus.ANWESEND
          : AbsenceStatus.UNENTSCHULDIGT,
      }));
      await apiClient.post('/api/v1/absences', { lessonId: selectedLesson, absences: entries });
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
        Trage Anwesend oder Abwesend ein. Entschuldigungen nimmt der Leiter vor.
      </p>

      <div className="mb-6">
        <label className="block text-sm font-medium text-neutral-700 mb-2">Lektion auswählen</label>
        <select
          value={selectedLesson ?? ''}
          onChange={(e) => { setSelectedLesson(e.target.value || null); setAbsences({}); }}
          className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
        >
          <option value="">-- Lektion auswählen --</option>
          {lessons?.map((lesson) => (
            <option key={lesson.id} value={lesson.id} disabled={lesson.isCancelled}>
              {lesson.subject?.name} | {lesson.startTime}-{lesson.endTime}
              {lesson.isCancelled ? ' (Ausgefallen)' : ''}
            </option>
          ))}
        </select>
        {lessons?.length === 0 && (
          <p className="text-sm text-amber-600 mt-2">Keine Lektionen für heute – der Leiter muss den Stundenplan pflegen.</p>
        )}
      </div>

      {selectedLesson && students && (
        <div className="space-y-3">
          {students.map((student) => {
            const isPresent = absences[student.id] ?? true;
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
                    onClick={() => setAbsences((prev) => ({ ...prev, [student.id]: true }))}
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
                    onClick={() => setAbsences((prev) => ({ ...prev, [student.id]: false }))}
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
              </div>
            );
          })}

          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="w-full bg-brand-red hover:bg-brand-red-dark text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50 mt-4"
          >
            {saveMutation.isPending ? 'Speichern...' : 'Anwesenheit speichern'}
          </button>

          {saveMutation.isSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <p className="text-green-700 text-sm font-medium">Anwesenheit gespeichert!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
