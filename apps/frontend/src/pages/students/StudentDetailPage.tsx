// Schüler-Detail-Seite

import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import type { Student, Absence, Grade } from '@schuladmin/shared';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Student }>(`/api/v1/students/${id}`);
      return data.data;
    },
    enabled: !!id,
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
        <h1 className="text-2xl font-bold text-neutral-900">
          {student.firstName} {student.lastName}
        </h1>
        <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
          <div><span className="text-neutral-500">Klasse:</span> <span className="font-medium">{student.class?.name ?? '–'}</span></div>
          <div><span className="text-neutral-500">E-Mail:</span> <span className="font-medium">{student.email ?? '–'}</span></div>
          <div><span className="text-neutral-500">Status:</span> <span className={`font-medium ${student.isActive ? 'text-green-600' : 'text-neutral-400'}`}>{student.isActive ? 'Aktiv' : 'Inaktiv'}</span></div>
        </div>
      </div>

      {/* Absenzen-Übersicht */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Absenzen ({absences?.length ?? 0})</h2>
        {!absences?.length && <p className="text-neutral-400 text-sm">Keine Absenzen vorhanden.</p>}
        {absences?.slice(0, 10).map((absence) => (
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

      {/* Noten-Übersicht */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Noten ({grades?.length ?? 0})</h2>
        {!grades?.length && <p className="text-neutral-400 text-sm">Keine Noten vorhanden.</p>}
        {grades?.slice(0, 10).map((grade) => (
          <div key={grade.id} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
            <div>
              <span className="text-sm font-medium text-neutral-900">{grade.subject?.name}</span>
              <span className="text-xs text-neutral-400 ml-2">{grade.category?.name}</span>
            </div>
            <span className={`font-mono font-bold ${
              grade.value >= 4 ? 'text-green-600' : 'text-red-600'
            }`}>{grade.value.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
