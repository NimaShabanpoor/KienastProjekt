// Klassen-Verwaltung (nur Abteilungsleitung)

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import type { Class } from '@schuladmin/shared';
import { Plus, BookOpen } from 'lucide-react';

export default function ClassesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Class[] }>('/api/v1/classes');
      return data.data;
    },
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Klassen</h1>
          <p className="text-neutral-500 mt-1">{data?.length ?? 0} Klassen</p>
        </div>
        <button className="flex items-center gap-2 bg-brand-red hover:bg-brand-red-dark text-white font-medium py-2 px-4 rounded-lg">
          <Plus className="w-4 h-4" /> Neue Klasse
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <p>Laden...</p>}
        {data?.map((cls) => (
          <div key={cls.id} className="bg-white rounded-xl border border-neutral-200 p-5 hover:shadow-md transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-brand-red-light rounded-lg">
                <BookOpen className="w-4 h-4 text-brand-red" />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900">{cls.name}</h3>
                <p className="text-xs text-neutral-500">{cls.schoolYear} | Semester {cls.semester}</p>
              </div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${ cls.isActive ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}>
              {cls.isActive ? 'Aktiv' : 'Inaktiv'}
            </span>
          </div>
        ))}
        {!isLoading && !data?.length && (
          <div className="col-span-3 text-center py-12">
            <p className="text-neutral-400">Noch keine Klassen. Neue Klasse hinzufügen →</p>
          </div>
        )}
      </div>
    </div>
  );
}
