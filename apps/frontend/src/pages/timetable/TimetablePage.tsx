// Stundenplan-Seite (Leiter): Wochenraster pro Klasse + Ausnahmen

import { useMemo, useState, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import type { Class, Subject, User } from '@schuladmin/shared';
import {
  TIMETABLE_PERIODS,
  WEEKDAY_LABELS,
} from '@schuladmin/shared';
import { CalendarDays, Plus, X, CalendarRange } from 'lucide-react';

type Slot = {
  id: string;
  classId: string;
  dayOfWeek: number;
  period: number;
  subjectId: string;
  teacherId: string;
  room: string | null;
  isTest: boolean;
  subject?: { id: string; name: string };
  teacher?: { id: string; firstName: string; lastName: string };
};

type Exception = {
  id: string;
  classId: string;
  date: string;
  period: number;
  type: 'CANCEL' | 'OVERRIDE';
  subjectId: string | null;
  teacherId: string | null;
  room: string | null;
  isTest: boolean | null;
  subject?: { id: string; name: string } | null;
  teacher?: { id: string; firstName: string; lastName: string } | null;
};

type CellTarget = { dayOfWeek: number; period: number };

const SUBJECT_COLORS = [
  'bg-sky-100 border-sky-300 text-sky-900',
  'bg-emerald-100 border-emerald-300 text-emerald-900',
  'bg-amber-100 border-amber-300 text-amber-900',
  'bg-violet-100 border-violet-300 text-violet-900',
  'bg-rose-100 border-rose-300 text-rose-900',
  'bg-cyan-100 border-cyan-300 text-cyan-900',
  'bg-lime-100 border-lime-300 text-lime-900',
  'bg-orange-100 border-orange-300 text-orange-900',
];

function subjectColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i) * (i + 1)) % SUBJECT_COLORS.length;
  return SUBJECT_COLORS[hash]!;
}

