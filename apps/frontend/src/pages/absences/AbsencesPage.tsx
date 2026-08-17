// Absenzen-Erfassungsseite
// Mobile-optimiert: Touch-Targets min 44x44px

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import type { Lesson, Student } from '@schuladmin/shared/types/entities';
import { AbsenceStatus } from '@schuladmin/shared/types/roles';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';

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
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Tagesgeschäft"
        title="Absenzen erfassen"
        description="Wähle eine heutige Lektion aus und markiere pro Schüler den passenden Anwesenheitsstatus."
      />

      <div className="surface-card p-6">
        <label className="mb-2 block text-sm font-medium text-slate-700">Lektion auswählen</label>
        <select
          value={selectedLesson ?? ''}
          onChange={(e) => {
            setSelectedLesson(e.target.value || null);
            setAbsences({});
          }}
          className="input-modern"
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

      {!selectedLesson && (
        <EmptyState
          icon={<Clock className="h-6 w-6" />}
          title="Lektion auswählen"
          description="Sobald du eine Lektion auswählst, erscheinen hier alle zugehörigen Schüler mit den Status-Buttons."
        />
      )}

      {selectedLesson && students && (
        <div className="space-y-3">
          {students.map((student) => {
            const currentStatus = absences[student.id] ?? AbsenceStatus.ANWESEND;
            return (
              <div
                key={student.id}
                className="surface-card p-5"
              >
                <p className="mb-3 font-medium text-slate-900">
                  {student.lastName}, {student.firstName}
                </p>
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
                        className={`flex min-h-[44px] items-center gap-1.5 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all ${
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

          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="btn-primary mt-4 w-full py-3"
          >
            {saveMutation.isPending ? 'Speichern...' : 'Absenzen speichern'}
          </button>

          {saveMutation.isSuccess && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-center">
              <p className="text-sm font-medium text-green-700">Absenzen gespeichert.</p>
            </div>
          )}

          {saveMutation.isError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
              <p className="text-sm font-medium text-red-700">
                Absenzen konnten nicht gespeichert werden. Bitte erneut versuchen.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
