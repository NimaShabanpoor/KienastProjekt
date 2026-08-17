// Fächer-/Module-Verwaltung (z. B. "Modul 120")
// Lesen: alle; Anlegen/Bearbeiten/Deaktivieren: nur Abteilungsleitung.

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookMarked, Layers, PencilLine, Plus, Power, PowerOff } from 'lucide-react';
import { subjectsApi, classesApi, usersApi, apiErrorMessage } from '../../api/endpoints';
import type { SubjectListItem, SubjectInput } from '../../api/endpoints';
import { usePermissions } from '../../hooks/usePermissions';
import { toast } from '../../store/toastStore';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import ActionModal from '../../components/ui/ActionModal';

type EditState = { mode: 'create' } | { mode: 'edit'; subject: SubjectListItem } | null;

const emptyForm: SubjectInput = { name: '', classId: '', teacherId: '' };

export default function SubjectsPage() {
  const { isAdmin } = usePermissions();
  const queryClient = useQueryClient();

  const [classFilter, setClassFilter] = useState('');
  const [editState, setEditState] = useState<EditState>(null);
  const [form, setForm] = useState<SubjectInput>(emptyForm);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['subjects', classFilter],
    queryFn: () => subjectsApi.list({ classId: classFilter || undefined }),
  });

  const { data: classes } = useQuery({ queryKey: ['classes'], queryFn: classesApi.list });

  // Lehrpersonen nur laden, wenn Verwaltung möglich (Users-Endpunkt ist admin-only)
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
    enabled: isAdmin,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['subjects'] });

  const saveMutation = useMutation({
    mutationFn: (payload: { id?: string; body: SubjectInput }) =>
      payload.id
        ? subjectsApi.update(payload.id, { name: payload.body.name, teacherId: payload.body.teacherId })
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
    setForm({ name: '', classId: classFilter || classes?.[0]?.id || '', teacherId: '' });
    setEditState({ mode: 'create' });
  };

  const openEdit = (subject: SubjectListItem) => {
    setForm({ name: subject.name, classId: subject.classId, teacherId: subject.teacherId });
    setEditState({ mode: 'edit', subject });
  };

  const isEdit = editState?.mode === 'edit';
  const canSubmit = form.name.trim() && form.classId && form.teacherId;

  const submit = () => {
    if (!canSubmit) {
      toast.error('Bitte Modulname, Klasse und Lehrperson wählen.');
      return;
    }
    saveMutation.mutate({
      id: isEdit ? editState.subject.id : undefined,
      body: { name: form.name.trim(), classId: form.classId, teacherId: form.teacherId },
    });
  };

  const teacherOptions = useMemo(() => (users ?? []).filter((u) => u.isActive), [users]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Unterricht"
        title="Fächer & Module"
        description={`${data?.length ?? 0} Module. Erfasse Module (z. B. „Modul 120"), weise sie einer Klasse und einer Lehrperson zu.`}
        actions={
          isAdmin ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Neues Modul
            </button>
          ) : null
        }
      />

      <div className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <label className="text-sm font-medium text-slate-600">Klasse filtern</label>
        <select
          className="input-modern sm:max-w-xs"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        >
          <option value="">Alle Klassen</option>
          {classes?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.schoolYear})
            </option>
          ))}
        </select>
      </div>

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
              description={'Lege dein erstes Modul an (z. B. "Modul 120") und weise es einer Klasse und einer Lehrperson zu.'}
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
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Modul / Fach</th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Klasse</th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Lehrperson</th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Umfang</th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
                  {isAdmin && (
                    <th className="px-5 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Aktionen</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((subject) => (
                  <tr key={subject.id} className="transition hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-rose-50 p-2 text-brand-red">
                          <BookMarked className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-slate-900">{subject.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{subject.class?.name ?? '–'}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {subject.teacher ? `${subject.teacher.firstName} ${subject.teacher.lastName}` : '–'}
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
        description="Erfasse ein Modul/Fach und weise es einer Klasse und einer Lehrperson zu."
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
              placeholder="z. B. Modul 120 – ICT-Berufsbildung analysieren"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Klasse *</label>
              <select
                className="input-modern"
                value={form.classId}
                onChange={(e) => setForm((p) => ({ ...p, classId: e.target.value }))}
                disabled={isEdit}
              >
                <option value="">— wählen —</option>
                {classes?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.schoolYear})
                  </option>
                ))}
              </select>
              {isEdit && (
                <p className="mt-1 text-xs text-slate-400">Die Klasse eines bestehenden Moduls ist fix.</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Lehrperson *</label>
              <select
                className="input-modern"
                value={form.teacherId}
                onChange={(e) => setForm((p) => ({ ...p, teacherId: e.target.value }))}
              >
                <option value="">— wählen —</option>
                {teacherOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </ActionModal>
    </div>
  );
}