export default function TimetablePage() {
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState('');
  const [showExceptionPanel, setShowExceptionPanel] = useState(false);
  const [exceptionDate, setExceptionDate] = useState('');
  const [editing, setEditing] = useState<(CellTarget & { slot?: Slot; exception?: Exception }) | null>(null);

  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [room, setRoom] = useState('');
  const [isTest, setIsTest] = useState(false);
  const [doubleLesson, setDoubleLesson] = useState(false);
  const [exceptionCancel, setExceptionCancel] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Class[] }>('/api/v1/classes');
      return data.data;
    },
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects', classId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Subject[] }>(`/api/v1/classes/${classId}/subjects`);
      return data.data;
    },
    enabled: !!classId,
  });

  const { data: teachers } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: User[] }>('/api/v1/users?role=LEHRPERSON&limit=100');
      return data.data;
    },
  });

  const { data: timetable, isLoading } = useQuery({
    queryKey: ['timetable', classId],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        data: { slots: Slot[]; periods: typeof TIMETABLE_PERIODS };
      }>(`/api/v1/timetable?classId=${classId}`);
      return data.data;
    },
    enabled: !!classId,
  });

  const { data: exceptions } = useQuery({
    queryKey: ['timetable-exceptions', classId, exceptionDate],
    queryFn: async () => {
      const params = new URLSearchParams({ classId });
      if (exceptionDate) {
        params.set('dateFrom', exceptionDate);
        params.set('dateTo', exceptionDate);
      }
      const { data } = await apiClient.get<{ data: Exception[] }>(
        `/api/v1/timetable/exceptions?${params}`
      );
      return data.data;
    },
    enabled: !!classId && !!exceptionDate,
  });

  const slotsByKey = useMemo(() => {
    const map = new Map<string, Slot>();
    for (const s of timetable?.slots ?? []) {
      map.set(`${s.dayOfWeek}-${s.period}`, s);
    }
    return map;
  }, [timetable]);

  const exceptionByPeriod = useMemo(() => {
    const map = new Map<number, Exception>();
    for (const e of exceptions ?? []) {
      map.set(e.period, e);
    }
    return map;
  }, [exceptions]);

  const exceptionDayOfWeek = useMemo(() => {
    if (!exceptionDate) return null;
    const d = new Date(exceptionDate + 'T12:00:00');
    const js = d.getDay();
    if (js === 0 || js === 6) return null;
    return js;
  }, [exceptionDate]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editing || !classId) return;

      if (exceptionDate && exceptionDayOfWeek === editing.dayOfWeek) {
        if (exceptionCancel) {
          await apiClient.put('/api/v1/timetable/exceptions', {
            classId,
            date: exceptionDate,
            period: editing.period,
            type: 'CANCEL',
          });
        } else {
          await apiClient.put('/api/v1/timetable/exceptions', {
            classId,
            date: exceptionDate,
            period: editing.period,
            type: 'OVERRIDE',
            subjectId,
            teacherId,
            room: room || null,
            isTest,
          });
        }
        return;
      }

      await apiClient.put('/api/v1/timetable/slots', {
        classId,
        dayOfWeek: editing.dayOfWeek,
        period: editing.period,
        subjectId,
        teacherId,
        room: room || null,
        isTest,
        doubleLesson,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['timetable', classId] });
      void queryClient.invalidateQueries({ queryKey: ['timetable-exceptions'] });
      void queryClient.invalidateQueries({ queryKey: ['lessons'] });
      closeEditor();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      if (exceptionDate && editing.exception) {
        await apiClient.delete(`/api/v1/timetable/exceptions/${editing.exception.id}`);
        return;
      }
      if (editing.slot) {
        await apiClient.delete(`/api/v1/timetable/slots/${editing.slot.id}`);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['timetable', classId] });
      void queryClient.invalidateQueries({ queryKey: ['timetable-exceptions'] });
      void queryClient.invalidateQueries({ queryKey: ['lessons'] });
      closeEditor();
    },
  });

  const openCell = (dayOfWeek: number, period: number): void => {
    if (exceptionDate && exceptionDayOfWeek !== null && exceptionDayOfWeek !== dayOfWeek) {
      return; // andere Tage in Ausnahme-Modus nicht bearbeitbar
    }
    const slot = slotsByKey.get(`${dayOfWeek}-${period}`);
    const ex = exceptionDate && exceptionDayOfWeek === dayOfWeek
      ? exceptionByPeriod.get(period)
      : undefined;

    setEditing({ dayOfWeek, period, slot, exception: ex });
    if (ex?.type === 'CANCEL') {
      setExceptionCancel(true);
      setSubjectId(slot?.subjectId ?? '');
      setTeacherId(slot?.teacherId ?? '');
      setRoom(slot?.room ?? '');
      setIsTest(slot?.isTest ?? false);
    } else if (ex?.type === 'OVERRIDE') {
      setExceptionCancel(false);
      setSubjectId(ex.subjectId ?? '');
      setTeacherId(ex.teacherId ?? '');
      setRoom(ex.room ?? '');
      setIsTest(ex.isTest ?? false);
    } else if (slot) {
      setExceptionCancel(false);
      setSubjectId(slot.subjectId);
      setTeacherId(slot.teacherId);
      setRoom(slot.room ?? '');
      setIsTest(slot.isTest);
    } else {
      setExceptionCancel(false);
      setSubjectId('');
      setTeacherId('');
      setRoom('');
      setIsTest(false);
    }
    setDoubleLesson(false);
  };

  const closeEditor = (): void => {
    setEditing(null);
    setDoubleLesson(false);
    setExceptionCancel(false);
  };

  const onSubjectChange = (id: string): void => {
    setSubjectId(id);
    const sub = subjects?.find((s) => s.id === id);
    if (sub?.teacherId) setTeacherId(sub.teacherId);
  };

  const isExceptionMode = Boolean(exceptionDate && exceptionDayOfWeek);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <CalendarDays className="w-6 h-6 text-brand-red" />
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Stundenplan</h1>
          <p className="text-sm text-neutral-500">
            Wochenvorlage pro Klasse – gilt für das ganze Semester
          </p>
        </div>
      </div>

      {/* Primäre Kontrolle: Klasse */}
      <div className="mb-6 max-w-md">
        <label className="block text-sm font-semibold text-neutral-800 mb-2">Klasse auswählen</label>
        <select
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setExceptionDate('');
            setShowExceptionPanel(false);
            closeEditor();
          }}
          className="w-full px-4 py-3 border-2 border-neutral-300 rounded-xl text-base font-medium bg-white shadow-sm focus:outline-none focus:border-neutral-500 focus:ring-0"
        >
          <option value="">— Klasse wählen —</option>
          {classes?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Ausnahme: sekundär, erst auf Wunsch */}
      {classId && (
        <div className="mb-6">
          {!showExceptionPanel ? (
            <button
              type="button"
              onClick={() => setShowExceptionPanel(true)}
              className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              <CalendarRange className="w-4 h-4" />
              Ausnahme für ein einzelnes Datum erfassen…
            </button>
          ) : (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50/80 px-4 py-3 max-w-md">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-neutral-600 uppercase tracking-wide">
                  Ausnahme (optional)
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowExceptionPanel(false);
                    setExceptionDate('');
                  }}
                  className="text-xs text-neutral-400 hover:text-neutral-600"
                >
                  Schliessen
                </button>
              </div>
              <p className="text-xs text-neutral-500 mb-2">
                Nur nötig bei Stellvertretung, Verschiebung oder Ausfall – die Wochenvorlage bleibt unverändert.
              </p>
              <input
                type="date"
                value={exceptionDate}
                onChange={(e) => setExceptionDate(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white text-neutral-700 focus:outline-none focus:border-neutral-400"
              />
            </div>
          )}
        </div>
      )}

      {!classId && (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 p-12 text-center text-neutral-500">
          Bitte zuerst eine Klasse auswählen, um den Stundenplan anzuzeigen oder zu bearbeiten.
        </div>
      )}

      {classId && isLoading && (
        <div className="p-8 text-center text-neutral-400">Laden...</div>
      )}

      {classId && !isLoading && (
        <>
          {isExceptionMode && (
            <div className="mb-4 text-sm bg-amber-50/80 border border-amber-200/80 text-amber-900 rounded-lg px-3 py-2">
              Ausnahme-Modus für {exceptionDate} ({WEEKDAY_LABELS[exceptionDayOfWeek!]}) –
              Änderungen betreffen nur dieses Datum.
            </div>
          )}
          {exceptionDate && exceptionDayOfWeek === null && (
            <div className="mb-4 text-sm bg-neutral-100 border border-neutral-200 text-neutral-600 rounded-lg px-3 py-2">
              Ausnahmen sind nur für Werktage (Mo–Fr) möglich.
            </div>
          )}

          <div className="rounded-xl border border-neutral-200 bg-white overflow-x-auto shadow-sm">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 p-3 text-left text-[11px] font-medium text-neutral-400 uppercase tracking-wider w-[7.5rem] bg-neutral-100 border-b border-r border-neutral-200">
                    Periode
                  </th>
                  {[1, 2, 3, 4, 5].map((d) => (
                    <th
                      key={d}
                      className={`p-3 text-center text-xs font-medium border-b border-neutral-200 ${
                        isExceptionMode && exceptionDayOfWeek === d
                          ? 'bg-amber-50/60 text-amber-800'
                          : isExceptionMode
                            ? 'bg-white text-neutral-300'
                            : 'bg-white text-neutral-500'
                      }`}
                    >
                      {WEEKDAY_LABELS[d]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIMETABLE_PERIODS.map((period) => (
                  <Fragment key={period.period}>
                    {(period.period === 3 || period.period === 5 || period.period === 7) && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-400 bg-neutral-100 border-y border-neutral-200"
                        >
                          {period.period === 5 ? '— Mittagspause —' : '— Pause —'}
                        </td>
                      </tr>
                    )}
                    <tr className="group/row">
                      <td className="sticky left-0 z-10 p-3 align-middle bg-neutral-50 border-r border-b border-neutral-200">
                        <div className="text-xs font-semibold text-neutral-700">{period.label}</div>
                        <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                          {period.startTime}–{period.endTime}
                        </div>
                      </td>
                      {[1, 2, 3, 4, 5].map((day) => {
                        const slot = slotsByKey.get(`${day}-${period.period}`);
                        const ex =
                          isExceptionMode && exceptionDayOfWeek === day
                            ? exceptionByPeriod.get(period.period)
                            : undefined;
                        const dimmed = isExceptionMode && exceptionDayOfWeek !== day;
                        const clickable = !dimmed;
                        const hasContent = Boolean(slot || ex);

                        let displayName = slot?.subject?.name;
                        let displayTeacher = slot?.teacher
                          ? `${slot.teacher.firstName} ${slot.teacher.lastName}`
                          : '';
                        let displayRoom = slot?.room;
                        let cancelled = false;
                        let color = slot ? subjectColor(slot.subject?.name ?? '') : '';

                        if (ex?.type === 'CANCEL') {
                          cancelled = true;
                          displayName = 'Ausfall';
                          displayTeacher = '';
                          displayRoom = null;
                          color = 'bg-neutral-100 border-neutral-200 text-neutral-400';
                        } else if (ex?.type === 'OVERRIDE') {
                          displayName = ex.subject?.name ?? displayName;
                          displayTeacher = ex.teacher
                            ? `${ex.teacher.firstName} ${ex.teacher.lastName}`
                            : displayTeacher;
                          displayRoom = ex.room;
                          color = subjectColor(displayName ?? 'x');
                        }

                        return (
                          <td key={`${day}-${period.period}`} className="p-1.5 align-top border-b border-neutral-100">
                            <button
                              type="button"
                              disabled={!clickable}
                              onClick={() => openCell(day, period.period)}
                              className={`w-full min-h-[68px] rounded-md border text-left p-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-1 ${
                                dimmed
                                  ? 'opacity-25 cursor-not-allowed border-neutral-100 bg-neutral-50/50'
                                  : hasContent
                                    ? `${color} border hover:brightness-[0.98]`
                                    : 'border-neutral-200 bg-neutral-50/40 hover:bg-neutral-100/80 hover:border-neutral-300'
                              }`}
                            >
                              {hasContent ? (
                                <div className="space-y-0.5">
                                  <div className={`font-semibold text-xs leading-tight ${cancelled ? 'line-through' : ''}`}>
                                    {displayName}
                                    {(slot?.isTest || ex?.isTest) && !cancelled && (
                                      <span className="ml-1 text-[9px] font-bold uppercase opacity-70">Test</span>
                                    )}
                                  </div>
                                  {displayTeacher && (
                                    <div className="text-[10px] opacity-75 truncate">{displayTeacher}</div>
                                  )}
                                  {displayRoom && (
                                    <div className="text-[10px] opacity-60">Raum {displayRoom}</div>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center justify-center h-full min-h-[52px] text-neutral-300">
                                  <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                                </div>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">
                {WEEKDAY_LABELS[editing.dayOfWeek]} · {TIMETABLE_PERIODS.find((p) => p.period === editing.period)?.label}
              </h2>
              <button type="button" onClick={closeEditor} className="text-neutral-400 hover:text-neutral-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-neutral-500">
              {isExceptionMode
                ? `Ausnahme für ${exceptionDate} – Vorlage bleibt unverändert.`
                : 'Eintrag in der Wochenvorlage (gilt jedes Semester).'}
            </p>

            {isExceptionMode && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={exceptionCancel}
                  onChange={(e) => setExceptionCancel(e.target.checked)}
                />
                Ausfall an diesem Datum
              </label>
            )}

            {!exceptionCancel && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Fach *</label>
                  <select
                    required
                    value={subjectId}
                    onChange={(e) => onSubjectChange(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">Fach wählen</option>
                    {subjects?.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Lehrperson *</label>
                  <select
                    required
                    value={teacherId}
                    onChange={(e) => setTeacherId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">Lehrperson wählen</option>
                    {teachers?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.lastName}, {t.firstName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Raum</label>
                  <input
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="optional"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={isTest} onChange={(e) => setIsTest(e.target.checked)} />
                  Prüfung / Test
                </label>
                {!isExceptionMode && [1, 3, 5, 7].includes(editing.period) && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={doubleLesson}
                      onChange={(e) => setDoubleLesson(e.target.checked)}
                    />
                    Doppellektion (nächste Periode mitbelegen)
                  </label>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || (!exceptionCancel && (!subjectId || !teacherId))}
                className="bg-brand-red text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                Speichern
              </button>
              {(editing.slot || editing.exception) && (
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm hover:bg-red-50"
                >
                  {isExceptionMode ? 'Ausnahme entfernen' : 'Löschen'}
                </button>
              )}
              <button type="button" onClick={closeEditor} className="text-neutral-600 px-3 py-2 text-sm">
                Abbrechen
              </button>
            </div>
            {(saveMutation.isError || deleteMutation.isError) && (
              <p className="text-sm text-red-600">Aktion fehlgeschlagen. Angaben prüfen.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
