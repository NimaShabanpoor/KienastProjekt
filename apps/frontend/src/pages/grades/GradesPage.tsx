// Noten-Seite: Bewertungen erfassen und (durch die Abteilungsleitung) korrigieren.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GraduationCap, Lock, PenSquare, Plus } from 'lucide-react';
import type { Grade, Student, Subject } from '@schuladmin/shared/types/entities';
import { gradesApi, classesApi, apiErrorMessage } from '../../api/endpoints';
import type { GradeInput } from '../../api/endpoints';
import { usePermissions } from '../../hooks/usePermissions';
import { toast } from '../../store/toastStore';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import ActionModal from '../../components/ui/ActionModal';

// Die Noten-Liste liefert verschachtelte Relationen mit, die der Basistyp
// (Grade) nur teilweise abbildet – hier ergänzt.
type GradeRow = Grade & {
  student?: Pick<Student, 'id' | 'firstName' | 'lastName'>;
  subject?: Pick<Subject, 'id' | 'name'>;
};

interface CreateForm {
  classId: string;
  subjectId: string;
  categoryId: string;
  studentId: string;
  value: string;
  date: string;
  description: string;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyForm: CreateForm = {
  classId: '',
  subjectId: '',
  categoryId: '',
  studentId: '',
  value: '',
  date: '',
  description: '',
};

export default function GradesPage() {
  const { canEditGrades } = usePermissions();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyForm);

  const [correctGrade, setCorrectGrade] = useState<GradeRow | null>(null);
  const [correctValue, setCorrectValue] = useState('');
  const [correctReason, setCorrectReason] = useState('');

