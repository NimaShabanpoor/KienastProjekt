// Stundenplan-Druckvorlage nach Benedict-Muster
// Kopf: "Stundenplan" + Name (wählbar) links, freie Bezeichnung rechts.
// Raster: Mo–Fr mit Fach/Zuordnung + Raum pro Zeitfenster. Unten: Legende.

import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Lesson } from '@schuladmin/shared/types/entities';
import { lessonsApi, studentsApi, usersApi } from '../../api/endpoints';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuthStore } from '../../store/authStore';
import PageHeader from '../../components/ui/PageHeader';

// Standard-Zeitfenster gemäss Vorlage
const SLOTS: Array<{ start: string; end: string }> = [
  { start: '08:15', end: '09:00' },
  { start: '09:10', end: '09:55' },
  { start: '10:15', end: '11:00' },
  { start: '11:10', end: '11:55' },
  { start: '12:05', end: '12:50' },
  { start: '13:00', end: '13:45' },
  { start: '13:55', end: '14:40' },
  { start: '14:55', end: '15:40' },
  { start: '15:50', end: '16:35' },
  { start: '16:45', end: '17:30' },
];

const DAY_LABELS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];

// Anzeige ohne führende Null (Vorlage: "8:15")
const t = (time: string): string => time.replace(/^0/, '');

// Kurzbezeichnung: "Modul 120 – ICT..." -> "Modul 120"; "KD" bleibt "KD"
const shortName = (name: string): string => name.split(/\s+[–-]\s+/)[0] ?? name;

const overlaps = (l: Lesson, slot: { start: string; end: string }): boolean =>
  l.startTime < slot.end && l.endTime > slot.start;

