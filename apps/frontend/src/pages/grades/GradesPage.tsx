// Noten-Seite

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import type { Grade } from '@schuladmin/shared';
import { GraduationCap, Lock } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';

export default function GradesPage() {
  const { canEditGrades } = usePermissions();

  const { data, isLoading } = useQuery({
    queryKey: ['grades'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Grade[] }>('/api/v1/grades');
      return data.data;
    },
  });

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <GraduationCap className="w-6 h-6 text-brand-red" />
        <h1 className="text-2xl font-bold text-neutral-900">Noten</h1>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        {isLoading && <div className="p-8 text-center text-neutral-400">Laden...</div>}
        {!isLoading && !data?.length && (
          <div className="p-8 text-center">
            <GraduationCap className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-400">Noch keine Noten vorhanden. Noten hinzufügen →</p>
          </div>
        )}
        {data?.map((grade) => (
          <div key={grade.id} className="flex items-center justify-between p-4 border-b border-neutral-100 last:border-0">
            <div>
              <span className="font-medium text-neutral-900">{grade.student ? `${grade.student.lastName}, ${grade.student.firstName}` : '–'}</span>
              <p className="text-sm text-neutral-500">{grade.subject?.name} – {grade.category?.name}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`font-mono text-xl font-bold ${
                grade.value >= 4 ? 'text-green-600' : 'text-red-600'
              }`}>
                {grade.value.toFixed(1)}
              </span>
              {grade.isLocked ? (
                <span title="Note gesperrt – nur Abteilungsleitung kann korrigieren">
                  <Lock className="w-4 h-4 text-neutral-400" />
                </span>
              ) : null}
              {canEditGrades && grade.isLocked && (
                <button className="text-xs text-brand-red hover:text-brand-red-dark font-medium">
                  Korrigieren
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
