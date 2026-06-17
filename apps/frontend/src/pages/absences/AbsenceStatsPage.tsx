// Absenzen-Statistiken

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { BarChart2 } from 'lucide-react';

interface AbsenceStats {
  totalAbsences: number;
  entschuldigt: number;
  unentschuldigt: number;
  quote: number;
}

export default function AbsenceStatsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['absence-stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: AbsenceStats }>('/api/v1/absences/stats');
      return data.data;
    },
  });

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <BarChart2 className="w-6 h-6 text-brand-red" />
        <h1 className="text-2xl font-bold text-neutral-900">Absenzen-Statistiken</h1>
      </div>

      {isLoading && <div className="text-neutral-400">Laden...</div>}

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <p className="text-sm text-neutral-500">Total Absenzen</p>
            <p className="text-3xl font-bold text-neutral-900 mt-1">{data.totalAbsences}</p>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <p className="text-sm text-neutral-500">Entschuldigt</p>
            <p className="text-3xl font-bold text-yellow-600 mt-1">{data.entschuldigt}</p>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <p className="text-sm text-neutral-500">Unentschuldigt</p>
            <p className="text-3xl font-bold text-red-600 mt-1">{data.unentschuldigt}</p>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <p className="text-sm text-neutral-500">Unentschuldigt-Quote</p>
            <p className="text-3xl font-bold text-neutral-900 mt-1">{data.quote}%</p>
          </div>
        </div>
      )}
    </div>
  );
}
