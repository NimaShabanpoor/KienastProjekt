// Benutzerverwaltung (nur Abteilungsleitung) – Anlegen, Bearbeiten,
// Aktivieren/Deaktivieren und 2FA zurücksetzen.

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PencilLine, Power, PowerOff, Search, ShieldOff, UserPlus, Users } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { User } from '@schuladmin/shared/types/entities';
import { Role } from '@schuladmin/shared/types/roles';
import { usersApi, apiErrorMessage } from '../../api/endpoints';
import type { UserInput } from '../../api/endpoints';
import { usePermissions } from '../../hooks/usePermissions';
import { toast } from '../../store/toastStore';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import ActionModal from '../../components/ui/ActionModal';

type EditState = { mode: 'create' } | { mode: 'edit'; user: User } | null;

const emptyForm: UserInput = {
  email: '',
  firstName: '',
  lastName: '',
  role: Role.LEHRPERSON,
  password: '',
};

const PASSWORD_MIN = 12;

function roleLabel(role: Role): string {
  return role === Role.ABTEILUNGSLEITUNG ? 'Abteilungsleitung' : 'Lehrperson';
}

function rolePillClass(role: Role): string {
  return role === Role.ABTEILUNGSLEITUNG
    ? 'bg-rose-100 text-rose-700'
    : 'bg-sky-100 text-sky-700';
}

function formatLastLogin(value: string | null): string {
  if (!value) return '–';
  return format(new Date(value), 'dd.MM.yyyy HH:mm', { locale: de });
}

