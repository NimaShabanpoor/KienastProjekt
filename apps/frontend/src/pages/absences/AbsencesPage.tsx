// Absenzen-Erfassungsseite
// Mobile-optimiert: Touch-Targets min 44x44px

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import type { Lesson, Student } from '@schuladmin/shared';
import { AbsenceStatus } from '@schuladmin/shared';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';

type AbsenceEntry = { studentId: string; status: AbsenceStatus; note?: string | null };

const STATUS_CONFIG = {
  [AbsenceStatus.ANWESEND]: {
    label: 'Anwesend',
    icon: CheckCircle2,
    style: 'bg-green-500 text-white',
    inactive: 'bg-white border border-neutral-300 text-neutral-600 hover:bg-green-50',
  },
  [AbsenceStatus.ENTSCHULDIGT]: {
    label: 'Entschuldigt',
    icon: Clock,
    style: 'bg-yellow-500 text-white',
    inactive: 'bg-white border border-neutral-300 text-neutral-600 hover:bg-yellow-50',
  },
  [AbsenceStatus.UNENTSCHULDIGT]: {
    label: 'Unentschuldigt',
    icon: AlertCircle,
    style: 'bg-red-500 text-white',
    inactive: 'bg-white border border-neutral-300 text-neutral-600 hover:bg-red-50',
  },
};

export default function AbsencesPage() {
  const queryClient = useQueryClient();
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [absences, setAbsences] = useState<Record<string, AbsenceStatus>>({});

  const today = new Date().toISOString().split('T')[0];

  // Heutige Lektionen laden
  const { data: lessons } = useQuery({
    queryKey: ['lessons-today', today],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Lesson[] }>(
        `/api/v1/lessons?dateFrom=${today}&dateTo=${today}`
      );
      return data.data;
    },
  });

  // Schüler der ausgewählten Lektion laden
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

  // Absenzen speichern
  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries: AbsenceEntry[] = (students ?? []).map((s) => ({
        studentId: s.id,
        status: absences[s.id] ?? AbsenceStatus.ANWESEND,
      }));
      await apiClient.post('/api/v1/absences', { lessonId: selectedLesson, absences: entries });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['absences'] });
    },
  });

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-neutral-900 mb-4">Absenzen erfassen</h1>

      {/* Lektionsauswahl */}
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
      </div>

      {/* Schüler-Liste mit Status-Toggles */}
      {selectedLesson && students && (
        <div className="space-y-3">
          {students.map((student) => {
            const currentStatus = absences[student.id] ?? AbsenceStatus.ANWESEND;
            return (
              <div
                key={student.id}
                className="bg-white rounded-xl border border-neutral-200 p-4"
              >
                <p className="font-medium text-neutral-900 mb-3">
                  {student.lastName}, {student.firstName}
                </p>
                {/* Status-Buttons (mind. 44px Touch-Target) */}
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                    const isActive = currentStatus === status;
                    return (
                      <button
                        key={status}
                        onClick={() =>
                          setAbsences((prev) => ({
                            ...prev,
                            [student.id]: status as AbsenceStatus,
                          }))
                        }
                        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                          isActive ? config.style : config.inactive
                        }`}
                      >
                        <config.icon className="w-4 h-4" />
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Speichern-Button */}
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="w-full bg-brand-red hover:bg-brand-red-dark text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50 mt-4"
          >
            {saveMutation.isPending ? 'Speichern...' : 'Absenzen speichern'}
          </button>

          {saveMutation.isSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <p className="text-green-700 text-sm font-medium">✅ Absenzen gespeichert!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
