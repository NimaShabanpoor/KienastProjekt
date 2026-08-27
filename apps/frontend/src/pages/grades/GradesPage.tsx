// Noten-Seite
// Lehrer: Testtitel + Noten für alle Schüler eines Fachs
// Leiter: Übersicht + Korrekturen

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import type { Grade, Student, GradeCategory } from '@schuladmin/shared';
import { usePermissions } from '../../hooks/usePermissions';
import { GraduationCap, Lock, Plus, Search } from 'lucide-react';

interface TeacherSubject {
  id: string;
  name: string;
  color?: string;
  gradeCategories?: GradeCategory[];
}

const GRADE_OPTIONS = [6, 5.5, 5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1];

export default function GradesPage() {
  const queryClient = useQueryClient();
  const { isTeacher, isLeader } = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [newValue, setNewValue] = useState('4.0');
  const [reason, setReason] = useState('');

  const [subjectId, setSubjectId] = useState('');
  const [gradeClassId, setGradeClassId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [values, setValues] = useState<Record<string, string>>({});

  const { data: mySubjects } = useQuery({
    queryKey: ['my-subjects'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: TeacherSubject[] }>('/api/v1/grades/my-subjects');
      return data.data;
    },
    enabled: isTeacher,
  });

  const selectedSubject = mySubjects?.find((s) => s.id === subjectId);
  const categories = selectedSubject?.gradeCategories ?? [];

  const { data: gradeClasses } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { id: string; name: string }[] }>('/api/v1/classes');
      return data.data;
    },
    enabled: isTeacher && showForm,
  });

  const { data: students } = useQuery({
    queryKey: ['students', gradeClassId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Student[] }>(
        `/api/v1/students?classId=${gradeClassId}`
      );
      return data.data;
    },
    enabled: !!gradeClassId && showForm,
  });

  const sortedStudents = useMemo(() => {
    return [...(students ?? [])].sort((a, b) => {
      const byLast = a.lastName.localeCompare(b.lastName, 'de');
      if (byLast !== 0) return byLast;
      return a.firstName.localeCompare(b.firstName, 'de');
    });
  }, [students]);

  const [gradeSearch, setGradeSearch] = useState('');

  const { data: grades, isLoading } = useQuery({
    queryKey: ['grades', isTeacher ? 'mine' : 'all'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Grade[] }>('/api/v1/grades');
      return data.data;
    },
  });

  const createBatchMutation = useMutation({
    mutationFn: async () => {
      const entries = sortedStudents
        .map((s) => {
          const raw = values[s.id];
          if (raw === undefined || raw === '') return null;
          return { studentId: s.id, value: Number(raw) };
        })
        .filter((e): e is { studentId: string; value: number } => e !== null);

      if (entries.length === 0) {
        throw new Error('Mindestens eine Note eingeben');
      }

      await apiClient.post('/api/v1/grades/batch', {
        subjectId,
        categoryId,
        title: title.trim(),
        date,
        entries,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['grades'] });
      setShowForm(false);
      setTitle('');
      setValues({});
      setCategoryId('');
    },
  });

  const correctMutation = useMutation({
    mutationFn: async () => {
      await apiClient.patch(`/api/v1/grades/${correctingId}/correct`, {
        newValue: Number(newValue),
        reason,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['grades'] });
      setCorrectingId(null);
      setReason('');
    },
  });

  // Schüler-Suche: Notenliste nach Name filtern
  const gradeQuery = gradeSearch.trim().toLowerCase();
  const filteredGrades = gradeQuery
    ? (grades ?? []).filter((g) =>
        `${g.student?.firstName ?? ''} ${g.student?.lastName ?? ''}`
          .toLowerCase()
          .includes(gradeQuery)
      )
    : grades ?? [];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-6 h-6 text-brand-red" />
          <div>
            <h1 className="page-title">Noten</h1>
            <p className="page-desc">
              {isTeacher
                ? 'Testtitel vergeben und Noten für deine Klasse eintragen'
                : 'Notenübersicht und Korrekturen'}
            </p>
          </div>
        </div>
        {isTeacher && (
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-brand-red text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Noten eintragen
          </button>
        )}
      </div>

      {isTeacher && showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createBatchMutation.mutate();
          }}
          className="bg-white rounded-xl border border-neutral-200 p-5 mb-6 space-y-4"
        >
          <h2 className="font-semibold">Neuer Test / neue Bewertung</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Fach</label>
              <select
                required
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  setCategoryId('');
                  setValues({});
                }}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">Fach wählen</option>
                {mySubjects?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Klasse</label>
              <select
                required
                value={gradeClassId}
                onChange={(e) => {
                  setGradeClassId(e.target.value);
                  setValues({});
                }}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">Klasse wählen</option>
                {gradeClasses?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Kategorie</label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                disabled={!subjectId}
              >
                <option value="">Kategorie</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({Math.round(c.weight * 100)}%)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">
                Testtitel
              </label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z.B. Test 1"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Datum</label>
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>

          {sortedStudents.length > 0 && (
            <div className="border border-neutral-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[1fr_120px] gap-3 px-4 py-2 bg-neutral-50 border-b text-xs font-medium text-neutral-500 uppercase">
                <span>Schüler (A–Z)</span>
                <span className="text-center">Note</span>
              </div>
              <ul className="divide-y divide-neutral-100">
                {sortedStudents.map((student) => (
                  <li
                    key={student.id}
                    className="grid grid-cols-[1fr_120px] gap-3 items-center px-4 py-2.5"
                  >
                    <span className="font-medium text-neutral-900">
                      {student.lastName}, {student.firstName}
                    </span>
                    <select
                      value={values[student.id] ?? ''}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [student.id]: e.target.value }))
                      }
                      className="w-full px-2 py-1.5 border rounded-lg text-sm text-center"
                    >
                      <option value="">–</option>
                      {GRADE_OPTIONS.map((g) => (
                        <option key={g} value={String(g)}>
                          {g.toFixed(1)}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="submit"
            disabled={createBatchMutation.isPending || !subjectId || !categoryId || !title.trim()}
            className="bg-brand-red text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            {createBatchMutation.isPending ? 'Speichern...' : 'Noten speichern'}
          </button>
          {createBatchMutation.isError && (
            <p className="text-sm text-red-600">Speichern fehlgeschlagen. Angaben prüfen.</p>
          )}
        </form>
      )}

      {isLeader && correctingId && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            correctMutation.mutate();
          }}
          className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 mb-6 space-y-3"
        >
          <h2 className="font-semibold text-neutral-900">Note korrigieren</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select
              required
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              {GRADE_OPTIONS.map((g) => (
                <option key={g} value={String(g)}>
                  {g.toFixed(1)}
                </option>
              ))}
            </select>
            <input
              required
              minLength={10}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
              placeholder="Begründung (min. 10 Zeichen)"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-brand-red text-white px-4 py-2 rounded-lg text-sm">
              Korrektur speichern
            </button>
            <button
              type="button"
              onClick={() => setCorrectingId(null)}
              className="text-sm text-neutral-600"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          type="text"
          placeholder="Schüler suchen..."
          value={gradeSearch}
          onChange={(e) => setGradeSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
        />
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        {isLoading && <div className="p-8 text-center text-neutral-400">Laden...</div>}
        {!isLoading && !grades?.length && (
          <div className="p-8 text-center">
            <GraduationCap className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-400">Noch keine Noten vorhanden.</p>
          </div>
        )}
        {!isLoading && (grades?.length ?? 0) > 0 && filteredGrades.length === 0 && (
          <div className="p-8 text-center">
            <Search className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
            <p className="text-neutral-400">Keine Noten zu "{gradeSearch.trim()}" gefunden.</p>
          </div>
        )}
        {filteredGrades.map((grade) => (
          <div
            key={grade.id}
            className="flex items-center justify-between p-4 border-b border-neutral-100 last:border-0 gap-3"
          >
            <div className="min-w-0">
              <span className="font-medium text-neutral-900">
                {grade.student
                  ? `${grade.student.lastName}, ${grade.student.firstName}`
                  : '–'}
              </span>
              <p className="text-sm text-neutral-700 font-medium truncate">
                {grade.description || 'Ohne Titel'}
              </p>
              <p className="text-xs text-neutral-500">
                {grade.subject?.name} · {grade.category?.name}
                {grade.date ? ` · ${String(grade.date).slice(0, 10)}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span
                className={`font-mono text-xl font-bold ${
                  grade.value >= 4 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {grade.value.toFixed(1)}
              </span>
              {grade.isLocked && <Lock className="w-4 h-4 text-neutral-400" />}
              {isLeader && grade.isLocked && (
                <button
                  type="button"
                  onClick={() => {
                    setCorrectingId(grade.id);
                    setNewValue(String(grade.value));
                  }}
                  className="text-xs text-brand-red font-medium"
                >
                  Korrigieren
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
