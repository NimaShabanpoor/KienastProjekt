// Fächer-/Module-Verwaltung – schulweit, mehrere Lehrpersonen, Farbe

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layers, PencilLine, Plus, Power, PowerOff } from 'lucide-react';
import { subjectsApi, usersApi, apiErrorMessage } from '../../api/endpoints';
import type { SubjectListItem, SubjectInput } from '../../api/endpoints';
import { usePermissions } from '../../hooks/usePermissions';
import { toast } from '../../store/toastStore';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import ActionModal from '../../components/ui/ActionModal';

type EditState = { mode: 'create' } | { mode: 'edit'; subject: SubjectListItem } | null;

const COLORS = [
  '#2563EB',
  '#0EA5E9',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#D97706',
  '#64748B',
  '#C8102E',
];

const emptyForm: SubjectInput = { name: '', color: COLORS[0], teacherIds: [] };

export default function SubjectsPage() {
  const { isAdmin } = usePermissions();
  const queryClient = useQueryClient();
  const [editState, setEditState] = useState<EditState>(null);
  const [form, setForm] = useState<SubjectInput>(emptyForm);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectsApi.list(),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
    enabled: isAdmin,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['subjects'] });

  const saveMutation = useMutation({
    mutationFn: (payload: { id?: string; body: SubjectInput }) =>
      payload.id
        ? subjectsApi.update(payload.id, {
            name: payload.body.name,
            color: payload.body.color,
            teacherIds: payload.body.teacherIds,
          })
        : subjectsApi.create(payload.body),
    onSuccess: (_res, payload) => {
      invalidate();
      setEditState(null);
      toast.success(payload.id ? 'Modul aktualisiert.' : 'Modul angelegt.');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Speichern fehlgeschlagen.')),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (subject: SubjectListItem) =>
      subject.isActive ? subjectsApi.deactivate(subject.id) : subjectsApi.activate(subject.id),
    onSuccess: (_res, subject) => {
      invalidate();
      toast.success(subject.isActive ? 'Modul deaktiviert.' : 'Modul aktiviert.');
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const openCreate = () => {
    setForm({ name: '', color: COLORS[(data?.length ?? 0) % COLORS.length], teacherIds: [] });
    setEditState({ mode: 'create' });
  };

  const openEdit = (subject: SubjectListItem) => {
    setForm({
      name: subject.name,
      color: subject.color || COLORS[0],
      teacherIds: (subject.teachers ?? []).map((t) => t.id),
    });
    setEditState({ mode: 'edit', subject });
  };

  const isEdit = editState?.mode === 'edit';
  const canSubmit = form.name.trim() && form.teacherIds.length > 0;

  const submit = () => {
    if (!canSubmit) {
      toast.error('Bitte Modulname und mindestens eine Lehrperson wählen.');
      return;
    }
    saveMutation.mutate({
      id: isEdit ? editState.subject.id : undefined,
      body: { name: form.name.trim(), color: form.color, teacherIds: form.teacherIds },
    });
  };

  const teacherOptions = useMemo(() => (users ?? []).filter((u) => u.isActive), [users]);

  const toggleTeacher = (id: string) => {
    setForm((p) => ({
      ...p,
      teacherIds: p.teacherIds.includes(id)
        ? p.teacherIds.filter((x) => x !== id)
        : [...p.teacherIds, id],
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Unterricht"
        title="Fächer & Module"
        description={`${data?.length ?? 0} Module für alle Klassen. Weise mehreren Lehrpersonen dasselbe Modul zu.`}
        actions={
          isAdmin ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Neues Modul
            </button>
          ) : null
        }
      />

      <div className="surface-card overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-red border-t-transparent" />
          </div>
        )}

        {isError && <div className="px-6 py-14 text-center text-red-600">Fehler beim Laden der Module.</div>}

        {!isLoading && data?.length === 0 && (
          <div className="p-6">
            <EmptyState
              icon={<Layers className="h-6 w-6" />}
              title="Noch keine Module vorhanden"
              description="Lege ein Modul an (z. B. Modul 122) und weise eine oder mehrere Lehrpersonen zu."
              action={
                isAdmin ? (
                  <button type="button" className="btn-primary" onClick={openCreate}>
                    <Plus className="h-4 w-4" />
                    Modul anlegen
                  </button>
                ) : null
              }
            />
          </div>
        )}

        {!isLoading && data && data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Modul / Fach
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Lehrpersonen
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Umfang
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                  {isAdmin && (
                    <th className="px-5 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                      Aktionen
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((subject) => (
                  <tr key={subject.id} className="transition hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className="h-8 w-8 shrink-0 rounded-lg border border-black/5"
                          style={{ backgroundColor: subject.color }}
                        />
                        <span className="font-medium text-slate-900">{subject.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {(subject.teachers ?? []).length === 0
                        ? '–'
                        : (subject.teachers ?? [])
                            .map((t) => `${t.firstName} ${t.lastName}`)
                            .join(', ')}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {subject._count?.lessons ?? 0} Lekt. · {subject._count?.gradeCategories ?? 0} Kat.
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          subject.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {subject.isActive ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(subject)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                            title="Bearbeiten"
                          >
                            <PencilLine className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleActiveMutation.mutate(subject)}
                            disabled={toggleActiveMutation.isPending}
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                              subject.isActive
                                ? 'border-rose-200 text-rose-500 hover:bg-rose-50'
                                : 'border-green-200 text-green-600 hover:bg-green-50'
                            }`}
                            title={subject.isActive ? 'Deaktivieren' : 'Aktivieren'}
                          >
                            {subject.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    )}
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
        title={isEdit ? 'Modul bearbeiten' : 'Neues Modul anlegen'}
        description="Module gelten für alle Klassen. Mehrere Lehrpersonen können dasselbe Modul vertreten."
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setEditState(null)}>
              Abbrechen
            </button>
            <button type="button" className="btn-primary" onClick={submit} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Speichern...' : isEdit ? 'Änderungen speichern' : 'Modul anlegen'}
            </button>
          </>
        }
      >
        <div className="grid gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Modul / Fachname *</label>
            <input
              className="input-modern"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="z. B. Modul 122"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Farbe</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, color: c }))}
                  className={`h-8 w-8 rounded-lg border-2 ${form.color === c ? 'border-neutral-900' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Lehrpersonen *</label>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-neutral-200 p-2">
              {teacherOptions.map((u) => (
                <label key={u.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-neutral-50">
                  <input
                    type="checkbox"
                    checked={form.teacherIds.includes(u.id)}
                    onChange={() => toggleTeacher(u.id)}
                    className="rounded border-neutral-300"
                  />
                  {u.firstName} {u.lastName}
                </label>
              ))}
            </div>
          </div>
        </div>
      </ActionModal>
    </div>
  );
}
