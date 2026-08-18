// Absenzen entschuldigen (nur Leiter)
// Gruppiert nach Klasse; bei Tests: Arztzeugnis erfassen & Scan hochladen

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { AbsenceStatus } from '@schuladmin/shared';
import type { Absence, Class } from '@schuladmin/shared';
import { AlertCircle, CheckCircle2, FileText, Upload } from 'lucide-react';

interface ClassGroup {
  classId: string;
  className: string;
  absences: Absence[];
}

function groupByClass(absences: Absence[]): ClassGroup[] {
  const map = new Map<string, ClassGroup>();
  for (const absence of absences) {
    const classId = absence.student?.class?.id ?? 'unknown';
    const className = absence.student?.class?.name ?? 'Unbekannt';
    if (!map.has(classId)) map.set(classId, { classId, className, absences: [] });
    map.get(classId)!.absences.push(absence);
  }
  return [...map.values()].sort((a, b) => a.className.localeCompare(b.className, 'de'));
}

function canExcuseAbsence(absence: Absence): boolean {
  if (!absence.lesson?.isTest) return true;
  if (absence.hasMedicalCertificate === null) return false;
  if (absence.hasMedicalCertificate && !absence.medicalCertificatePath) return false;
  return true;
}

function AbsenceRow({
  absence,
  onUpdated,
}: {
  absence: Absence;
  onUpdated: () => void;
}) {
  const isTest = absence.lesson?.isTest ?? false;
  const [hasCert, setHasCert] = useState<boolean | null>(absence.hasMedicalCertificate);
  const [file, setFile] = useState<File | null>(null);

  const saveCertMutation = useMutation({
    mutationFn: async () => {
      if (hasCert === null) return;
      const formData = new FormData();
      formData.append('hasMedicalCertificate', hasCert ? 'true' : 'false');
      if (hasCert && file) formData.append('file', file);
      await apiClient.patch(`/api/v1/absences/${absence.id}/medical-certificate`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      setFile(null);
      onUpdated();
    },
  });

  const excuseMutation = useMutation({
    mutationFn: async () => {
      await apiClient.put(`/api/v1/absences/${absence.id}`, {
        status: AbsenceStatus.ENTSCHULDIGT,
      });
    },
    onSuccess: onUpdated,
  });

  const saved = absence.hasMedicalCertificate !== null;
  const canExcuse = canExcuseAbsence(absence);
  const needsCertSave = isTest && (
    hasCert !== absence.hasMedicalCertificate ||
    (hasCert === true && file !== null)
  );

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-neutral-900">
              {absence.student?.lastName}, {absence.student?.firstName}
            </p>
            {isTest && (
              <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                TEST
              </span>
            )}
          </div>
          <p className="text-sm text-neutral-500 mt-1">
            {absence.lesson?.subject?.name ?? 'Lektion'}{' '}
            {absence.lesson?.date
              ? new Date(absence.lesson.date).toLocaleDateString('de-CH')
              : ''}{' '}
            {absence.lesson?.startTime}-{absence.lesson?.endTime}
          </p>
        </div>
        <button
          onClick={() => excuseMutation.mutate()}
          disabled={!canExcuse || excuseMutation.isPending}
          className="flex items-center gap-1.5 bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 px-4 rounded-lg text-sm whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
          title={!canExcuse && isTest ? 'Zuerst Arztzeugnis erfassen' : undefined}
        >
          <CheckCircle2 className="w-4 h-4" />
          Entschuldigen
        </button>
      </div>

      {isTest && (
        <div className="border-t border-neutral-100 pt-3 mt-1 space-y-3">
          <p className="text-sm font-medium text-neutral-700">Arztzeugnis an diesem Test-Tag</p>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setHasCert(true)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                (hasCert ?? absence.hasMedicalCertificate) === true
                  ? 'bg-green-50 border-green-400 text-green-800'
                  : 'border-neutral-300 text-neutral-600'
              }`}
            >
              Ja, vorhanden
            </button>
            <button
              type="button"
              onClick={() => { setHasCert(false); setFile(null); }}
              className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                (hasCert ?? absence.hasMedicalCertificate) === false
                  ? 'bg-neutral-100 border-neutral-400 text-neutral-800'
                  : 'border-neutral-300 text-neutral-600'
              }`}
            >
              Nein, kein Zeugnis
            </button>
          </div>

          {(hasCert === true || absence.hasMedicalCertificate === true) && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-neutral-600 cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Scan hochladen (PDF, JPG, PNG)</span>
                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {file && <p className="text-xs text-neutral-500">{file.name}</p>}
              {absence.medicalCertificateFileName && !file && (
                <a
                  href={`/api/v1/absences/${absence.id}/medical-certificate`}
                  className="inline-flex items-center gap-1 text-sm text-brand-red hover:underline"
                  onClick={(e) => {
                    e.preventDefault();
                    void apiClient
                      .get(`/api/v1/absences/${absence.id}/medical-certificate`, { responseType: 'blob' })
                      .then((res) => {
                        const url = window.URL.createObjectURL(new Blob([res.data as BlobPart]));
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = absence.medicalCertificateFileName ?? 'arztzeugnis.pdf';
                        a.click();
                        window.URL.revokeObjectURL(url);
                      });
                  }}
                >
                  <FileText className="w-4 h-4" />
                  {absence.medicalCertificateFileName}
                </a>
              )}
            </div>
          )}

          {(needsCertSave || (hasCert !== null && !saved)) && (
            <button
              onClick={() => saveCertMutation.mutate()}
              disabled={
                saveCertMutation.isPending ||
                hasCert === null ||
                (hasCert === true && !file && !absence.medicalCertificatePath)
              }
              className="text-sm bg-neutral-800 text-white px-4 py-2 rounded-lg disabled:opacity-40"
            >
              {saveCertMutation.isPending ? 'Speichern...' : 'Angabe speichern'}
            </button>
          )}

          {saved && (
            <p className="text-xs text-green-600">
              Erfasst: {absence.hasMedicalCertificate ? 'Arztzeugnis vorhanden' : 'Kein Arztzeugnis'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AbsenceExcusePage() {
  const queryClient = useQueryClient();
  const [filterClassId, setFilterClassId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['absences-unexcused'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Absence[] }>(
        `/api/v1/absences?status=${AbsenceStatus.UNENTSCHULDIGT}`
      );
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

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['absences-unexcused'] });
    void queryClient.invalidateQueries({ queryKey: ['unexcused-absence-count'] });
  };

  const groups = useMemo(() => groupByClass(data ?? []), [data]);
  const countByClass = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of groups) counts.set(g.classId, g.absences.length);
    return counts;
  }, [groups]);

  const sortedClasses = useMemo(
    () => [...(classes ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'de')),
    [classes]
  );

  const visibleGroups = filterClassId
    ? groups.filter((g) => g.classId === filterClassId)
    : groups;

  const totalOpen = data?.length ?? 0;
  const testCount = data?.filter((a) => a.lesson?.isTest).length ?? 0;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="page-title">Absenzen entschuldigen</h1>
      <p className="page-desc mb-4">
        Nach Klasse sortiert · {totalOpen} offen
        {testCount > 0 && ` · ${testCount} an Test-Tagen (Arztzeugnis erforderlich)`}
      </p>

      {sortedClasses.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Klassen</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterClassId(null)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                filterClassId === null
                  ? 'bg-brand-red-light border-brand-red text-brand-red'
                  : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              Alle
              {totalOpen > 0 && <AlertCircle className="w-4 h-4 text-red-500" />}
            </button>
            {sortedClasses.map((cls) => {
              const openCount = countByClass.get(cls.id) ?? 0;
              const hasOpen = openCount > 0;
              return (
                <button
                  key={cls.id}
                  onClick={() => setFilterClassId(cls.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    filterClassId === cls.id
                      ? 'bg-brand-red-light border-brand-red text-brand-red'
                      : hasOpen
                        ? 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100'
                        : 'bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50'
                  }`}
                >
                  {cls.name}
                  {hasOpen && (
                    <>
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <span className="text-xs font-bold text-red-600">({openCount})</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isLoading && <p className="text-neutral-400">Laden...</p>}

      {!isLoading && totalOpen === 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="text-neutral-500">Keine offenen Absenzen zur Entschuldigung.</p>
        </div>
      )}

      <div className="space-y-6">
        {visibleGroups.map((group) => (
          <section key={group.classId}>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <h2 className="text-lg font-semibold text-neutral-900">{group.className}</h2>
              <span className="text-sm text-red-600 font-medium">
                {group.absences.length} unentschuldigt
              </span>
            </div>
            <div className="space-y-3">
              {group.absences.map((absence) => (
                <AbsenceRow key={absence.id} absence={absence} onUpdated={invalidate} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