  // ---------------- Lese-Abfragen ----------------
  const { data, isLoading, isError } = useQuery({
    queryKey: ['grades'],
    queryFn: () => gradesApi.list() as Promise<GradeRow[]>,
  });

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: classesApi.list,
    enabled: createOpen,
  });

  const { data: subjects } = useQuery({
    queryKey: ['class-subjects', form.classId],
    queryFn: () => classesApi.subjects(form.classId),
    enabled: createOpen && !!form.classId,
  });

  const { data: students } = useQuery({
    queryKey: ['class-students', form.classId],
    queryFn: () => classesApi.students(form.classId),
    enabled: createOpen && !!form.classId,
  });

  const { data: categories } = useQuery({
    queryKey: ['grade-categories', form.subjectId],
    queryFn: () => gradesApi.categories(form.subjectId),
    enabled: createOpen && !!form.subjectId,
  });

  // ---------------- Mutationen ----------------
  const createMutation = useMutation({
    mutationFn: (body: GradeInput) => gradesApi.create(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['grades'] });
      setCreateOpen(false);
      setForm(emptyForm);
      toast.success('Note erfasst.');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Note konnte nicht erfasst werden.')),
  });

  const correctMutation = useMutation({
    mutationFn: (payload: { id: string; newValue: number; reason: string }) =>
      gradesApi.correct(payload.id, payload.newValue, payload.reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['grades'] });
      setCorrectGrade(null);
      setCorrectValue('');
      setCorrectReason('');
      toast.success('Note korrigiert.');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Korrektur fehlgeschlagen.')),
  });

  // ---------------- Aktionen ----------------
  const openCreate = () => {
    setForm({ ...emptyForm, date: todayIso() });
    setCreateOpen(true);
  };

  // Kaskadierende Auswahl: Untergeordnete Felder zurücksetzen.
  const changeClass = (classId: string) =>
    setForm((p) => ({ ...p, classId, subjectId: '', categoryId: '', studentId: '' }));
  const changeSubject = (subjectId: string) =>
    setForm((p) => ({ ...p, subjectId, categoryId: '' }));

  const submitCreate = () => {
    if (!form.classId || !form.subjectId || !form.categoryId || !form.studentId) {
      toast.error('Bitte Klasse, Fach, Kategorie und Schüler auswählen.');
      return;
    }
    const value = Number(form.value);
    if (!form.value || Number.isNaN(value) || value < 1 || value > 6) {
      toast.error('Bitte eine gültige Note zwischen 1 und 6 eingeben.');
      return;
    }
    if (!form.date) {
      toast.error('Bitte ein Datum wählen.');
      return;
    }
    createMutation.mutate({
      studentId: form.studentId,
      subjectId: form.subjectId,
      categoryId: form.categoryId,
      value,
      date: form.date,
      description: form.description.trim() ? form.description.trim() : null,
    });
  };

  const openCorrect = (grade: GradeRow) => {
    setCorrectGrade(grade);
    setCorrectValue(grade.value.toFixed(1));
    setCorrectReason('');
  };

  const submitCorrect = () => {
    if (!correctGrade) return;
    const value = Number(correctValue);
    if (!correctValue || Number.isNaN(value) || value < 1 || value > 6) {
      toast.error('Bitte eine gültige Note zwischen 1 und 6 eingeben.');
      return;
    }
    if (!correctReason.trim()) {
      toast.error('Bitte eine Begründung für die Korrektur angeben.');
      return;
    }
    correctMutation.mutate({ id: correctGrade.id, newValue: value, reason: correctReason.trim() });
  };

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Leistungsübersicht"
        title="Noten"
        description={`${rows.length} Bewertungen. Erfasse Noten im eigenen Fach – gesperrte Noten korrigiert die Abteilungsleitung.`}
        actions={
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Note erfassen
          </button>
        }
      />

      <div className="surface-card overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-red border-t-transparent" />
          </div>
        )}

        {isError && <div className="px-6 py-14 text-center text-red-600">Fehler beim Laden der Noten.</div>}

        {!isLoading && !isError && rows.length === 0 && (
          <div className="p-6">
            <EmptyState
              icon={<GraduationCap className="h-6 w-6" />}
              title="Noch keine Noten vorhanden"
              description="Sobald Bewertungen erfasst wurden, erscheinen sie hier nach Schüler, Fach und Kategorie gruppiert."
              action={
                <button type="button" className="btn-primary" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Note erfassen
                </button>
              }
            />
          </div>
        )}

        {!isLoading && !isError && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Schüler</th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Fach · Kategorie</th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Datum</th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Note</th>
                  <th className="px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-5 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((grade) => (
                  <tr key={grade.id} className="transition hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <span className="font-medium text-slate-900">
                        {grade.student ? `${grade.student.lastName}, ${grade.student.firstName}` : '–'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      <span className="font-medium text-slate-700">{grade.subject?.name ?? '–'}</span>
                      {grade.category?.name ? <span className="text-slate-400"> · {grade.category.name}</span> : null}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {grade.date ? new Date(grade.date).toLocaleDateString('de-CH') : '–'}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`font-mono text-lg font-bold ${
                          grade.value >= 4 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {grade.value.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {grade.isLocked ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                          <Lock className="h-3.5 w-3.5" />
                          Gesperrt
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                          Offen
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {canEditGrades && grade.isLocked && (
                          <button type="button" className="btn-secondary" onClick={() => openCorrect(grade)}>
                            <PenSquare className="h-4 w-4" />
                            Korrigieren
                          </button>
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

      {/* -------- Note erfassen (kaskadierende Auswahl) -------- */}
      <ActionModal
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setForm(emptyForm);
          }
        }}
        title="Note erfassen"
        description="Klasse, Fach, Kategorie und Schüler wählen, dann die Bewertung eintragen. Neue Noten werden sofort gesperrt."
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setCreateOpen(false);
                setForm(emptyForm);
              }}
            >
              Abbrechen
            </button>
            <button type="button" className="btn-primary" onClick={submitCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Speichern...' : 'Note speichern'}
            </button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Klasse *</label>
            <select className="input-modern" value={form.classId} onChange={(e) => changeClass(e.target.value)}>
              <option value="">— wählen —</option>
              {(classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.schoolYear})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Fach *</label>
            <select
              className="input-modern"
              value={form.subjectId}
              onChange={(e) => changeSubject(e.target.value)}
              disabled={!form.classId}
            >
              <option value="">{form.classId ? '— wählen —' : 'Zuerst Klasse wählen'}</option>
              {(subjects ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Kategorie *</label>
            <select
              className="input-modern"
              value={form.categoryId}
              onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}
              disabled={!form.subjectId}
            >
              <option value="">{form.subjectId ? '— wählen —' : 'Zuerst Fach wählen'}</option>
              {(categories ?? []).map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} (Gewicht {cat.weight})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Schüler *</label>
            <select
              className="input-modern"
              value={form.studentId}
              onChange={(e) => setForm((p) => ({ ...p, studentId: e.target.value }))}
              disabled={!form.classId}
            >
              <option value="">{form.classId ? '— wählen —' : 'Zuerst Klasse wählen'}</option>
              {(students ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.lastName}, {s.firstName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Note *</label>
            <input
              type="number"
              step="0.5"
              min="1"
              max="6"
              className="input-modern"
              value={form.value}
              onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))}
              placeholder="z. B. 5.5"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Datum *</label>
            <input
              type="date"
              className="input-modern"
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Beschreibung</label>
            <input
              className="input-modern"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="z. B. Prüfung Kapitel 3 (optional)"
            />
          </div>
        </div>
      </ActionModal>

      {/* -------- Notenkorrektur (nur Abteilungsleitung) -------- */}
      <ActionModal
        open={!!correctGrade}
        onOpenChange={(open) => {
          if (!open) {
            setCorrectGrade(null);
            setCorrectValue('');
            setCorrectReason('');
          }
        }}
        title="Note korrigieren"
        description="Die ursprüngliche Note bleibt als Korrektur-Historie erhalten. Eine Begründung ist zwingend."
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setCorrectGrade(null);
                setCorrectValue('');
                setCorrectReason('');
              }}
            >
              Abbrechen
            </button>
            <button type="button" className="btn-primary" onClick={submitCorrect} disabled={correctMutation.isPending}>
              {correctMutation.isPending ? 'Speichern...' : 'Korrektur speichern'}
            </button>
          </>
        }
      >
        {correctGrade ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-900">
                {correctGrade.student
                  ? `${correctGrade.student.lastName}, ${correctGrade.student.firstName}`
                  : '–'}
              </p>
              <p className="mt-1">
                {correctGrade.subject?.name ?? '–'}
                {correctGrade.category?.name ? ` · ${correctGrade.category.name}` : ''} · aktuelle Note{' '}
                <span className="font-mono font-semibold">{correctGrade.value.toFixed(1)}</span>
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Neue Note *</label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="6"
                className="input-modern"
                value={correctValue}
                onChange={(e) => setCorrectValue(e.target.value)}
                placeholder="z. B. 5.0"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Begründung *</label>
              <textarea
                className="input-modern min-h-28"
                value={correctReason}
                onChange={(e) => setCorrectReason(e.target.value)}
                placeholder="z. B. Bewertungsfehler korrigiert, Nachtrag der Zusatzaufgabe"
              />
            </div>
          </div>
        ) : null}
      </ActionModal>
    </div>
  );
}
