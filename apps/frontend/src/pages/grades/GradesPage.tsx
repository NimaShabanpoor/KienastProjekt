// Noten-Seite (Leiter)

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import type { Grade, Class, Student, Subject, GradeCategory } from '@schuladmin/shared';
import { GraduationCap, Lock, Plus } from 'lucide-react';

export default function GradesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [newValue, setNewValue] = useState('4.0');
  const [reason, setReason] = useState('');

  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [value, setValue] = useState('4.0');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['grades'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Grade[] }>('/api/v1/grades');
      return data.data;
    },
  });

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Class[] }>('/api/v1/classes');
      return data.data;
    },
  });

  const { data: students } = useQuery({
    queryKey: ['students', classId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Student[] }>(`/api/v1/students?classId=${classId}`);
      return data.data;
    },
    enabled: !!classId,
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects', classId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Subject[] }>(`/api/v1/classes/${classId}/subjects`);
      return data.data;
    },
    enabled: !!classId,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories', subjectId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: GradeCategory[] }>(`/api/v1/grades/subjects/${subjectId}/categories`);
      return data.data;
    },
    enabled: !!subjectId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/api/v1/grades', {
        studentId,
        subjectId,
        categoryId,
        value: Number(value),
        date,
        description: description || null,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['grades'] });
      setShowForm(false);
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-6 h-6 text-brand-red" />
          <h1 className="text-2xl font-bold text-neutral-900">Noten</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-brand-red text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Note hinzufügen
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
          className="bg-white rounded-xl border border-neutral-200 p-5 mb-6 space-y-4"
        >
          <h2 className="font-semibold">Neue Note</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <select required value={classId} onChange={(e) => { setClassId(e.target.value); setSubjectId(''); setStudentId(''); }} className="px-3 py-2 border rounded-lg text-sm">
              <option value="">Klasse</option>
              {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select required value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setCategoryId(''); }} className="px-3 py-2 border rounded-lg text-sm" disabled={!classId}>
              <option value="">Fach</option>
              {subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select required value={studentId} onChange={(e) => setStudentId(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" disabled={!classId}>
              <option value="">Schüler</option>
              {students?.map((s) => <option key={s.id} value={s.id}>{s.lastName}, {s.firstName}</option>)}
            </select>
            <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" disabled={!subjectId}>
              <option value="">Kategorie</option>
              {categories?.map((c) => <option key={c.id} value={c.id}>{c.name} ({Math.round(c.weight * 100)}%)</option>)}
            </select>
            <input required type="number" step="0.5" min="1" max="6" value={value} onChange={(e) => setValue(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" placeholder="Note" />
            <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="px-3 py-2 border rounded-lg text-sm sm:col-span-2" placeholder="Beschreibung (optional)" />
          </div>
          <button type="submit" disabled={createMutation.isPending} className="bg-brand-red text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">Speichern</button>
        </form>
      )}

      {correctingId && (
        <form
          onSubmit={(e) => { e.preventDefault(); correctMutation.mutate(); }}
          className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 mb-6 space-y-3"
        >
          <h2 className="font-semibold text-neutral-900">Note korrigieren</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input required type="number" step="0.5" min="1" max="6" value={newValue} onChange={(e) => setNewValue(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
            <input required minLength={10} value={reason} onChange={(e) => setReason(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" placeholder="Begründung (min. 10 Zeichen)" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-brand-red text-white px-4 py-2 rounded-lg text-sm">Korrektur speichern</button>
            <button type="button" onClick={() => setCorrectingId(null)} className="text-sm text-neutral-600">Abbrechen</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        {isLoading && <div className="p-8 text-center text-neutral-400">Laden...</div>}
        {!isLoading && !data?.length && (
          <div className="p-8 text-center">
            <GraduationCap className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-400">Noch keine Noten vorhanden.</p>
          </div>
        )}
        {data?.map((grade) => (
          <div key={grade.id} className="flex items-center justify-between p-4 border-b border-neutral-100 last:border-0">
            <div>
              <span className="font-medium text-neutral-900">
                {grade.student ? `${grade.student.lastName}, ${grade.student.firstName}` : '–'}
              </span>
              <p className="text-sm text-neutral-500">{grade.subject?.name} – {grade.category?.name}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`font-mono text-xl font-bold ${grade.value >= 4 ? 'text-green-600' : 'text-red-600'}`}>
                {grade.value.toFixed(1)}
              </span>
              {grade.isLocked && <Lock className="w-4 h-4 text-neutral-400" />}
              {grade.isLocked && (
                <button onClick={() => { setCorrectingId(grade.id); setNewValue(String(grade.value)); }} className="text-xs text-brand-red font-medium">
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
