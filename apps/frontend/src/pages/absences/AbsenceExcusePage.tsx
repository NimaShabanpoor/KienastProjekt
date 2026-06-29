// Absenzen entschuldigen (nur Leiter)

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { AbsenceStatus } from '@schuladmin/shared';
import type { Absence } from '@schuladmin/shared';
import { CheckCircle2 } from 'lucide-react';

export default function AbsenceExcusePage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['absences-unexcused'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Absence[] }>(
        `/api/v1/absences?status=${AbsenceStatus.UNENTSCHULDIGT}`
      );
      return data.data;
    },
  });

  const excuseMutation = useMutation({
    mutationFn: async (absenceId: string) => {
      await apiClient.put(`/api/v1/absences/${absenceId}`, {
        status: AbsenceStatus.ENTSCHULDIGT,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['absences-unexcused'] });
    },
  });

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-neutral-900 mb-1">Absenzen entschuldigen</h1>
      <p className="text-neutral-500 mb-6">
        Hier siehst du alle unentschuldigten Absenzen und kannst sie bestätigen.
      </p>

      {isLoading && <p className="text-neutral-400">Laden...</p>}

      {!isLoading && !data?.length && (
        <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
          <p className="text-neutral-500">Keine offenen Absenzen zur Entschuldigung.</p>
        </div>
      )}

      <div className="space-y-3">
        {data?.map((absence) => (
          <div
            key={absence.id}
            className="bg-white rounded-xl border border-neutral-200 p-4 flex items-center justify-between gap-4"
          >
            <div>
              <p className="font-medium text-neutral-900">
                {absence.student?.lastName}, {absence.student?.firstName}
              </p>
              <p className="text-sm text-neutral-500">
                {absence.student?.class?.name} ·{' '}
                {absence.lesson?.subject?.name ?? 'Lektion'}{' '}
                {absence.lesson?.date
                  ? new Date(absence.lesson.date).toLocaleDateString('de-CH')
                  : ''}{' '}
                {absence.lesson?.startTime}-{absence.lesson?.endTime}
              </p>
            </div>
            <button
              onClick={() => excuseMutation.mutate(absence.id)}
              disabled={excuseMutation.isPending}
              className="flex items-center gap-1.5 bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 px-4 rounded-lg text-sm whitespace-nowrap disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              Entschuldigen
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
