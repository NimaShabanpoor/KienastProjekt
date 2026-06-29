// Klassen-Verwaltung (nur Leiter)

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import type { Class, User, Subject } from '@schuladmin/shared';
import { Role } from '@schuladmin/shared';
import { Plus, BookOpen } from 'lucide-react';

export default function ClassesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [semester, setSemester] = useState(1);
  const [schoolYear, setSchoolYear] = useState('2024/25');
  const [homeroomTeacherId, setHomeroomTeacherId] = useState('');
  const [subjectClassId, setSubjectClassId] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [subjectTeacherId, setSubjectTeacherId] = useState('');

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

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/api/v1/classes', {
        name,
        semester,
        schoolYear,
        homeroomTeacherId: homeroomTeacherId || null,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
      setShowForm(false);
      setName('');
      setHomeroomTeacherId('');
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ classId, teacherId }: { classId: string; teacherId: string | null }) => {
      await apiClient.put(`/api/v1/classes/${classId}`, { homeroomTeacherId: teacherId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });

  const { data: classSubjects } = useQuery({
    queryKey: ['subjects', subjectClassId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Subject[] }>(`/api/v1/classes/${subjectClassId}/subjects`);
      return data.data;
    },
    enabled: !!subjectClassId,
  });

  const createSubjectMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/api/v1/classes/${subjectClassId}/subjects`, {
        name: subjectName,
        teacherId: subjectTeacherId,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['subjects', subjectClassId] });
      setSubjectName('');
      setSubjectTeacherId('');
    },
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Klassen</h1>
          <p className="text-neutral-500 mt-1">{data?.length ?? 0} Klassen</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-brand-red hover:bg-brand-red-dark text-white font-medium py-2 px-4 rounded-lg"
        >
          <Plus className="w-4 h-4" /> Neue Klasse
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
          className="bg-white rounded-xl border border-neutral-200 p-5 mb-6 space-y-4"
        >
          <h2 className="font-semibold text-neutral-900">Neue Klasse anlegen</h2>
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
            disabled={createMutation.isPending}
            className="bg-brand-red text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            Klasse erstellen
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <p>Laden...</p>}
        {data?.map((cls) => (
          <div key={cls.id} className="bg-white rounded-xl border border-neutral-200 p-5 hover:shadow-md transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-brand-red-light rounded-lg">
                <BookOpen className="w-4 h-4 text-brand-red" />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900">{cls.name}</h3>
                <p className="text-xs text-neutral-500">{cls.schoolYear} | Semester {cls.semester}</p>
              </div>
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

      <div className="mt-8 bg-white rounded-xl border border-neutral-200 p-5">
        <h2 className="font-semibold text-neutral-900 mb-4">Fächer verwalten</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <select value={subjectClassId} onChange={(e) => setSubjectClassId(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
            <option value="">Klasse wählen</option>
            {data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="Fachname" className="px-3 py-2 border rounded-lg text-sm" disabled={!subjectClassId} />
          <select value={subjectTeacherId} onChange={(e) => setSubjectTeacherId(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" disabled={!subjectClassId}>
            <option value="">Fachlehrer</option>
            {teachers?.map((t) => <option key={t.id} value={t.id}>{t.lastName}, {t.firstName}</option>)}
          </select>
        </div>
        <button
          disabled={!subjectClassId || !subjectName || !subjectTeacherId || createSubjectMutation.isPending}
          onClick={() => createSubjectMutation.mutate()}
          className="bg-brand-red text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 mb-4"
        >
          Fach hinzufügen
        </button>
        {subjectClassId && (
          <div className="space-y-2">
            {classSubjects?.length === 0 && <p className="text-sm text-neutral-400">Noch keine Fächer in dieser Klasse.</p>}
            {classSubjects?.map((s) => (
              <div key={s.id} className="flex justify-between text-sm py-2 border-b border-neutral-100">
                <span className="font-medium">{s.name}</span>
                <span className="text-neutral-500">{s.teacher ? `${s.teacher.lastName}, ${s.teacher.firstName}` : '–'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
