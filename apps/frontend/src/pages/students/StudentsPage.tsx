// Schüler-Liste

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { usePermissions } from '../../hooks/usePermissions';
import { Search, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import type { Student } from '@schuladmin/shared';

export default function StudentsPage() {
  const { canManageStudents } = usePermissions();
  const [search, setSearch] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['students', search],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Student[] }>(
        `/api/v1/students${search ? `?search=${encodeURIComponent(search)}` : ''}`
      );
      return data.data;
    },
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Schülerinnen & Schüler</h1>
          <p className="text-neutral-500 mt-1">
            {data?.length ?? 0} Schüler gefunden
          </p>
        </div>
        {canManageStudents && (
          <button className="flex items-center gap-2 bg-brand-red hover:bg-brand-red-dark text-white font-medium py-2 px-4 rounded-lg transition-colors">
            <UserPlus className="w-4 h-4" />
            Neuer Schüler
          </button>
        )}
      </div>

      {/* Suche */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          type="text"
          placeholder="Name oder E-Mail suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
        />
      </div>

      {/* Tabelle */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-6 h-6 border-2 border-brand-red border-t-transparent rounded-full" />
          </div>
        )}

        {isError && (
          <div className="text-center py-12">
            <p className="text-error">Fehler beim Laden der Schüler.</p>
          </div>
        )}

        {!isLoading && data?.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500 font-medium">Noch keine Schüler vorhanden.</p>
            {canManageStudents && (
              <p className="text-neutral-400 text-sm mt-1">
                Schüler hinzufügen →
              </p>
            )}
          </div>
        )}

        {!isLoading && data && data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">
                    Name
                  </th>
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">
                    Klasse
                  </th>
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">
                    E-Mail
                  </th>
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {data.map((student) => (
                  <tr key={student.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-neutral-900">
                        {student.lastName}, {student.firstName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {student.class?.name ?? '–'}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {student.email ?? '–'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          student.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-neutral-100 text-neutral-500'
                        }`}
                      >
                        {student.isActive ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
