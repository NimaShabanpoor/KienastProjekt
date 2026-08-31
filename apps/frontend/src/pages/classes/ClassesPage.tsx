// Klassen-Verwaltung (nur Leiter)
// Anlegen, Bearbeiten (Name/Schuljahr/Semester/Klassenlehrer) und
// Schüler per Suche in die Klasse aufnehmen.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import type { Class, Student, User } from '@schuladmin/shared';
import { Role } from '@schuladmin/shared';
import { BookOpen, PencilLine, Plus, Search, UserPlus, X } from 'lucide-react';

// Fehlertext aus einer API-Antwort ziehen
function errorText(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { error?: string } } };
  return anyErr?.response?.data?.error ?? fallback;
}

// --------------------------------------------------------
// SCHÜLER-VERWALTUNG einer Klasse (mit Suche)
// --------------------------------------------------------
function ClassStudentsSection({ cls }: { cls: Class }) {
  const queryClient = useQueryClient();
  const [studentSearch, setStudentSearch] = useState('');
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const { data: classStudents } = useQuery({
    queryKey: ['class-students', cls.id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Student[] }>(`/api/v1/classes/${cls.id}/students`);
      return data.data;
    },
  });

  const query = studentSearch.trim();
  const { data: results } = useQuery({
    queryKey: ['student-search', query],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Student[] }>(
        `/api/v1/students?search=${encodeURIComponent(query)}&isActive=true&limit=20`
      );
      return data.data;
    },
    enabled: query.length >= 2,
  });

  const addMutation = useMutation({
    mutationFn: async (student: Student) => {
      await apiClient.put(`/api/v1/students/${student.id}`, { classId: cls.id });
      return student;
    },
    onSuccess: (student) => {
      setFeedback({
        tone: 'ok',
        text: `${student.firstName} ${student.lastName} wurde in die Klasse ${cls.name} aufgenommen.`,
      });
      void queryClient.invalidateQueries({ queryKey: ['class-students', cls.id] });
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      void queryClient.invalidateQueries({ queryKey: ['student-search'] });
    },
    onError: (err) => setFeedback({ tone: 'err', text: errorText(err, 'Hinzufügen fehlgeschlagen.') }),
  });

  const inClassIds = new Set((classStudents ?? []).map((s) => s.id));
  const candidates = (results ?? []).filter((s) => !inClassIds.has(s.id));

  return (
    <div className="border-t border-neutral-100 pt-4 mt-4 space-y-3">
      <h3 className="text-sm font-semibold text-neutral-900">
        Schüler in dieser Klasse ({classStudents?.length ?? 0})
      </h3>

      {(classStudents ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(classStudents ?? []).map((s) => (
            <span
              key={s.id}
              className="inline-block bg-neutral-100 text-neutral-700 text-xs px-2.5 py-1 rounded-full"
            >
              {s.lastName}, {s.firstName}
            </span>
          ))}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Schüler suchen und hinzufügen
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Name oder E-Mail (min. 2 Zeichen)..."
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
          />
        </div>
        {query.length >= 2 && (
          <ul className="mt-2 border border-neutral-200 rounded-lg divide-y divide-neutral-100 overflow-hidden">
            {candidates.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span>
                  <span className="font-medium text-neutral-900">
                    {s.lastName}, {s.firstName}
                  </span>{' '}
                  <span className="text-neutral-500">· aktuell {s.class?.name ?? 'ohne Klasse'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => addMutation.mutate(s)}
                  disabled={addMutation.isPending}
                  className="flex items-center gap-1.5 text-xs font-medium bg-brand-red text-white px-3 py-1.5 rounded-lg hover:bg-brand-red-dark disabled:opacity-50"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Hinzufügen
                </button>
              </li>
            ))}
            {results && candidates.length === 0 && (
              <li className="px-4 py-2.5 text-sm text-neutral-400">
                {results.length > 0
                  ? 'Alle Treffer sind bereits in dieser Klasse.'
                  : 'Keine Schüler gefunden.'}
              </li>
            )}
          </ul>
        )}
      </div>

      {feedback && (
        <p className={`text-sm ${feedback.tone === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
          {feedback.text}
        </p>
      )}
    </div>
  );
}

export default function ClassesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editClass, setEditClass] = useState<Class | null>(null);

  // Formular-Felder (für Anlegen und Bearbeiten)
  const [name, setName] = useState('');
  const [semester, setSemester] = useState(1);
  const [schoolYear, setSchoolYear] = useState('2024/25');
  const [homeroomTeacherId, setHomeroomTeacherId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Class[] }>('/api/v1/classes');
      return data.data;
    },
  });

  const { data: teachers } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: User[] }>(`/api/v1/users?role=${Role.LEHRPERSON}`);
      return data.data;
    },
  });

  const openCreate = () => {
    setEditClass(null);
    setName('');
    setSemester(1);
    setSchoolYear('2024/25');
    setHomeroomTeacherId('');
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (cls: Class) => {
    setShowForm(false);
    setName(cls.name);
    setSemester(cls.semester);
    setSchoolYear(cls.schoolYear);
    setHomeroomTeacherId(cls.homeroomTeacherId ?? '');
    setFormError(null);
    setEditClass(cls);
  };

  const closePanels = () => {
    setShowForm(false);
    setEditClass(null);
    setFormError(null);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ data: Class }>('/api/v1/classes', {
        name,
        semester,
        schoolYear,
        homeroomTeacherId: homeroomTeacherId || null,
      });
      return data.data;
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
      // Direkt ins Bearbeiten wechseln, damit Schüler hinzugefügt werden können
      openEdit(created);
    },
    onError: (err) => setFormError(errorText(err, 'Klasse konnte nicht erstellt werden.')),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.put<{ data: Class }>(`/api/v1/classes/${editClass!.id}`, {
        name,
        semester,
        schoolYear,
        homeroomTeacherId: homeroomTeacherId || null,
      });
      return data.data;
    },
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
      setEditClass(updated);
      setFormError(null);
    },
    onError: (err) => setFormError(errorText(err, 'Speichern fehlgeschlagen.')),
  });

  const assignMutation = useMutation({
    mutationFn: async ({ classId, teacherId }: { classId: string; teacherId: string | null }) => {
      await apiClient.put(`/api/v1/classes/${classId}`, { homeroomTeacherId: teacherId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });

  const isEdit = editClass !== null;
  const panelOpen = showForm || isEdit;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Klassen</h1>
          <p className="page-desc">{data?.length ?? 0} Klassen</p>
        </div>
        <button
          onClick={() => (panelOpen ? closePanels() : openCreate())}
          className="flex items-center gap-2 bg-brand-red hover:bg-brand-red-dark text-white font-medium py-2 px-4 rounded-lg"
        >
          <Plus className="w-4 h-4" /> Neue Klasse
        </button>
      </div>

      {panelOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isEdit) updateMutation.mutate();
            else createMutation.mutate();
          }}
          className="bg-white rounded-xl border border-neutral-200 p-5 mb-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-neutral-900">
              {isEdit ? `Klasse ${editClass.name} bearbeiten` : 'Neue Klasse anlegen'}
            </h2>
            <button
              type="button"
              onClick={closePanels}
              className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              title="Schliessen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              required
              placeholder="Klassenname (z.B. INF-2023-A)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm"
            />
            <input
              required
              placeholder="Schuljahr (z.B. 2024/25)"
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm"
            />
            <select
              value={semester}
              onChange={(e) => setSemester(Number(e.target.value))}
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm"
            >
              <option value={1}>Semester 1</option>
              <option value={2}>Semester 2</option>
            </select>
            <select
              value={homeroomTeacherId}
              onChange={(e) => setHomeroomTeacherId(e.target.value)}
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm"
            >
              <option value="">-- Klassenlehrer wählen --</option>
              {teachers?.map((t) => (
                <option key={t.id} value={t.id}>{t.lastName}, {t.firstName}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            className="bg-brand-red text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {isEdit
              ? updateMutation.isPending ? 'Speichern...' : 'Änderungen speichern'
              : createMutation.isPending ? 'Erstellen...' : 'Klasse erstellen'}
          </button>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          {isEdit && updateMutation.isSuccess && !formError && (
            <p className="text-sm text-green-600">Änderungen gespeichert.</p>
          )}

          {/* Schüler verwalten – erst möglich, wenn die Klasse existiert */}
          {isEdit ? (
            <ClassStudentsSection cls={editClass} />
          ) : (
            <p className="text-xs text-neutral-400">
              Nach dem Erstellen kannst du direkt Schüler zur Klasse hinzufügen.
            </p>
          )}
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <p>Laden...</p>}
        {data?.map((cls) => (
          <div key={cls.id} className="bg-white rounded-xl border border-neutral-200 p-5 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-red-light rounded-lg">
                  <BookOpen className="w-4 h-4 text-brand-red" />
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900">{cls.name}</h3>
                  <p className="text-xs text-neutral-500">{cls.schoolYear} | Semester {cls.semester}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openEdit(cls)}
                className="flex items-center gap-1.5 text-xs font-medium border border-neutral-300 text-neutral-600 px-2.5 py-1.5 rounded-lg hover:bg-neutral-50"
                title="Klasse bearbeiten und Schüler verwalten"
              >
                <PencilLine className="w-3.5 h-3.5" />
                Bearbeiten
              </button>
            </div>
            <p className="text-sm text-neutral-600 mb-3">
              {cls._count?.students ?? 0} Schüler
            </p>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Klassenlehrer</label>
            <select
              value={cls.homeroomTeacherId ?? ''}
              onChange={(e) =>
                assignMutation.mutate({
                  classId: cls.id,
                  teacherId: e.target.value || null,
                })
              }
              className="w-full px-2 py-1.5 border border-neutral-300 rounded-lg text-sm"
            >
              <option value="">-- Nicht zugewiesen --</option>
              {teachers?.map((t) => (
                <option key={t.id} value={t.id}>{t.lastName}, {t.firstName}</option>
              ))}
            </select>
            <span className={`inline-block mt-3 text-xs px-2 py-0.5 rounded-full ${cls.isActive ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}>
              {cls.isActive ? 'Aktiv' : 'Inaktiv'}
            </span>
          </div>
        ))}
        {!isLoading && !data?.length && (
          <div className="col-span-3 text-center py-12">
            <p className="text-neutral-400">Noch keine Klassen. Neue Klasse hinzufügen →</p>
          </div>
        )}
      </div>
    </div>
  );
}
