// Schüler-Liste

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { usePermissions } from '../../hooks/usePermissions';
import { Search, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Student, Class } from '@schuladmin/shared';

type StatusFilter = 'active' | 'inactive' | 'all';

export default function StudentsPage() {
  const queryClient = useQueryClient();
  const { canManageStudents, isTeacher } = usePermissions();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [showForm, setShowForm] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [classId, setClassId] = useState('');
  const [gender, setGender] = useState<'M' | 'F' | 'D' | ''>('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['students', search, statusFilter, canManageStudents],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (search) params.set('search', search);
      if (canManageStudents) {
        if (statusFilter === 'active') params.set('isActive', 'true');
        if (statusFilter === 'inactive') params.set('isActive', 'false');
        // 'all' → kein isActive-Filter
      } else {
        params.set('isActive', 'true');
      }
      const { data } = await apiClient.get<{ data: Student[] }>(
        `/api/v1/students?${params.toString()}`
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
    enabled: canManageStudents,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/api/v1/students', {
        firstName,
        lastName,
        email: email || null,
        classId,
        gender: gender || null,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      setShowForm(false);
      setFirstName('');
      setLastName('');
      setEmail('');
      setClassId('');
      setGender('');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const endpoint = isActive ? 'deactivate' : 'activate';
      await apiClient.patch(`/api/v1/students/${id}/${endpoint}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            {isTeacher ? 'Schülerliste meiner Klasse' : 'Schülerinnen & Schüler'}
          </h1>
          <p className="text-neutral-500 mt-1">{data?.length ?? 0} Schüler gefunden</p>
        </div>
        {canManageStudents && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-brand-red hover:bg-brand-red-dark text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Neuer Schüler
          </button>
        )}
      </div>

      {showForm && canManageStudents && (
        <form
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
          className="bg-white rounded-xl border border-neutral-200 p-5 mb-6 space-y-4"
        >
          <h2 className="font-semibold text-neutral-900">Schüler hinzufügen</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input required placeholder="Vorname" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="px-3 py-2 border border-neutral-300 rounded-lg text-sm" />
            <input required placeholder="Nachname" value={lastName} onChange={(e) => setLastName(e.target.value)} className="px-3 py-2 border border-neutral-300 rounded-lg text-sm" />
            <input type="email" placeholder="E-Mail (optional)" value={email} onChange={(e) => setEmail(e.target.value)} className="px-3 py-2 border border-neutral-300 rounded-lg text-sm" />
            <select required value={classId} onChange={(e) => setClassId(e.target.value)} className="px-3 py-2 border border-neutral-300 rounded-lg text-sm">
              <option value="">-- Klasse wählen --</option>
              {classes?.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.schoolYear})</option>
              ))}
            </select>
            <select value={gender} onChange={(e) => setGender(e.target.value as 'M' | 'F' | 'D' | '')} className="px-3 py-2 border border-neutral-300 rounded-lg text-sm">
              <option value="">Geschlecht (optional)</option>
              <option value="M">Männlich</option>
              <option value="F">Weiblich</option>
              <option value="D">Divers</option>
            </select>
          </div>
          <button type="submit" disabled={createMutation.isPending} className="bg-brand-red text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            Schüler speichern
          </button>
        </form>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Name oder E-Mail suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
          />
        </div>
        {canManageStudents && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2.5 border border-neutral-300 rounded-lg text-sm bg-white"
          >
            <option value="active">Nur aktive</option>
            <option value="inactive">Nur inaktive</option>
            <option value="all">Alle</option>
          </select>
        )}
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-6 h-6 border-2 border-brand-red border-t-transparent rounded-full" />
          </div>
        )}
        {isError && <div className="text-center py-12"><p className="text-error">Fehler beim Laden der Schüler.</p></div>}
        {!isLoading && data?.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500 font-medium">Keine Schüler gefunden.</p>
          </div>
        )}
        {!isLoading && data && data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase px-4 py-3">Name</th>
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase px-4 py-3">Klasse</th>
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase px-4 py-3">E-Mail</th>
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase px-4 py-3">Status</th>
                  {canManageStudents && (
                    <th className="text-right text-xs font-medium text-neutral-500 uppercase px-4 py-3">Aktion</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {data.map((student) => (
                  <tr key={student.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/students/${student.id}`} className="font-medium text-neutral-900 hover:text-brand-red">
                        {student.lastName}, {student.firstName}
                      </Link>
                      <p className="text-xs text-neutral-400 mt-0.5">Noten & Absenzen anzeigen</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{student.class?.name ?? '–'}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{student.email ?? '–'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${student.isActive ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}>
                        {student.isActive ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>
                    {canManageStudents && (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            toggleActiveMutation.mutate({
                              id: student.id,
                              isActive: student.isActive,
                            })
                          }
                          disabled={toggleActiveMutation.isPending}
                          className="text-xs font-medium text-brand-red hover:underline disabled:opacity-50"
                        >
                          {student.isActive ? 'Deaktivieren' : 'Aktivieren'}
                        </button>
                      </td>
                    )}
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
