// Absenzen entschuldigen (nur Leiter)
// Gruppiert nach Klasse, mit Hinweis bei offenen Absenzen

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { AbsenceStatus } from '@schuladmin/shared';
import type { Absence, Class } from '@schuladmin/shared';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface ClassGroup {
  classId: string;
  className: string;
  absences: Absence[];
}

function groupByClass(absences: Absence[]): ClassGroup[] {
  const map = new Map<string, ClassGroup>();

  for (const absence of absences) {
    const classId = absence.student?.class?.id ?? 'unknown';
    const className = absence.student?.class?.name ?? 'Unbekannt';

    if (!map.has(classId)) {
      map.set(classId, { classId, className, absences: [] });
    }
    map.get(classId)!.absences.push(absence);
  }

  return [...map.values()].sort((a, b) => a.className.localeCompare(b.className, 'de'));
}

export default function AbsenceExcusePage() {
  const queryClient = useQueryClient();
  const [filterClassId, setFilterClassId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['absences-unexcused'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Absence[] }>(
        `/api/v1/absences?status=${AbsenceStatus.UNENTSCHULDIGT}`
      );
      return data.data;
    },
  });

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Class[] }>('/api/v1/classes');
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
      void queryClient.invalidateQueries({ queryKey: ['unexcused-absence-count'] });
    },
  });

  const groups = useMemo(() => groupByClass(data ?? []), [data]);

  const countByClass = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of groups) {
      counts.set(g.classId, g.absences.length);
    }
    return counts;
  }, [groups]);

  const sortedClasses = useMemo(
    () => [...(classes ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'de')),
    [classes]
  );

  const visibleGroups = filterClassId
    ? groups.filter((g) => g.classId === filterClassId)
    : groups;

  const totalOpen = data?.length ?? 0;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-neutral-900 mb-1">Absenzen entschuldigen</h1>
      <p className="text-neutral-500 mb-4">
        Nach Klasse sortiert · {totalOpen} offene Absenz{totalOpen === 1 ? '' : 'en'}
      </p>

      {/* Klassen-Übersicht mit Ausrufezeichen */}
      {sortedClasses.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Klassen</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterClassId(null)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                filterClassId === null
                  ? 'bg-brand-red-light border-brand-red text-brand-red'
                  : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              Alle
              {totalOpen > 0 && (
                <AlertCircle className="w-4 h-4 text-red-500" aria-label="Offene Absenzen" />
              )}
            </button>
            {sortedClasses.map((cls) => {
              const openCount = countByClass.get(cls.id) ?? 0;
              const hasOpen = openCount > 0;
              return (
                <button
                  key={cls.id}
                  onClick={() => setFilterClassId(cls.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    filterClassId === cls.id
                      ? 'bg-brand-red-light border-brand-red text-brand-red'
                      : hasOpen
                        ? 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100'
                        : 'bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50'
                  }`}
                >
                  {cls.name}
                  {hasOpen && (
                    <>
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <span className="text-xs font-bold text-red-600">({openCount})</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isLoading && <p className="text-neutral-400">Laden...</p>}

      {!isLoading && totalOpen === 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="text-neutral-500">Keine offenen Absenzen zur Entschuldigung.</p>
        </div>
      )}

      <div className="space-y-6">
        {visibleGroups.map((group) => (
          <section key={group.classId}>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <h2 className="text-lg font-semibold text-neutral-900">{group.className}</h2>
              <span className="text-sm text-red-600 font-medium">
                {group.absences.length} unentschuldigt
              </span>
            </div>

            <div className="space-y-3">
              {group.absences.map((absence) => (
                <div
                  key={absence.id}
                  className="bg-white rounded-xl border border-neutral-200 p-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-medium text-neutral-900">
                      {absence.student?.lastName}, {absence.student?.firstName}
                    </p>
                    <p className="text-sm text-neutral-500">
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
          </section>
        ))}

        {!isLoading && filterClassId && visibleGroups.length === 0 && totalOpen > 0 && (
          <div className="bg-white rounded-xl border border-neutral-200 p-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-neutral-500">In dieser Klasse keine offenen Absenzen.</p>
          </div>
        )}
      </div>
    </div>
  );
}
