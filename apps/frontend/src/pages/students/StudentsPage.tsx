// Schüler-Liste mit vollständigem CRUD (Anlegen, Bearbeiten, Aktivieren/Deaktivieren)

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, PencilLine, Power, PowerOff, Search, UserPlus, Users } from 'lucide-react';
import type { Student } from '@schuladmin/shared/types/entities';
import { studentsApi, classesApi, apiErrorMessage } from '../../api/endpoints';
import type { StudentInput } from '../../api/endpoints';
import { usePermissions } from '../../hooks/usePermissions';
import { toast } from '../../store/toastStore';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import ActionModal from '../../components/ui/ActionModal';

type EditState = { mode: 'create' } | { mode: 'edit'; student: Student } | null;

const emptyForm: StudentInput = {
  firstName: '',
  lastName: '',
  email: '',
  dateOfBirth: '',
  gender: null,
  classId: '',
};

export default function StudentsPage() {
  const { canManageStudents } = usePermissions();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [editState, setEditState] = useState<EditState>(null);
  const [form, setForm] = useState<StudentInput>(emptyForm);

  const isActiveParam = statusFilter === 'all' ? undefined : statusFilter === 'active';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['students', search, statusFilter],
    queryFn: () => studentsApi.list({ search: search || undefined, isActive: isActiveParam }),
  });

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: classesApi.list,
    enabled: canManageStudents,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['students'] });

  const saveMutation = useMutation({
    mutationFn: (payload: { id?: string; body: StudentInput }) =>
      payload.id ? studentsApi.update(payload.id, payload.body) : studentsApi.create(payload.body),
    onSuccess: (_res, payload) => {
      invalidate();
      setEditState(null);
      toast.success(payload.id ? 'Schüler aktualisiert.' : 'Schüler angelegt.');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Speichern fehlgeschlagen.')),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (student: Student) =>
      student.isActive ? studentsApi.deactivate(student.id) : studentsApi.activate(student.id),
    onSuccess: (_res, student) => {
      invalidate();
      toast.success(student.isActive ? 'Schüler deaktiviert.' : 'Schüler aktiviert.');
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const openCreate = () => {
    setForm({ ...emptyForm, classId: classes?.[0]?.id ?? '' });
    setEditState({ mode: 'create' });
  };

  const openEdit = (student: Student) => {
    setForm({
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email ?? '',
      dateOfBirth: student.dateOfBirth ? student.dateOfBirth.slice(0, 10) : '',
      gender: (student.gender as StudentInput['gender']) ?? null,
      classId: student.classId,
    });
    setEditState({ mode: 'edit', student });
  };

  const canSubmit = form.firstName.trim() && form.lastName.trim() && form.classId;

  const submit = () => {
    if (!canSubmit) {
      toast.error('Bitte Vorname, Nachname und Klasse ausfüllen.');
      return;
    }
    const body: StudentInput = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email?.trim() ? form.email.trim() : null,
      dateOfBirth: form.dateOfBirth ? form.dateOfBirth : null,
      gender: form.gender || null,
      classId: form.classId,
    };
    saveMutation.mutate({ id: editState?.mode === 'edit' ? editState.student.id : undefined, body });
  };

  const classOptions = useMemo(() => classes ?? [], [classes]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Schülerverwaltung"
        title="Schülerinnen & Schüler"
        description={`${data?.length ?? 0} Einträge. Suche nach Name oder E-Mail und verwalte Stammdaten direkt hier.`}
        actions={
          canManageStudents ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <UserPlus className="h-4 w-4" />
              Neuer Schüler
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

        {isError && <div className="px-6 py-14 text-center text-red-600">Fehler beim Laden der Schüler.</div>}

        {!isLoading && data?.length === 0 && (
          <div className="p-6">
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="Keine Schüler gefunden"
              description="Passe die Suche/Filter an oder lege einen neuen Schüler an."
              action={
                canManageStudents ? (
                  <button type="button" className="btn-primary" onClick={openCreate}>
                    <UserPlus className="h-4 w-4" />
                    Schüler anlegen
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
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Name</th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Klasse</th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500">E-Mail</th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-5 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((student) => (
                  <tr key={student.id} className="transition hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <span className="font-medium text-slate-900">
                        {student.lastName}, {student.firstName}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{student.class?.name ?? '–'}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{student.email ?? '–'}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          student.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {student.isActive ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {canManageStudents && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(student)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                              title="Bearbeiten"
                            >
                              <PencilLine className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleActiveMutation.mutate(student)}
                              disabled={toggleActiveMutation.isPending}
                              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                                student.isActive
                                  ? 'border-rose-200 text-rose-500 hover:bg-rose-50'
                                  : 'border-green-200 text-green-600 hover:bg-green-50'
                              }`}
                              title={student.isActive ? 'Deaktivieren' : 'Aktivieren'}
                            >
                              {student.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => void navigate(`/students/${student.id}`)}
                          className="btn-secondary"
                        >
                          Details
                          <ArrowRight className="h-4 w-4" />
                        </button>
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
        title={editState?.mode === 'edit' ? 'Schüler bearbeiten' : 'Neuen Schüler anlegen'}
        description="Stammdaten erfassen. Pflichtfelder: Vorname, Nachname und Klasse."
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setEditState(null)}>
              Abbrechen
            </button>
            <button type="button" className="btn-primary" onClick={submit} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Speichern...' : editState?.mode === 'edit' ? 'Änderungen speichern' : 'Schüler anlegen'}
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
            <label className="mb-1.5 block text-sm font-medium text-slate-700">E-Mail</label>
            <input
              className="input-modern"
              value={form.email ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="anna.meier@student.ch"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Klasse *</label>
            <select
              className="input-modern"
              value={form.classId}
              onChange={(e) => setForm((p) => ({ ...p, classId: e.target.value }))}
            >
              <option value="">— wählen —</option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.schoolYear})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Geburtsdatum</label>
            <input
              type="date"
              className="input-modern"
              value={form.dateOfBirth ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, dateOfBirth: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Geschlecht</label>
            <select
              className="input-modern"
              value={form.gender ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, gender: (e.target.value || null) as StudentInput['gender'] }))}
            >
              <option value="">— keine Angabe —</option>
              <option value="M">Männlich</option>
              <option value="F">Weiblich</option>
              <option value="D">Divers</option>
            </select>
          </div>
        </div>
      </ActionModal>
    </div>
  );
}
