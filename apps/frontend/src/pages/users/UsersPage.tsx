// Benutzer-Verwaltung (Leiter)

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import type { User } from '@schuladmin/shared';
import { Role, ROLE_LABELS } from '@schuladmin/shared';
import { UserCog, UserPlus } from 'lucide-react';

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<Role>(Role.LEHRPERSON);
  const [password, setPassword] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: User[] }>('/api/v1/users');
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <UserCog className="w-6 h-6 text-brand-red" />
          <h1 className="text-2xl font-bold text-neutral-900">Benutzer</h1>
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

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        {isLoading && <div className="p-8 text-center text-neutral-400">Laden...</div>}
        {data?.map((user) => (
          <div key={user.id} className="flex items-center justify-between p-4 border-b border-neutral-100 last:border-0">
            <div>
              <p className="font-medium text-neutral-900">{user.lastName}, {user.firstName}</p>
              <p className="text-sm text-neutral-500">{user.email} · {ROLE_LABELS[user.role]}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded-full ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}>
                {user.isActive ? 'Aktiv' : 'Inaktiv'}
              </span>
              <button
                onClick={() => toggleActiveMutation.mutate({ id: user.id, isActive: user.isActive })}
                className="text-xs text-brand-red font-medium"
              >
                {user.isActive ? 'Deaktivieren' : 'Aktivieren'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