export default function TimetablePrintPage() {
  const { isAdmin } = usePermissions();
  const { user } = useAuthStore();

  const [planType, setPlanType] = useState<'teacher' | 'student'>('teacher');
  const [personId, setPersonId] = useState(() => (!isAdmin && user ? user.id : ''));
  const [titleLine1, setTitleLine1] = useState('Frühlingssemester');
  const [titleLine2, setTitleLine2] = useState('');
  const [weekDate, setWeekDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Woche (Mo–Fr) aus dem gewählten Datum
  const weekStart = useMemo(
    () => startOfWeek(parseISO(weekDate), { weekStartsOn: 1 }),
    [weekDate]
  );
  const days = useMemo(
    () => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const dateFrom = format(weekStart, 'yyyy-MM-dd');
  const dateTo = format(addDays(weekStart, 4), 'yyyy-MM-dd');

  // Personenlisten
  const { data: teachers } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
    enabled: isAdmin && planType === 'teacher',
  });
  const { data: students } = useQuery({
    queryKey: ['students-all'],
    queryFn: () => studentsApi.list(),
    enabled: planType === 'student',
  });

  const selectedStudent = useMemo(
    () => students?.find((s) => s.id === personId),
    [students, personId]
  );

  // Lektionen der Woche laden (ohne abgesagte)
  const { data: weekLessons, isLoading } = useQuery({
    queryKey: ['print-lessons', planType, personId, selectedStudent?.classId, dateFrom, dateTo],
    queryFn: () =>
      lessonsApi.list({
        dateFrom,
        dateTo,
        isCancelled: false,
        ...(planType === 'student' && selectedStudent ? { classId: selectedStudent.classId } : {}),
      }),
    enabled: planType === 'teacher' ? !!personId : !!selectedStudent,
  });

  // Lehrpersonen-Plan: clientseitig auf die gewählte Lehrperson filtern
  const lessons = useMemo(() => {
    const all = weekLessons ?? [];
    if (planType === 'teacher') return all.filter((l) => l.subject?.teacher?.id === personId);
    return all;
  }, [weekLessons, planType, personId]);

  // Zusätzliche Zeitfenster für Lektionen ausserhalb der Standard-Slots
  const rows = useMemo(() => {
    const extra = new Map<string, { start: string; end: string }>();
    for (const l of lessons) {
      if (!SLOTS.some((s) => overlaps(l, s))) {
        extra.set(`${l.startTime}-${l.endTime}`, { start: l.startTime, end: l.endTime });
      }
    }
    return [...SLOTS, ...[...extra.values()].sort((a, b) => a.start.localeCompare(b.start))];
  }, [lessons]);

  const lessonsAt = (dayIndex: number, slot: { start: string; end: string }): Lesson[] => {
    const dayKey = format(days[dayIndex]!, 'yyyy-MM-dd');
    return lessons
      .filter((l) => l.date.slice(0, 10) === dayKey && overlaps(l, slot))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  const personName =
    planType === 'teacher'
      ? isAdmin
        ? (() => {
            const u = teachers?.find((x) => x.id === personId);
            return u ? `${u.firstName} ${u.lastName}` : '';
          })()
        : user
          ? `${user.firstName} ${user.lastName}`
          : ''
      : selectedStudent
        ? `${selectedStudent.firstName} ${selectedStudent.lastName}`
        : '';

  const secondColLabel = planType === 'teacher' ? 'Klasse' : 'Lehrperson';

  return (
    <div className="space-y-6">
      {/* Stundenplan wird quer gedruckt */}
      <style>{'@page { size: A4 landscape; margin: 10mm; }'}</style>
      <div className="print:hidden space-y-6">
        <Link to="/timetable" className="btn-secondary w-fit">
          <ArrowLeft className="h-4 w-4" /> Zurück zum Stundenplan
        </Link>

        <PageHeader
          eyebrow="Planung"
          title="Stundenplan-Druckvorlage"
          description="Wähle, zu wem der Plan gehört, lege die Bezeichnung oben rechts fest und drucke die Vorlage (oder speichere sie als PDF)."
          actions={
            <button type="button" className="btn-primary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Drucken / PDF
            </button>
          }
        />

        <div className="surface-card grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Plan für</label>
            <select
              className="input-modern"
              value={planType}
              onChange={(e) => {
                setPlanType(e.target.value as 'teacher' | 'student');
                setPersonId(!isAdmin && user && e.target.value === 'teacher' ? user.id : '');
              }}
            >
              <option value="teacher">Lehrperson</option>
              <option value="student">Schüler/in</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Name</label>
            {planType === 'teacher' && !isAdmin ? (
              <input className="input-modern" value={personName} disabled />
            ) : (
              <select
                className="input-modern"
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
              >
                <option value="">— wählen —</option>
                {planType === 'teacher'
                  ? (teachers ?? [])
                      .filter((u) => u.isActive)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.firstName} {u.lastName}
                        </option>
                      ))
                  : (students ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.lastName}, {s.firstName} {s.class?.name ? `(${s.class.name})` : ''}
                      </option>
                    ))}
              </select>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Woche</label>
            <input
              type="date"
              className="input-modern"
              value={weekDate}
              onChange={(e) => e.target.value && setWeekDate(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-400">
              {format(weekStart, 'd. MMM', { locale: de })} –{' '}
              {format(addDays(weekStart, 4), 'd. MMM yyyy', { locale: de })}
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Bezeichnung (oben rechts)
            </label>
            <input
              className="input-modern"
              value={titleLine1}
              onChange={(e) => setTitleLine1(e.target.value)}
              placeholder="z. B. Frühlingssemester"
            />
            <input
              className="input-modern mt-2"
              value={titleLine2}
              onChange={(e) => setTitleLine2(e.target.value)}
              placeholder="z. B. 23. Februar bis 10. Juli 2026"
            />
          </div>
        </div>

        {isLoading && (
          <div className="surface-card p-6 text-center text-sm text-slate-500">
            Lektionen werden geladen...
          </div>
        )}
        {!personId && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Bitte zuerst auswählen, zu wem der Plan gehört – die Vorlage füllt sich dann automatisch
            mit den Lektionen der gewählten Woche.
          </div>
        )}
      </div>

      {/* ==================== DRUCKBLATT ==================== */}
      <div className="overflow-x-auto">
        <div className="print-sheet mx-auto min-w-[960px] max-w-[1100px] rounded-xl border border-slate-200 bg-white p-8 text-black shadow-soft print:min-w-0 print:rounded-none print:border-0 print:p-0 print:shadow-none">
          {/* Kopfzeile */}
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="text-lg font-bold leading-tight">Stundenplan</p>
              <p className="text-lg leading-tight">{personName || '–'}</p>
            </div>
            <div className="text-right">
              {titleLine1 && <p className="text-lg font-bold leading-tight">{titleLine1}</p>}
              {titleLine2 && <p className="text-lg font-bold leading-tight">{titleLine2}</p>}
            </div>
          </div>

          {/* Raster */}
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                <th className="w-24 border-2 border-black p-1" />
                {DAY_LABELS.map((day) => (
                  <th key={day} colSpan={2} className="border-2 border-black p-1 text-sm font-bold">
                    {day}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="border-2 border-black p-1" />
                {DAY_LABELS.map((day) => (
                  <Fragment key={day}>
                    <th className="border border-black border-l-2 p-1 font-semibold">Fach</th>
                    <th className="border border-black p-1 font-semibold">{secondColLabel}</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((slot) => {
                const isLunchRow = slot.start === '12:05';
                return (
                  <tr key={`${slot.start}-${slot.end}`}>
                    <td className="border-2 border-black p-1 text-center font-medium whitespace-nowrap">
                      {t(slot.start)}&nbsp;&nbsp;-&nbsp;&nbsp;{t(slot.end)}
                    </td>
                    {DAY_LABELS.map((day, dayIndex) => {
                      const cellLessons = lessonsAt(dayIndex, slot);
                      const empty = cellLessons.length === 0;
                      const bg = empty && isLunchRow ? 'bg-slate-300' : '';
                      return (
                        <Fragment key={day}>
                          <td className={`h-10 border border-black border-l-2 p-1 text-center align-middle ${bg}`}>
                            {cellLessons.map((l) => (
                              <p key={l.id} className="font-bold">
                                {shortName(l.subject?.name ?? '')}
                              </p>
                            ))}
                          </td>
                          <td className={`border border-black p-1 text-center align-middle ${bg}`}>
                            {cellLessons.map((l) => (
                              <div key={l.id}>
                                <p>
                                  {planType === 'teacher'
                                    ? l.subject?.class?.name ?? ''
                                    : l.subject?.teacher
                                      ? `${l.subject.teacher.firstName} ${l.subject.teacher.lastName}`
                                      : ''}
                                </p>
                                {l.room && <p className="text-[9px]">{l.room}</p>}
                              </div>
                            ))}
                          </td>
                        </Fragment>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Legende */}
          <div className="mt-8 grid grid-cols-3 gap-6 text-[10px] leading-relaxed">
            <div>
              <p className="mb-1 font-bold">Legende Lernbereiche</p>
              <p>BF: Business Finance</p>
              <p>BT: Business Technology</p>
              <p>KD: Kommunikation Deutsch</p>
              <p>KE: Kommunikation Englisch</p>
              <p>KF: Kommunikation Französisch</p>
              <p>SOL: Selbstorganisiertes Lernen</p>
              <p>TE: Trainingseinheiten</p>
              <p>WPB: Wahlpflichtbereich</p>
            </div>
            <div>
              <p className="mb-1 font-bold">Handlungskompetenzbereiche (HKB)</p>
              <p>HKB A: Handeln in agilen Arbeits- und Organisationsformen</p>
              <p>HKB B: Interagieren in einem vernetzten Arbeitsumfeld</p>
              <p>HKB C: Koordinieren von unternehmerischen Arbeitsprozessen</p>
              <p>HKB D: Gestalten von Kunden- oder Lieferantenbeziehungen</p>
              <p>HKB E: Einsetzen von Technologien der digitalen Arbeitswelt</p>
              <p className="mt-2 inline-block bg-slate-200 px-1 italic">
                Die Vernetzung der Lernbereiche mit den HKB wird in der Semesterplanung sichtbar.
              </p>
            </div>
            <div>
              <p className="mb-1 font-bold">Benedict-Schule Zürich</p>
              <p>Herr Jan Rzejak</p>
              <p>Bereichsleiter THS/Kaufmännische Grundbildung SOG</p>
              <p>044 298 18 75</p>
              <p>jan.rzejak@benedict.ch</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
