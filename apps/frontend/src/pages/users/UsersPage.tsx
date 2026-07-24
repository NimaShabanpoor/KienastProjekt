// Benutzer-Verwaltung (Leiter)
// Deaktivieren = nur inaktiv (Login gesperrt), kein Löschen

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import type { User } from '@schuladmin/shared';
import { Role, ROLE_LABELS } from '@schuladmin/shared';
import { UserCog, UserPlus } from 'lucide-react';

type StatusFilter = 'active' | 'inactive' | 'all';

export default function UsersPage() {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<Role>(Role.LEHRPERSON);
  const [password, setPassword] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['users', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '100' });
      if (statusFilter === 'active') params.set('isActive', 'true');
      if (statusFilter === 'inactive') params.set('isActive', 'false');
      const { data } = await apiClient.get<{ data: User[] }>(`/api/v1/users?${params}`);
      return data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/api/v1/users', { email, firstName, lastName, role, password });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowForm(false);
      setEmail('');
      setFirstName('');
      setLastName('');
      setPassword('');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const endpoint = isActive ? 'deactivate' : 'activate';
      await apiClient.patch(`/api/v1/users/${id}/${endpoint}`);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const toggleError = (() => {
    const err = toggleActiveMutation.error;
    if (!err || !axios.isAxiosError(err)) return null;
    const data = err.response?.data as { error?: string } | undefined;
    return data?.error ?? 'Aktion fehlgeschlagen.';
  })();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <UserCog className="w-6 h-6 text-brand-red" />
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Benutzer</h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              Deaktivieren sperrt nur den Login – der Benutzer bleibt erhalten und kann wieder aktiviert werden.
            </p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-brand-red text-white px-4 py-2 rounded-lg text-sm">
          <UserPlus className="w-4 h-4" /> Neuer Benutzer
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
          className="bg-white rounded-xl border border-neutral-200 p-5 mb-6 space-y-4"
        >
          <h2 className="font-semibold">Benutzer anlegen</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input required type="email" placeholder="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
            <input required type="password" minLength={12} placeholder="Passwort (min. 12 Zeichen)" value={password} onChange={(e) => setPassword(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
            <input required placeholder="Vorname" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
            <input required placeholder="Nachname" value={lastName} onChange={(e) => setLastName(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="px-3 py-2 border rounded-lg text-sm">
              <option value={Role.LEHRPERSON}>{ROLE_LABELS[Role.LEHRPERSON]}</option>
              <option value={Role.ABTEILUNGSLEITUNG}>{ROLE_LABELS[Role.ABTEILUNGSLEITUNG]}</option>
            </select>
          </div>
          <button type="submit" disabled={createMutation.isPending} className="bg-brand-red text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">Benutzer erstellen</button>
        </form>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white"
        >
          <option value="all">Alle Benutzer</option>
          <option value="active">Nur aktive</option>
          <option value="inactive">Nur inaktive</option>
        </select>
        {toggleError && (
          <p className="text-sm text-red-600">{toggleError}</p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        {isLoading && <div className="p-8 text-center text-neutral-400">Laden...</div>}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <div className="p-8 text-center text-neutral-400">Keine Benutzer gefunden.</div>
        )}
        {data?.map((user) => {
          const isSelf = user.id === currentUserId;
          return (
            <div key={user.id} className="flex items-center justify-between p-4 border-b border-neutral-100 last:border-0 gap-3">
              <div className="min-w-0">
                <p className="font-medium text-neutral-900">
                  {user.lastName}, {user.firstName}
                  {isSelf && <span className="ml-2 text-xs font-normal text-neutral-400">(du)</span>}
                </p>
                <p className="text-sm text-neutral-500 truncate">{user.email} · {ROLE_LABELS[user.role]}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                  {user.isActive ? 'Aktiv' : 'Inaktiv'}
                </span>
                {isSelf ? (
                  <span className="text-xs text-neutral-400">Eigener Account</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleActiveMutation.mutate({ id: user.id, isActive: user.isActive })}
                    disabled={toggleActiveMutation.isPending}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border disabled:opacity-50 ${
                      user.isActive
                        ? 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                        : 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
                    }`}
                  >
                    {user.isActive ? 'Deaktivieren' : 'Aktivieren'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
