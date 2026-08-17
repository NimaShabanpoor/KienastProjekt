// Absenzen-Statistiken

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { BarChart2, PieChart, ShieldAlert, UserCheck } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';

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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analyse"
        title="Absenzen-Statistiken"
        description="Verdichteter Überblick über Anwesenheit, entschuldigte und unentschuldigte Absenzen."
      />

      {isLoading && <div className="surface-card p-8 text-slate-400">Laden...</div>}

      {data && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Total Absenzen</p>
              <BarChart2 className="h-5 w-5 text-brand-red" />
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">{data.totalAbsences}</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Entschuldigt</p>
              <UserCheck className="h-5 w-5 text-yellow-600" />
            </div>
            <p className="mt-3 text-3xl font-bold text-yellow-600">{data.entschuldigt}</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Unentschuldigt</p>
              <ShieldAlert className="h-5 w-5 text-red-600" />
            </div>
            <p className="mt-3 text-3xl font-bold text-red-600">{data.unentschuldigt}</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Unentschuldigt-Quote</p>
              <PieChart className="h-5 w-5 text-slate-500" />
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">{data.quote}%</p>
          </div>
        </div>
      )}
    </div>
  );
}
