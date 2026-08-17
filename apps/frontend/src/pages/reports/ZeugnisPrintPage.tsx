// Semesterzeugnis-Druckvorlage nach Benedict-Muster
// Kopf: Benedict-Logo + Adresse, Titel "Semesterzeugnis für <Name>", geboren am <Datum>.
// Tabelle: Module/Fächer mit Noten pro Semesterspalte, Erfahrungsnote, Anwesenheit,
// Promotion. Unten: Notenerläuterung, Datum/Unterschrift, Rechtsmittelbelehrung.

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Grade } from '@schuladmin/shared/types/entities';
import { studentsApi, gradesApi } from '../../api/endpoints';
import { usePermissions } from '../../hooks/usePermissions';
import PageHeader from '../../components/ui/PageHeader';

type StudentGrade = Grade & { subject?: { name: string } };

const roundToHalf = (v: number): number => Math.round(v * 2) / 2;

// Note anzeigen: 5 statt 5.0, sonst 4.5
const fmtGrade = (v: number): string => (v % 1 === 0 ? String(v) : v.toFixed(1));

// "Modul 120 – ICT-…" -> Kurzname + Untertitel
const splitName = (name: string): { short: string; rest: string | null } => {
  const parts = name.split(/\s+[–-]\s+/);
  return { short: parts[0] ?? name, rest: parts.length > 1 ? parts.slice(1).join(' – ') : null };
};