export default function UsersPage() {
  const { canManageUsers } = usePermissions();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [editState, setEditState] = useState<EditState>(null);
  const [form, setForm] = useState<UserInput>(emptyForm);
  const [resetTarget, setResetTarget] = useState<User | null>(null);

  const roleParam = roleFilter === 'all' ? undefined : roleFilter;
  const isActiveParam = statusFilter === 'all' ? undefined : statusFilter === 'active';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['users', roleFilter, statusFilter],
    queryFn: () => usersApi.list({ role: roleParam, isActive: isActiveParam }),
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['users'] });

  const saveMutation = useMutation({
    mutationFn: (payload: { id?: string; body: UserInput }) =>
      payload.id
        ? usersApi.update(payload.id, {
            email: payload.body.email,
            firstName: payload.body.firstName,
            lastName: payload.body.lastName,
            role: payload.body.role,
          })
        : usersApi.create(payload.body),
    onSuccess: (_res, payload) => {
      invalidate();
      setEditState(null);
      toast.success(payload.id ? 'Benutzer aktualisiert.' : 'Benutzer angelegt.');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Speichern fehlgeschlagen.')),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (user: User) =>
      user.isActive ? usersApi.deactivate(user.id) : usersApi.activate(user.id),
    onSuccess: (_res, user) => {
      invalidate();
      toast.success(user.isActive ? 'Benutzer deaktiviert.' : 'Benutzer aktiviert.');
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const reset2FAMutation = useMutation({
    mutationFn: (user: User) => usersApi.reset2FA(user.id),
    onSuccess: () => {
      invalidate();
      setResetTarget(null);
      toast.success('2FA zurückgesetzt.');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Zurücksetzen fehlgeschlagen.')),
  });

  const openCreate = () => {
    setForm(emptyForm);
    setEditState({ mode: 'create' });
  };

  const openEdit = (user: User) => {
    setForm({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      password: '',
    });
    setEditState({ mode: 'edit', user });
  };

  const isEdit = editState?.mode === 'edit';

  const canSubmit =
    !!form.email.trim() &&
    !!form.firstName.trim() &&
    !!form.lastName.trim() &&
    (isEdit || form.password.length >= PASSWORD_MIN);

  const submit = () => {
    if (!form.email.trim() || !form.firstName.trim() || !form.lastName.trim()) {
      toast.error('Bitte E-Mail, Vorname und Nachname ausfüllen.');
      return;
    }
    if (!isEdit && form.password.length < PASSWORD_MIN) {
      toast.error(`Das Passwort muss mindestens ${PASSWORD_MIN} Zeichen lang sein.`);
      return;
    }
    const body: UserInput = {
      email: form.email.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      role: form.role,
      password: form.password,
    };
    saveMutation.mutate({ id: editState?.mode === 'edit' ? editState.user.id : undefined, body });
  };

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((u) =>
      `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Benutzerverwaltung"
        title="Benutzerkonten"
        description={`${data?.length ?? 0} Konten. Verwalte Lehrpersonen und Abteilungsleitungen, Status und 2FA.`}
        actions={
          canManageUsers ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <UserPlus className="h-4 w-4" />
              Neuer Benutzer
            </button>
          ) : null
        }
      />

      <div className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Name oder E-Mail suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-modern pl-11"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as 'all' | Role)}
          className="input-modern sm:w-56"
        >
          <option value="all">Alle Rollen</option>
          <option value={Role.LEHRPERSON}>Lehrperson</option>
          <option value={Role.ABTEILUNGSLEITUNG}>Abteilungsleitung</option>
        </select>
        <div className="flex gap-2">
          {(['active', 'inactive', 'all'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                statusFilter === key
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {key === 'active' ? 'Aktiv' : key === 'inactive' ? 'Inaktiv' : 'Alle'}
            </button>
          ))}
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-red border-t-transparent" />
          </div>
        )}

        {isError && <div className="px-6 py-14 text-center text-red-600">Fehler beim Laden der Benutzer.</div>}

        {!isLoading && !isError && filteredUsers.length === 0 && (
          <div className="p-6">
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="Keine Benutzer gefunden"
              description="Passe die Suche/Filter an oder lege einen neuen Benutzer an."
              action={
                canManageUsers ? (
                  <button type="button" className="btn-primary" onClick={openCreate}>
                    <UserPlus className="h-4 w-4" />
                    Benutzer anlegen
                  </button>
                ) : null
              }
            />
          </div>
        )}

        {!isLoading && !isError && filteredUsers.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Name</th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500">E-Mail</th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Rolle</th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500">2FA</th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Letzter Login</th>
                  <th className="px-5 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="transition hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <span className="font-medium text-slate-900">
                        {user.lastName}, {user.firstName}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{user.email}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${rolePillClass(user.role)}`}
                      >
                        {roleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          user.totpEnabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {user.totpEnabled ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          user.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {user.isActive ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{formatLastLogin(user.lastLoginAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {canManageUsers && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(user)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                              title="Bearbeiten"
                            >
                              <PencilLine className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setResetTarget(user)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-amber-200 text-amber-600 transition hover:bg-amber-50"
                              title="2FA zurücksetzen"
                            >
                              <ShieldOff className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleActiveMutation.mutate(user)}
                              disabled={toggleActiveMutation.isPending}
                              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                                user.isActive
                                  ? 'border-rose-200 text-rose-500 hover:bg-rose-50'
                                  : 'border-green-200 text-green-600 hover:bg-green-50'
                              }`}
                              title={user.isActive ? 'Deaktivieren' : 'Aktivieren'}
                            >
                              {user.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ActionModal
        open={editState !== null}
        onOpenChange={(open) => !open && setEditState(null)}
        title={isEdit ? 'Benutzer bearbeiten' : 'Neuen Benutzer anlegen'}
        description="Kontodaten erfassen. Pflichtfelder: E-Mail, Vorname, Nachname und Rolle."
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setEditState(null)}>
              Abbrechen
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={submit}
              disabled={saveMutation.isPending || !canSubmit}
            >
              {saveMutation.isPending ? 'Speichern...' : isEdit ? 'Änderungen speichern' : 'Benutzer anlegen'}
            </button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Vorname *</label>
            <input
              className="input-modern"
              value={form.firstName}
              onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
              placeholder="Anna"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Nachname *</label>
            <input
              className="input-modern"
              value={form.lastName}
              onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
              placeholder="Meier"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">E-Mail *</label>
            <input
              type="email"
              className="input-modern"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="anna.meier@schule.ch"
            />
          </div>
          <div className={isEdit ? 'sm:col-span-2' : ''}>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Rolle *</label>
            <select
              className="input-modern"
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as Role }))}
            >
              <option value={Role.LEHRPERSON}>Lehrperson</option>
              <option value={Role.ABTEILUNGSLEITUNG}>Abteilungsleitung</option>
            </select>
          </div>
          {!isEdit && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Passwort *</label>
              <input
                type="password"
                className="input-modern"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="Mindestens 12 Zeichen"
                autoComplete="new-password"
              />
              <p className="mt-1.5 text-xs text-slate-400">
                Mindestens {PASSWORD_MIN} Zeichen. Wird beim ersten Login benötigt.
              </p>
            </div>
          )}
        </div>
      </ActionModal>

      <ActionModal
        open={resetTarget !== null}
        onOpenChange={(open) => !open && setResetTarget(null)}
        title="2FA zurücksetzen"
        description="Die Zwei-Faktor-Authentifizierung wird entfernt. Der Benutzer muss sie beim nächsten Login neu einrichten."
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setResetTarget(null)}>
              Abbrechen
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => resetTarget && reset2FAMutation.mutate(resetTarget)}
              disabled={reset2FAMutation.isPending}
            >
              {reset2FAMutation.isPending ? 'Zurücksetzen...' : '2FA zurücksetzen'}
            </button>
          </>
        }
      >
        {resetTarget ? (
          <p className="text-sm text-slate-600">
            2FA für{' '}
            <span className="font-medium text-slate-900">
              {resetTarget.firstName} {resetTarget.lastName}
            </span>{' '}
            ({resetTarget.email}) wirklich zurücksetzen?
          </p>
        ) : null}
      </ActionModal>
    </div>
  );
}
