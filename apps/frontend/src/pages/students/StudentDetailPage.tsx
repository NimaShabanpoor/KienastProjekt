// Schüler-Detail-Seite mit Profil, Absenzen, Noten und Admin-Verwaltung

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BadgeAlert,
  CalendarDays,
  FileText,
  GraduationCap,
  PencilLine,
  Power,
  PowerOff,
  UserCircle2,
} from 'lucide-react';
import type { Grade } from '@schuladmin/shared/types/entities';
import { studentsApi, classesApi, apiErrorMessage } from '../../api/endpoints';
import type { StudentInput } from '../../api/endpoints';
import { usePermissions } from '../../hooks/usePermissions';
import { toast } from '../../store/toastStore';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import ActionModal from '../../components/ui/ActionModal';

// Die Noten-API liefert das Fach mit – hier ergänzt für die Anzeige.
type StudentGrade = Grade & {
  subject?: { name: string };
};

const emptyForm: StudentInput = {
  firstName: '',
  lastName: '',
  email: '',
  dateOfBirth: '',
  gender: null,
  classId: '',
};

const genderLabel = (gender: string | null): string =>
  gender === 'M' ? 'Männlich' : gender === 'F' ? 'Weiblich' : gender === 'D' ? 'Divers' : '–';

const formatDate = (value: string | null): string =>
  value ? new Date(value).toLocaleDateString('de-CH') : '–';

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { canManageStudents } = usePermissions();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<StudentInput>(emptyForm);

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: () => studentsApi.get(id!),
    enabled: !!id,
  });

  const { data: absences } = useQuery({
    queryKey: ['student-absences', id],
    queryFn: () => studentsApi.absences(id!),
    enabled: !!id,
  });

  const { data: grades } = useQuery({
    queryKey: ['student-grades', id],
    queryFn: async (): Promise<StudentGrade[]> => studentsApi.grades(id!),
    enabled: !!id,
  });

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: classesApi.list,
    enabled: canManageStudents,
  });

  const invalidateStudent = () => void queryClient.invalidateQueries({ queryKey: ['student', id] });

  const updateMutation = useMutation({
    mutationFn: (body: StudentInput) => studentsApi.update(id!, body),
    onSuccess: () => {
      invalidateStudent();
      setEditOpen(false);
      toast.success('Schüler aktualisiert.');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Speichern fehlgeschlagen.')),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (isActive: boolean) => (isActive ? studentsApi.deactivate(id!) : studentsApi.activate(id!)),
    onSuccess: (_res, isActive) => {
      invalidateStudent();
      toast.success(isActive ? 'Schüler deaktiviert.' : 'Schüler aktiviert.');
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-red border-t-transparent" />
      </div>
    );
  }

  if (!student) return <div className="p-6">Schüler nicht gefunden.</div>;

  const openEdit = () => {
    setForm({
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email ?? '',
      dateOfBirth: student.dateOfBirth ? student.dateOfBirth.slice(0, 10) : '',
      gender: (student.gender as StudentInput['gender']) ?? null,
      classId: student.classId,
    });
    setEditOpen(true);
  };

  const canSubmit = form.firstName.trim() && form.lastName.trim() && form.classId;

  const submit = () => {
    if (!canSubmit) {
      toast.error('Bitte Vorname, Nachname und Klasse ausfüllen.');
      return;
    }
    updateMutation.mutate({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email?.trim() ? form.email.trim() : null,
      dateOfBirth: form.dateOfBirth ? form.dateOfBirth : null,
      gender: form.gender || null,
      classId: form.classId,
    });
  };

  const classOptions = classes ?? [];

  return (
    <div className="max-w-5xl space-y-6">
      <Link to="/students" className="btn-secondary w-fit">
        <ArrowLeft className="h-4 w-4" /> Zurück zur Liste
      </Link>

      <PageHeader
        eyebrow="Schülerprofil"
        title={`${student.firstName} ${student.lastName}`}
        description="Zentrale Detailansicht für persönliche Daten, Absenzen und Noten."
        actions={
          <>
            <Link to={`/zeugnis?student=${student.id}`} className="btn-secondary">
              <FileText className="h-4 w-4" />
              Zeugnis
            </Link>
            {canManageStudents && (
            <>
              <button type="button" className="btn-secondary" onClick={openEdit}>
                <PencilLine className="h-4 w-4" />
                Bearbeiten
              </button>
              <button
                type="button"
                onClick={() => toggleActiveMutation.mutate(student.isActive)}
                disabled={toggleActiveMutation.isPending}
                className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition disabled:opacity-60 ${
                  student.isActive
                    ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                    : 'border-green-200 text-green-700 hover:bg-green-50'
                }`}
              >
                {student.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                {student.isActive ? 'Deaktivieren' : 'Aktivieren'}
              </button>
            </>
            )}
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="stat-card md:col-span-2">
          <div className="flex items-start gap-4">
            <div className="rounded-3xl bg-rose-50 p-4 text-brand-red">
              <UserCircle2 className="h-8 w-8" />
            </div>
            <div className="grid flex-1 gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-slate-500">Klasse</p>
                <p className="mt-1 font-medium text-slate-900">{student.class?.name ?? '–'}</p>
              </div>
              <div>
                <p className="text-slate-500">E-Mail</p>
                <p className="mt-1 font-medium text-slate-900">{student.email ?? '–'}</p>
              </div>
              <div>
                <p className="text-slate-500">Geburtsdatum</p>
                <p className="mt-1 font-medium text-slate-900">{formatDate(student.dateOfBirth)}</p>
              </div>
              <div>
                <p className="text-slate-500">Geschlecht</p>
                <p className="mt-1 font-medium text-slate-900">{genderLabel(student.gender)}</p>
              </div>
              <div>
                <p className="text-slate-500">Status</p>
                <span
                  className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                    student.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {student.isActive ? 'Aktiv' : 'Inaktiv'}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <p className="text-sm text-slate-500">Schnellblick</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{grades?.length ?? 0}</p>
          <p className="text-sm text-slate-500">Noten</p>
          <p className="mt-4 text-2xl font-semibold text-slate-950">{absences?.length ?? 0}</p>
          <p className="text-sm text-slate-500">Absenzen</p>
        </div>
      </div>

      <div className="surface-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Absenzen ({absences?.length ?? 0})</h2>
        {!absences?.length && (
          <EmptyState
            icon={<BadgeAlert className="h-6 w-6" />}
            title="Keine Absenzen vorhanden"
            description="Für diesen Schüler wurden bisher keine Absenzen registriert."
          />
        )}
        {absences?.slice(0, 20).map((absence) => (
          <div
            key={absence.id}
            className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0"
          >
            <div className="flex items-center gap-3">
              <CalendarDays className="h-4 w-4 text-slate-400" />
              <div>
                <span className="text-sm text-slate-700">{absence.lesson?.subject?.name ?? '–'}</span>
                {absence.lesson?.date && (
                  <span className="ml-2 text-xs text-slate-400">{formatDate(absence.lesson.date)}</span>
                )}
              </div>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                absence.status === 'ANWESEND'
                  ? 'bg-green-100 text-green-700'
                  : absence.status === 'ENTSCHULDIGT'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
              }`}
            >
              {absence.status}
            </span>
          </div>
        ))}
      </div>

      <div className="surface-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Noten ({grades?.length ?? 0})</h2>
        {!grades?.length && (
          <EmptyState
            icon={<GraduationCap className="h-6 w-6" />}
            title="Keine Noten vorhanden"
            description="Sobald Noten für diesen Schüler erfasst wurden, erscheinen sie hier mit Fach und Kategorie."
          />
        )}
        {grades?.slice(0, 20).map((grade) => (
          <div
            key={grade.id}
            className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0"
          >
            <div>
              <span className="text-sm font-medium text-slate-900">{grade.subject?.name ?? '–'}</span>
              {grade.category?.name && <span className="ml-2 text-xs text-slate-400">{grade.category.name}</span>}
            </div>
            <span className={`font-mono font-bold ${grade.value >= 4 ? 'text-green-600' : 'text-red-600'}`}>
              {grade.value.toFixed(1)}
            </span>
          </div>
        ))}
      </div>

      <ActionModal
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Schüler bearbeiten"
        description="Stammdaten aktualisieren. Pflichtfelder: Vorname, Nachname und Klasse."
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setEditOpen(false)}>
              Abbrechen
            </button>
            <button type="button" className="btn-primary" onClick={submit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Speichern...' : 'Änderungen speichern'}
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
