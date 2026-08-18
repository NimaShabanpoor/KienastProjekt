// Schüler-Detail: Stammdaten + Absenzen + Noten (Admin & Lehrperson)

import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { usePermissions } from '../../hooks/usePermissions';
import type { Student, Absence, Grade, Class } from '@schuladmin/shared';
import { ArrowLeft, CalendarX2, GraduationCap } from 'lucide-react';

const STATUS_LABEL: Record<string, string> = {
  ANWESEND: 'Anwesend',
  ENTSCHULDIGT: 'Entschuldigt',
  UNENTSCHULDIGT: 'Unentschuldigt',
};

function formatDate(value: string | undefined): string {
  if (!value) return '–';
  const raw = value.slice(0, 10);
  const d = new Date(raw + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function statusBadgeClass(status: string): string {
  if (status === 'ANWESEND') return 'bg-green-100 text-green-700';
  if (status === 'ENTSCHULDIGT') return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-700';
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { canManageStudents } = usePermissions();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [classId, setClassId] = useState('');
  const [absenceFilter, setAbsenceFilter] = useState<'missing' | 'all'>('missing');

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

  const { data: absences, isLoading: absencesLoading } = useQuery({
    queryKey: ['student-absences', id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Absence[] }>(`/api/v1/students/${id}/absences`);
      return data.data;
    },
    enabled: !!id,
  });

  const { data: grades, isLoading: gradesLoading } = useQuery({
    queryKey: ['student-grades', id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Grade[] }>(`/api/v1/students/${id}/grades`);
      return data.data;
    },
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      await apiClient.put(`/api/v1/students/${id}`, {
        firstName,
        lastName,
        email: email || null,
        classId,
      });
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

  const absenceStats = useMemo(() => {
    const list = absences ?? [];
    return {
      entschuldigt: list.filter((a) => a.status === 'ENTSCHULDIGT').length,
      unentschuldigt: list.filter((a) => a.status === 'UNENTSCHULDIGT').length,
      anwesend: list.filter((a) => a.status === 'ANWESEND').length,
      totalMissing: list.filter((a) => a.status !== 'ANWESEND').length,
    };
  }, [absences]);

  const filteredAbsences = useMemo(() => {
    const list = absences ?? [];
    if (absenceFilter === 'all') return list;
    return list.filter((a) => a.status !== 'ANWESEND');
  }, [absences, absenceFilter]);

  const gradesBySubject = useMemo(() => {
    const map = new Map<string, { subjectName: string; grades: Grade[] }>();
    for (const g of grades ?? []) {
      const key = g.subjectId;
      const name = g.subject?.name ?? 'Unbekanntes Fach';
      if (!map.has(key)) map.set(key, { subjectName: name, grades: [] });
      map.get(key)!.grades.push(g);
    }
    return [...map.values()].sort((a, b) => a.subjectName.localeCompare(b.subjectName, 'de'));
  }, [grades]);

  const startEdit = (): void => {
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

  if (!student) return <div>Schüler nicht gefunden.</div>;

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        to="/students"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-brand-red mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Zurück zur Schülerliste
      </Link>

      {/* Stammdaten */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6 shadow-sm">
        {!editing ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-neutral-900">
                  {student.firstName} {student.lastName}
                </h1>
                <span
                  className={`inline-flex mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                    student.isActive
                      ? 'bg-green-100 text-green-700'
                      : 'bg-neutral-100 text-neutral-500'
                  }`}
                >
                  {student.isActive ? 'Aktiv' : 'Inaktiv'}
                </span>
              </div>
              {canManageStudents && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={startEdit}
                    className="text-sm text-brand-red font-medium px-3 py-1.5"
                  >
                    Bearbeiten
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const action = student.isActive ? 'deaktivieren' : 'aktivieren';
                      if (window.confirm(`Schüler wirklich ${action}?`)) {
                        toggleActiveMutation.mutate();
                      }
                    }}
                    disabled={toggleActiveMutation.isPending}
                    className={`text-sm font-medium px-3 py-1.5 rounded-lg border disabled:opacity-50 ${
                      student.isActive
                        ? 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                        : 'border-green-200 text-green-700 hover:bg-green-50'
                    }`}
                  >
                    {student.isActive ? 'Inaktiv setzen' : 'Wieder aktivieren'}
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-sm">
              <div>
                <span className="text-neutral-500">Klasse:</span>{' '}
                <span className="font-medium text-neutral-900">{student.class?.name ?? '–'}</span>
              </div>
              <div>
                <span className="text-neutral-500">E-Mail:</span>{' '}
                <span className="font-medium text-neutral-900">{student.email ?? '–'}</span>
              </div>
            </div>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate();
            }}
            className="space-y-4"
          >
            <h2 className="font-semibold">Schüler bearbeiten</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
                placeholder="Vorname"
              />
              <input
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
                placeholder="Nachname"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
                placeholder="E-Mail"
              />
              <select
                required
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                {classes?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-brand-red text-white px-4 py-2 rounded-lg text-sm">
                Speichern
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-sm text-neutral-600"
              >
                Abbrechen
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Absenzen */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <CalendarX2 className="w-5 h-5 text-brand-red" />
            <h2 className="text-lg font-semibold text-neutral-900">Absenzen</h2>
          </div>
          <div className="flex gap-1 rounded-lg border border-neutral-200 p-0.5 bg-neutral-50">
            <button
              type="button"
              onClick={() => setAbsenceFilter('missing')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                absenceFilter === 'missing'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500'
              }`}
            >
              Fehlzeiten
            </button>
            <button
              type="button"
              onClick={() => setAbsenceFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                absenceFilter === 'all'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500'
              }`}
            >
              Alle Einträge
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3">
            <p className="text-xs text-neutral-500 uppercase tracking-wide">Fehlende Lektionen</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">{absenceStats.totalMissing}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
            <p className="text-xs text-amber-800/70 uppercase tracking-wide">Entschuldigt</p>
            <p className="text-2xl font-bold text-amber-900 mt-1">{absenceStats.entschuldigt}</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 col-span-2 sm:col-span-1">
            <p className="text-xs text-red-700/70 uppercase tracking-wide">Unentschuldigt</p>
            <p className="text-2xl font-bold text-red-700 mt-1">{absenceStats.unentschuldigt}</p>
          </div>
        </div>

        {absencesLoading && (
          <p className="text-sm text-neutral-400 py-4">Absenzen werden geladen…</p>
        )}
        {!absencesLoading && filteredAbsences.length === 0 && (
          <p className="text-sm text-neutral-400 py-4">
            {absenceFilter === 'missing'
              ? 'Keine Fehlzeiten erfasst.'
              : 'Keine Absenz-Einträge vorhanden.'}
          </p>
        )}
        {!absencesLoading && filteredAbsences.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 text-left">
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Datum
                  </th>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Zeit
                  </th>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Fach
                  </th>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Status
                  </th>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Bemerkung
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredAbsences.map((absence) => (
                  <tr key={absence.id} className="hover:bg-neutral-50/80">
                    <td className="px-3 py-2.5 whitespace-nowrap text-neutral-900 font-medium">
                      {formatDate(absence.lesson?.date)}
                      {absence.lesson?.isTest && (
                        <span className="ml-1.5 text-[10px] uppercase font-bold text-brand-red">
                          Test
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-xs text-neutral-600">
                      {absence.lesson?.startTime && absence.lesson?.endTime
                        ? `${absence.lesson.startTime}–${absence.lesson.endTime}`
                        : '–'}
                    </td>
                    <td className="px-3 py-2.5 text-neutral-800">
                      {absence.lesson?.subject?.name ?? '–'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(
                          absence.status
                        )}`}
                      >
                        {STATUS_LABEL[absence.status] ?? absence.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-neutral-500 max-w-[14rem] truncate">
                      {absence.note || '–'}
                      {absence.hasMedicalCertificate && (
                        <span className="ml-1 text-xs text-sky-700">· Arztzeugnis</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Noten */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap className="w-5 h-5 text-brand-red" />
          <h2 className="text-lg font-semibold text-neutral-900">
            Noten{grades?.length ? ` (${grades.length})` : ''}
          </h2>
        </div>

        {gradesLoading && (
          <p className="text-sm text-neutral-400 py-4">Noten werden geladen…</p>
        )}
        {!gradesLoading && gradesBySubject.length === 0 && (
          <p className="text-sm text-neutral-400 py-4">Keine Noten vorhanden.</p>
        )}

        <div className="space-y-5">
          {gradesBySubject.map((group) => {
            const avg =
              group.grades.reduce((sum, g) => sum + g.value, 0) / group.grades.length;
            return (
              <div
                key={group.subjectName}
                className="rounded-xl border border-neutral-200 overflow-hidden"
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-neutral-50 border-b border-neutral-200">
                  <h3 className="font-semibold text-neutral-900">{group.subjectName}</h3>
                  <div className="text-sm text-neutral-500">
                    Ø{' '}
                    <span
                      className={`font-mono font-bold ${
                        avg >= 4 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {avg.toFixed(2)}
                    </span>
                    <span className="text-neutral-400 ml-2">
                      ({group.grades.length}{' '}
                      {group.grades.length === 1 ? 'Note' : 'Noten'})
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-neutral-100">
                        <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Datum
                        </th>
                        <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Titel / Beschreibung
                        </th>
                        <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Kategorie
                        </th>
                        <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 text-right">
                          Note
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {group.grades.map((grade) => (
                        <tr key={grade.id} className="hover:bg-neutral-50/80">
                          <td className="px-4 py-2.5 whitespace-nowrap text-neutral-700">
                            {formatDate(grade.date)}
                          </td>
                          <td className="px-4 py-2.5 text-neutral-900">
                            {grade.description || '–'}
                          </td>
                          <td className="px-4 py-2.5 text-neutral-500">
                            {grade.category?.name ?? '–'}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-mono font-bold ${
                              grade.value >= 4 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {grade.value.toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
