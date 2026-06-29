// Schüler-Detail-Seite

import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { usePermissions } from '../../hooks/usePermissions';
import type { Student, Absence, Grade, Class } from '@schuladmin/shared';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { canManageStudents } = usePermissions();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [classId, setClassId] = useState('');

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Student }>(`/api/v1/students/${id}`);
      return data.data;
    },
    enabled: !!id,
  });

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Class[] }>('/api/v1/classes');
      return data.data;
    },
    enabled: canManageStudents,
  });

  const { data: absences } = useQuery({
    queryKey: ['student-absences', id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Absence[] }>(`/api/v1/students/${id}/absences`);
      return data.data;
    },
    enabled: !!id,
  });

  const { data: grades } = useQuery({
    queryKey: ['student-grades', id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Grade[] }>(`/api/v1/students/${id}/grades`);
      return data.data;
    },
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      await apiClient.put(`/api/v1/students/${id}`, { firstName, lastName, email: email || null, classId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student', id] });
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      setEditing(false);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async () => {
      const endpoint = student?.isActive ? 'deactivate' : 'activate';
      await apiClient.patch(`/api/v1/students/${id}/${endpoint}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student', id] });
      void queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });

  const startEdit = () => {
    if (!student) return;
    setFirstName(student.firstName);
    setLastName(student.lastName);
    setEmail(student.email ?? '');
    setClassId(student.classId);
    setEditing(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-brand-red border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!student) return <div className="p-6">Schüler nicht gefunden.</div>;

  return (
    <div className="p-6 max-w-4xl">
      <Link to="/students" className="flex items-center gap-1 text-sm text-neutral-500 hover:text-brand-red mb-6">
        <ArrowLeft className="w-4 h-4" /> Zurück
      </Link>

      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
        {!editing ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-bold text-neutral-900">{student.firstName} {student.lastName}</h1>
              {canManageStudents && (
                <div className="flex gap-2">
                  <button onClick={startEdit} className="text-sm text-brand-red font-medium">Bearbeiten</button>
                  <button
                    onClick={() => toggleActiveMutation.mutate()}
                    className="text-sm text-neutral-600 font-medium"
                  >
                    {student.isActive ? 'Deaktivieren' : 'Aktivieren'}
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
              <div><span className="text-neutral-500">Klasse:</span> <span className="font-medium">{student.class?.name ?? '–'}</span></div>
              <div><span className="text-neutral-500">E-Mail:</span> <span className="font-medium">{student.email ?? '–'}</span></div>
              <div><span className="text-neutral-500">Status:</span> <span className={`font-medium ${student.isActive ? 'text-green-600' : 'text-neutral-400'}`}>{student.isActive ? 'Aktiv' : 'Inaktiv'}</span></div>
            </div>
          </>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }} className="space-y-4">
            <h2 className="font-semibold">Schüler bearbeiten</h2>
            <div className="grid grid-cols-2 gap-4">
              <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
              <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
              <select required value={classId} onChange={(e) => setClassId(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
                {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-brand-red text-white px-4 py-2 rounded-lg text-sm">Speichern</button>
              <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-neutral-600">Abbrechen</button>
            </div>
          </form>
        )}
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Absenzen ({absences?.length ?? 0})</h2>
        {!absences?.length && <p className="text-neutral-400 text-sm">Keine Absenzen vorhanden.</p>}
        {absences?.map((absence) => (
          <div key={absence.id} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
            <span className="text-sm text-neutral-600">{absence.lesson?.subject?.name ?? '–'}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              absence.status === 'ANWESEND' ? 'bg-green-100 text-green-700' :
              absence.status === 'ENTSCHULDIGT' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>{absence.status}</span>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Noten ({grades?.length ?? 0})</h2>
        {!grades?.length && <p className="text-neutral-400 text-sm">Keine Noten vorhanden.</p>}
        {grades?.map((grade) => (
          <div key={grade.id} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
            <div>
              <span className="text-sm font-medium text-neutral-900">{grade.subject?.name}</span>
              <span className="text-xs text-neutral-400 ml-2">{grade.category?.name}</span>
            </div>
            <span className={`font-mono font-bold ${grade.value >= 4 ? 'text-green-600' : 'text-red-600'}`}>{grade.value.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
