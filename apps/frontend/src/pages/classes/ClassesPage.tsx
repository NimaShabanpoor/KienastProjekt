// Klassen-Verwaltung (nur Abteilungsleitung)
// Vollständiges CRUD: Anlegen, Bearbeiten und Detailansicht mit Schülern & Fächern

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  GraduationCap,
  PencilLine,
  Plus,
  School,
  Users,
} from 'lucide-react';
import type { Class } from '@schuladmin/shared/types/entities';
import { classesApi, apiErrorMessage } from '../../api/endpoints';
import type { ClassInput } from '../../api/endpoints';
import { usePermissions } from '../../hooks/usePermissions';
import { toast } from '../../store/toastStore';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import ActionModal from '../../components/ui/ActionModal';

type FormState = { mode: 'create' } | { mode: 'edit'; cls: Class } | null;

interface ClassForm {
  name: string;
  schoolYear: string;
  semester: string;
}

const emptyForm: ClassForm = { name: '', schoolYear: '', semester: '1' };

const SCHOOL_YEAR_PATTERN = /^\d{4}\/\d{2}$/;

export default function ClassesPage() {
  const { canManageClasses } = usePermissions();
  const queryClient = useQueryClient();

  const [formState, setFormState] = useState<FormState>(null);
  const [form, setForm] = useState<ClassForm>(emptyForm);
  const [detailClass, setDetailClass] = useState<Class | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['classes'],
    queryFn: classesApi.list,
  });

  const { data: detailStudents, isLoading: studentsLoading } = useQuery({
    queryKey: ['classes', detailClass?.id, 'students'],
    queryFn: () => classesApi.students(detailClass!.id),
    enabled: !!detailClass,
  });

  const { data: detailSubjects, isLoading: subjectsLoading } = useQuery({
    queryKey: ['classes', detailClass?.id, 'subjects'],
    queryFn: () => classesApi.subjects(detailClass!.id),
    enabled: !!detailClass,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: { id?: string; body: ClassInput }) =>
      payload.id ? classesApi.update(payload.id, payload.body) : classesApi.create(payload.body),
    onSuccess: (_res, payload) => {
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
      setFormState(null);
      toast.success(payload.id ? 'Klasse aktualisiert.' : 'Klasse angelegt.');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Speichern fehlgeschlagen.')),
  });

  const openCreate = () => {
    setForm(emptyForm);
    setFormState({ mode: 'create' });
  };

  const openEdit = (cls: Class) => {
    setForm({ name: cls.name, schoolYear: cls.schoolYear, semester: String(cls.semester) });
    setFormState({ mode: 'edit', cls });
  };

  const submit = () => {
    const name = form.name.trim();
    const schoolYear = form.schoolYear.trim();
    if (!name || !schoolYear) {
      toast.error('Bitte Klassenname und Schuljahr ausfüllen.');
      return;
    }
    if (!SCHOOL_YEAR_PATTERN.test(schoolYear)) {
      toast.error('Schuljahr muss im Format JJJJ/JJ vorliegen, z. B. 2026/27.');
      return;
    }
    const body: ClassInput = { name, semester: Number(form.semester), schoolYear };
    saveMutation.mutate({ id: formState?.mode === 'edit' ? formState.cls.id : undefined, body });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Verwaltung"
        title="Klassen"
        description={`${data?.length ?? 0} Klassen im Überblick. Öffne eine Klasse für Details zu Schülern und Fächern.`}
        actions={
          canManageClasses ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Neue Klasse
            </button>
          ) : null
        }
      />

      {isLoading && (
        <div className="surface-card flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-red border-t-transparent" />
        </div>
      )}

      {isError && (
        <div className="surface-card px-6 py-14 text-center text-red-600">
          Fehler beim Laden der Klassen.
        </div>
      )}

      {!isLoading && !isError && data && data.length === 0 && (
        <EmptyState
          icon={<School className="h-6 w-6" />}
          title="Noch keine Klassen vorhanden"
          description="Lege eine neue Klasse an, um Schüler und Fächer zu organisieren."
          action={
            canManageClasses ? (
              <button type="button" className="btn-primary" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Klasse anlegen
              </button>
            ) : null
          }
        />
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((cls) => (
            <div
              key={cls.id}
              className="surface-card flex flex-col p-6 transition hover:-translate-y-1"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="rounded-2xl bg-rose-50 p-3 text-brand-red">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                      cls.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {cls.isActive ? 'Aktiv' : 'Inaktiv'}
                  </span>
                  {canManageClasses && (
                    <button
                      type="button"
                      onClick={() => openEdit(cls)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                      title="Bearbeiten"
                    >
                      <PencilLine className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDetailClass(cls)}
                className="group flex flex-1 flex-col text-left"
              >
                <h3 className="text-xl font-semibold text-slate-950">{cls.name}</h3>
                <p className="mt-2 text-sm text-slate-500">
                  {cls.schoolYear} · Semester {cls.semester}
                </p>
                <div className="mt-6 flex items-center gap-2 text-sm font-medium text-brand-red">
                  Details ansehen
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Anlegen / Bearbeiten */}
      <ActionModal
        open={formState !== null}
        onOpenChange={(open) => !open && setFormState(null)}
        title={formState?.mode === 'edit' ? 'Klasse bearbeiten' : 'Neue Klasse anlegen'}
        description="Pflichtfelder: Klassenname und Schuljahr im Format JJJJ/JJ (z. B. 2026/27)."
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setFormState(null)}>
              Abbrechen
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={submit}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending
                ? 'Speichern...'
                : formState?.mode === 'edit'
                  ? 'Änderungen speichern'
                  : 'Klasse anlegen'}
            </button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Klassenname *</label>
            <input
              className="input-modern"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="z. B. INF-2025-A"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Schuljahr *</label>
            <input
              className="input-modern"
              value={form.schoolYear}
              onChange={(e) => setForm((p) => ({ ...p, schoolYear: e.target.value }))}
              placeholder="2026/27"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Semester</label>
            <select
              className="input-modern"
              value={form.semester}
              onChange={(e) => setForm((p) => ({ ...p, semester: e.target.value }))}
            >
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
          </div>
        </div>
      </ActionModal>

      {/* Detailansicht */}
      <ActionModal
        open={!!detailClass}
        onOpenChange={(open) => !open && setDetailClass(null)}
        title={detailClass?.name ?? 'Klasse'}
        description="Detailansicht mit Schülern und Fächern dieser Klasse."
        footer={
          <>
            {canManageClasses && detailClass && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const cls = detailClass;
                  setDetailClass(null);
                  openEdit(cls);
                }}
              >
                <PencilLine className="h-4 w-4" />
                Bearbeiten
              </button>
            )}
            <button type="button" className="btn-primary" onClick={() => setDetailClass(null)}>
              Schließen
            </button>
          </>
        }
      >
        {detailClass ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Schuljahr</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{detailClass.schoolYear}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Semester</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{detailClass.semester}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Status</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {detailClass.isActive ? 'Aktiv' : 'Inaktiv'}
                </p>
              </div>
            </div>

            {/* Schüler */}
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Users className="h-4 w-4 text-brand-red" />
                  Schüler
                </div>
                <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                  {detailStudents?.length ?? 0}
                </span>
              </div>
              {studentsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-red border-t-transparent" />
                </div>
              ) : detailStudents && detailStudents.length > 0 ? (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {detailStudents.map((student) => (
                    <li
                      key={student.id}
                      className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700"
                    >
                      {student.lastName}, {student.firstName}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Keine Schüler zugeordnet.</p>
              )}
            </div>

            {/* Fächer */}
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <GraduationCap className="h-4 w-4 text-brand-red" />
                  Fächer
                </div>
                <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                  {detailSubjects?.length ?? 0}
                </span>
              </div>
              {subjectsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-red border-t-transparent" />
                </div>
              ) : detailSubjects && detailSubjects.length > 0 ? (
                <ul className="space-y-2">
                  {detailSubjects.map((subject) => (
                    <li
                      key={subject.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-slate-800">{subject.name}</span>
                      <span className="text-slate-500">
                        {subject.teacher
                          ? `${subject.teacher.firstName} ${subject.teacher.lastName}`
                          : '–'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Keine Fächer zugeordnet.</p>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <CalendarDays className="h-4 w-4" />
              Angelegt am {new Date(detailClass.createdAt).toLocaleDateString('de-CH')}
            </div>
          </div>
        ) : null}
      </ActionModal>
    </div>
  );
}