export default function ZeugnisPrintPage() {
  const { isAdmin } = usePermissions();
  const [searchParams] = useSearchParams();

  const [studentId, setStudentId] = useState(() => searchParams.get('student') ?? '');
  const [title, setTitle] = useState('Semesterzeugnis');
  const [semesterLabels, setSemesterLabels] = useState<string[]>([
    '1. Semester',
    '2. Semester',
    '3. Semester',
    '4. Semester',
  ]);
  const [valueColumn, setValueColumn] = useState<number | null>(null);
  const [dateLine, setDateLine] = useState(format(new Date(), 'd. MMMM yyyy', { locale: de }));
  const [signerName, setSignerName] = useState('Jan Rzejak');
  const [signerRole, setSignerRole] = useState('Bereichsleitung Tageshandelsschule');

  const { data: students } = useQuery({ queryKey: ['students-all'], queryFn: () => studentsApi.list() });
  const student = useMemo(() => students?.find((s) => s.id === studentId), [students, studentId]);

  const { data: grades } = useQuery({
    queryKey: ['zeugnis-grades', studentId],
    queryFn: () => studentsApi.grades(studentId) as Promise<StudentGrade[]>,
    enabled: !!studentId,
  });

  const { data: absences } = useQuery({
    queryKey: ['zeugnis-absences', studentId],
    queryFn: () => studentsApi.absences(studentId),
    enabled: !!studentId,
  });

  // Promotionsstatus (Endpunkt ist der Abteilungsleitung vorbehalten)
  const { data: promotion } = useQuery({
    queryKey: ['zeugnis-promotion', student?.classId, student?.class?.schoolYear],
    queryFn: () => gradesApi.promotionCheck(student!.classId, student!.class!.schoolYear),
    enabled: isAdmin && !!student?.class?.schoolYear,
  });

  // Spalte, in der die aktuellen Werte stehen (Standard: Semester der Klasse)
  const activeColumn = useMemo(() => {
    if (valueColumn !== null) return valueColumn;
    const semester = (student?.class as { semester?: number } | undefined)?.semester;
    return semester === 2 ? 1 : 0;
  }, [valueColumn, student]);

  // Gewichteter Durchschnitt pro Fach/Modul (gleiche Logik wie im Backend)
  const subjectRows = useMemo(() => {
    const bySubject = new Map<
      string,
      { name: string; categories: Map<string, { weight: number; values: number[] }> }
    >();
    for (const g of grades ?? []) {
      const subjName = g.subject?.name ?? 'Unbekanntes Fach';
      let subj = bySubject.get(g.subjectId);
      if (!subj) {
        subj = { name: subjName, categories: new Map() };
        bySubject.set(g.subjectId, subj);
      }
      const weight = g.category?.weight ?? 0;
      let cat = subj.categories.get(g.categoryId);
      if (!cat) {
        cat = { weight, values: [] };
        subj.categories.set(g.categoryId, cat);
      }
      cat.values.push(g.value);
    }

    return [...bySubject.values()]
      .map((subj) => {
        let weightedSum = 0;
        let totalWeight = 0;
        for (const cat of subj.categories.values()) {
          const avg = cat.values.reduce((a, b) => a + b, 0) / cat.values.length;
          weightedSum += avg * cat.weight;
          totalWeight += cat.weight;
        }
        const average = totalWeight > 0 ? roundToHalf(weightedSum / totalWeight) : null;
        return { name: subj.name, average };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [grades]);

  // Erfahrungsnote: Mittel aller Fachnoten
  const erfahrungsnote = useMemo(() => {
    const valid = subjectRows.map((r) => r.average).filter((v): v is number => v !== null);
    if (!valid.length) return null;
    return roundToHalf(valid.reduce((a, b) => a + b, 0) / valid.length);
  }, [subjectRows]);

  // Anwesenheit aus den Absenz-Einträgen
  const attendance = useMemo(() => {
    const all = absences ?? [];
    if (!all.length) return null;
    const entschuldigt = all.filter((a) => a.status === 'ENTSCHULDIGT').length;
    const unentschuldigt = all.filter((a) => a.status === 'UNENTSCHULDIGT').length;
    const anwesend = all.length - entschuldigt - unentschuldigt;
    return {
      prozent: Math.round((anwesend / all.length) * 100),
      entschuldigt,
      unentschuldigt,
    };
  }, [absences]);

  const promotionStatus = useMemo(() => {
    if (!promotion || promotion.status !== 'OK') return null;
    const entry = promotion.results?.find((r) => r.student.id === studentId);
    if (!entry) return null;
    switch (entry.status) {
      case 'BESTANDEN':
        return 'bestanden';
      case 'NICHT_BESTANDEN':
        return 'nicht bestanden';
      case 'UNVOLLSTAENDIG':
        return 'unvollständig';
      default:
        return '—';
    }
  }, [promotion, studentId]);

  const geburtsdatum = student?.dateOfBirth
    ? format(new Date(student.dateOfBirth), 'd. MMMM yyyy', { locale: de })
    : '—';

  // Zelleninhalt: Wert nur in der aktiven Spalte
  const cell = (col: number, value: string | null): string => (col === activeColumn && value ? value : '');

  return (
    <div className="space-y-6">
      {/* Zeugnis wird hochkant gedruckt */}
      <style>{'@page { size: A4 portrait; margin: 12mm; }'}</style>

      <div className="print:hidden space-y-6">
        <Link to="/students" className="btn-secondary w-fit">
          <ArrowLeft className="h-4 w-4" /> Zurück zur Schülerliste
        </Link>

        <PageHeader
          eyebrow="Berichte"
          title="Semesterzeugnis-Vorlage"
          description="Wähle die Schülerin oder den Schüler, passe Bezeichnungen an und drucke das Zeugnis (oder speichere es als PDF)."
          actions={
            <button type="button" className="btn-primary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Drucken / PDF
            </button>
          }
        />

        <div className="surface-card grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Schüler/in</label>
            <select className="input-modern" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">— wählen —</option>
              {(students ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.lastName}, {s.firstName} {s.class?.name ? `(${s.class.name})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Titel</label>
            <input className="input-modern" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Noten in Spalte</label>
            <select
              className="input-modern"
              value={activeColumn}
              onChange={(e) => setValueColumn(Number(e.target.value))}
            >
              {semesterLabels.map((label, i) => (
                <option key={i} value={i}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 xl:col-span-3">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Spaltenüberschriften</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {semesterLabels.map((label, i) => (
                <input
                  key={i}
                  className="input-modern"
                  value={label}
                  onChange={(e) =>
                    setSemesterLabels((prev) => prev.map((l, idx) => (idx === i ? e.target.value : l)))
                  }
                />
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Datum</label>
            <input className="input-modern" value={dateLine} onChange={(e) => setDateLine(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Unterzeichnet von</label>
            <input className="input-modern" value={signerName} onChange={(e) => setSignerName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Funktion</label>
            <input className="input-modern" value={signerRole} onChange={(e) => setSignerRole(e.target.value)} />
          </div>
        </div>

        {!studentId && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Bitte zuerst eine Schülerin oder einen Schüler auswählen – Name, Geburtsdatum, Noten und
            Anwesenheit werden automatisch eingesetzt.
          </div>
        )}
      </div>

      {/* ==================== DRUCKBLATT ==================== */}
      <div className="overflow-x-auto">
        <div className="print-sheet mx-auto min-w-[720px] max-w-[800px] rounded-xl border border-slate-200 bg-white p-10 text-black shadow-soft print:min-w-0 print:rounded-none print:border-0 print:p-0 print:shadow-none">
          {/* Briefkopf */}
          <div className="mb-8 flex items-start justify-between">
            <div className="flex items-start gap-6">
              <p className="text-3xl font-extrabold italic text-brand-red">
                Benedict<span className="align-super text-sm">°</span>
              </p>
              <div className="text-[10px] leading-relaxed text-slate-800">
                <p>Vulkanstrasse 106</p>
                <p>8048 Zürich</p>
              </div>
              <div className="text-[10px] leading-relaxed text-slate-800">
                <p>044 242 12 60</p>
              </div>
              <div className="text-[10px] leading-relaxed text-slate-800">
                <p>www.benedict.ch</p>
                <p>info.zh@benedict.ch</p>
              </div>
            </div>
            <div className="text-right text-[11px] font-semibold leading-relaxed">
              <p>Sprachen</p>
              <p>Handel</p>
              <p>Informatik</p>
              <p>Medizin</p>
            </div>
          </div>

          {/* Titel */}
          <h1 className="text-xl font-bold">
            {title} für {student ? `${student.firstName} ${student.lastName}` : '…'}
          </h1>
          <p className="mt-1 text-xs">geboren am {geburtsdatum}</p>

          {/* Notentabelle */}
          <table className="mt-6 w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-black text-left text-white">
                <th className="w-[44%] p-1.5 font-semibold">Noten</th>
                {semesterLabels.map((label, i) => (
                  <th key={i} className="p-1.5 text-center font-semibold">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subjectRows.length === 0 && (
                <tr className="border-b border-slate-300">
                  <td className="p-1.5 text-slate-500" colSpan={5}>
                    Noch keine Noten erfasst.
                  </td>
                </tr>
              )}
              {subjectRows.map((row) => {
                const { short, rest } = splitName(row.name);
                return (
                  <tr key={row.name} className="border-b border-slate-300">
                    <td className="p-1.5">
                      <p className="font-bold">{short}</p>
                      {rest && <p className="text-[10px]">{rest}</p>}
                    </td>
                    {semesterLabels.map((_, col) => (
                      <td key={col} className="p-1.5 text-center">
                        {cell(col, row.average !== null ? fmtGrade(row.average) : null)}
                      </td>
                    ))}
                  </tr>
                );
              })}

              {/* Erfahrungsnote */}
              <tr className="border-b border-slate-400 bg-slate-200 font-bold">
                <td className="p-1.5">Erfahrungsnote</td>
                {semesterLabels.map((_, col) => (
                  <td key={col} className="p-1.5 text-center">
                    {cell(col, erfahrungsnote !== null ? fmtGrade(erfahrungsnote) : null)}
                  </td>
                ))}
              </tr>

              {/* Anwesenheit */}
              <tr className="border-b border-slate-300">
                <td className="p-1.5 font-bold">Anwesenheit</td>
                {semesterLabels.map((_, col) => (
                  <td key={col} className="p-1.5 text-center">
                    {cell(col, attendance ? `${attendance.prozent}%` : null)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-300">
                <td className="p-1.5 pl-5 text-[10px]">Lektionen entschuldigt</td>
                {semesterLabels.map((_, col) => (
                  <td key={col} className="p-1.5 text-center">
                    {cell(col, attendance ? String(attendance.entschuldigt) : null)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-300">
                <td className="p-1.5 pl-5 text-[10px]">Lektionen unentschuldigt</td>
                {semesterLabels.map((_, col) => (
                  <td key={col} className="p-1.5 text-center">
                    {cell(col, attendance ? String(attendance.unentschuldigt) : null)}
                  </td>
                ))}
              </tr>

              {/* Promotion */}
              <tr className="border-b border-slate-400 bg-slate-200">
                <td className="p-1.5 font-bold">Promotion</td>
                {semesterLabels.map((_, col) => (
                  <td key={col} className="p-1.5 text-center font-semibold">
                    {cell(col, promotionStatus)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>

          {/* Notenerläuterung */}
          <div className="mt-5 text-[10px] leading-relaxed">
            <p className="font-bold">Notenerläuterung</p>
            <p>6 = sehr gut, 5 = gut, 4 = genügend, Noten unter 4 = ungenügend</p>
            <p>u. = unvollständig, disp. = dispensiert, n.b. = nicht besucht</p>
          </div>

          {/* Datum + Unterschrift */}
          <div className="mt-8 text-xs leading-relaxed">
            <p>Zürich, {dateLine}</p>
            <p className="mt-4 font-semibold">Benedict-Schule Zürich</p>
            <p>{signerRole}</p>
            <div className="mt-10 w-56 border-t border-slate-500 pt-1">
              <p>{signerName}</p>
            </div>
          </div>

          {/* Rechtsmittelbelehrung */}
          <div className="mt-8 text-[9px] leading-relaxed text-slate-800">
            <p className="font-bold">Rechtsmittelbelehrung</p>
            <p>
              Gegen die Noten dieses Zeugnisses kann innert 30 Tagen, vom Empfang der Mitteilung an
              gerechnet, bei der Schulleitung schriftlich Einsprache erhoben werden. Die Einsprache
              muss einen Antrag und dessen Begründung enthalten. Die Beweismittel sind genau zu
              bezeichnen und soweit möglich beizulegen (§46 des Einführungsgesetzes zum Bundesgesetz
              über die Berufsbildung).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
