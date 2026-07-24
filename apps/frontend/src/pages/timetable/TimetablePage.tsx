// Stundenplan-Seite (Leiter): Wochenraster pro Klasse + konfigurierbare Zeiten + Ausnahmen

import { useMemo, useState, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { apiClient } from '../../api/client';
import type { Class, Subject, User } from '@schuladmin/shared';
import { WEEKDAY_LABELS } from '@schuladmin/shared';
import { CalendarDays, Plus, X, CalendarRange, Clock, Trash2, GripVertical } from 'lucide-react';

type Period = {
  period: number;
  startTime: string;
  endTime: string;
  label: string;
};

type StructureRow = {
  id?: string;
  sortOrder?: number;
  type: 'LESSON' | 'BREAK';
  label: string;
  startTime: string | null;
  endTime: string | null;
  period: number | null;
};

type SchoolHoliday = {
  id: string;
  date: string;
  name: string;
};

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

type DraftRow = {
  key: string;
  type: 'LESSON' | 'BREAK';
  label: string;
  startTime: string;
  endTime: string;
};

const SUBJECT_COLORS = [
  'bg-sky-50 border-sky-200/80 text-sky-950',
  'bg-emerald-50 border-emerald-200/80 text-emerald-950',
  'bg-amber-50 border-amber-200/80 text-amber-950',
  'bg-violet-50 border-violet-200/80 text-violet-950',
  'bg-rose-50 border-rose-200/80 text-rose-950',
  'bg-cyan-50 border-cyan-200/80 text-cyan-950',
  'bg-lime-50 border-lime-200/80 text-lime-950',
  'bg-orange-50 border-orange-200/80 text-orange-950',
];

const WEEKDAY_FULL: Record<number, string> = {
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag',
};

const fieldClass =
  'h-10 w-full px-3 border border-neutral-300 rounded-lg text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red';
const btnPrimary =
  'inline-flex h-10 items-center justify-center gap-2 px-4 rounded-lg bg-brand-red text-white text-sm font-medium hover:bg-brand-red-dark transition-colors disabled:opacity-50 disabled:pointer-events-none';
const btnSecondary =
  'inline-flex h-10 items-center justify-center gap-2 px-4 rounded-lg border border-neutral-300 bg-white text-neutral-700 text-sm font-medium hover:bg-neutral-50 transition-colors disabled:opacity-50';
const btnGhost =
  'inline-flex h-10 items-center justify-center gap-2 px-3 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition-colors';

function subjectColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i) * (i + 1)) % SUBJECT_COLORS.length;
  return SUBJECT_COLORS[hash]!;
}

function canDoubleLesson(structure: StructureRow[], period: number): boolean {
  const idx = structure.findIndex((r) => r.type === 'LESSON' && r.period === period);
  if (idx < 0 || idx >= structure.length - 1) return false;
  const next = structure[idx + 1];
  return Boolean(next && next.type === 'LESSON' && next.period === period + 1);
}

function structureToDraft(rows: StructureRow[]): DraftRow[] {
  return rows.map((r, i) => ({
    key: r.id ?? `row-${i}-${r.type}`,
    type: r.type,
    label: r.label,
    startTime: r.startTime ?? '',
    endTime: r.endTime ?? '',
  }));
}

function holidayDateLabel(value: string): string {
  const raw = value.slice(0, 10);
  const d = new Date(raw + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('de-CH', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function normalizeHolidayDate(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export default function TimetablePage() {
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState('');
  const [showExceptionPanel, setShowExceptionPanel] = useState(false);
  const [exceptionDate, setExceptionDate] = useState('');
  const [editing, setEditing] = useState<(CellTarget & { slot?: Slot; exception?: Exception }) | null>(null);
  const [showTimesEditor, setShowTimesEditor] = useState(false);
  const [draftRows, setDraftRows] = useState<DraftRow[]>([]);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');

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
        data: { slots: Slot[]; periods: Period[]; structure: StructureRow[] };
      }>(`/api/v1/timetable?classId=${classId}`);
      return data.data;
    },
    enabled: !!classId,
  });

  const { data: structureData } = useQuery({
    queryKey: ['timetable-structure'],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        data: { structure: StructureRow[]; periods: Period[] };
      }>('/api/v1/timetable/structure');
      return data.data;
    },
  });

  const { data: holidays } = useQuery({
    queryKey: ['timetable-holidays'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: SchoolHoliday[] }>('/api/v1/timetable/holidays');
      return data.data.map((h) => ({ ...h, date: normalizeHolidayDate(h.date) }));
    },
  });

  const structure = timetable?.structure ?? structureData?.structure ?? [];
  const periods = timetable?.periods ?? structureData?.periods ?? [];
  const holidayOnExceptionDate = useMemo(
    () => (exceptionDate ? holidays?.find((h) => h.date === exceptionDate) : undefined),
    [holidays, exceptionDate]
  );

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
            room: room.trim(),
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
        room: room.trim(),
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

  const saveErrorMessage = (() => {
    const err = saveMutation.error;
    if (!err || !axios.isAxiosError(err)) return null;
    const data = err.response?.data as { error?: string } | undefined;
    return data?.error ?? 'Speichern fehlgeschlagen. Angaben prüfen.';
  })();

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

  const saveStructureMutation = useMutation({
    mutationFn: async () => {
      await apiClient.put('/api/v1/timetable/structure', {
        rows: draftRows.map((r) => ({
          type: r.type,
          label: r.label.trim(),
          startTime: r.startTime.trim() || null,
          endTime: r.endTime.trim() || null,
        })),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['timetable-structure'] });
      void queryClient.invalidateQueries({ queryKey: ['timetable'] });
      void queryClient.invalidateQueries({ queryKey: ['lessons'] });
      setShowTimesEditor(false);
    },
  });

  const saveHolidayMutation = useMutation({
    mutationFn: async () => {
      await apiClient.put('/api/v1/timetable/holidays', {
        date: holidayDate,
        name: holidayName.trim(),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['timetable-holidays'] });
      void queryClient.invalidateQueries({ queryKey: ['lessons'] });
      setHolidayName('');
      setHolidayDate('');
    },
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/v1/timetable/holidays/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['timetable-holidays'] });
      void queryClient.invalidateQueries({ queryKey: ['lessons'] });
    },
  });

  const holidaySaveError = (() => {
    const err = saveHolidayMutation.error;
    if (!err || !axios.isAxiosError(err)) return null;
    const data = err.response?.data as { error?: string } | undefined;
    return data?.error ?? 'Feiertag konnte nicht gespeichert werden.';
  })();

  const openTimesEditor = (): void => {
    const source = structure.length > 0 ? structure : (structureData?.structure ?? []);
    setDraftRows(structureToDraft(source));
    setShowTimesEditor(true);
  };

  const updateDraft = (key: string, patch: Partial<DraftRow>): void => {
    setDraftRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addDraftRow = (type: 'LESSON' | 'BREAK'): void => {
    const n = draftRows.filter((r) => r.type === 'LESSON').length + 1;
    setDraftRows((rows) => [
      ...rows,
      {
        key: `new-${Date.now()}-${type}`,
        type,
        label: type === 'LESSON' ? `${n}. Lektion` : 'Pause',
        startTime: type === 'LESSON' ? '08:00' : '',
        endTime: type === 'LESSON' ? '08:45' : '',
      },
    ]);
  };

  const removeDraftRow = (key: string): void => {
    setDraftRows((rows) => rows.filter((r) => r.key !== key));
  };

  const moveDraftRow = (key: string, dir: -1 | 1): void => {
    setDraftRows((rows) => {
      const idx = rows.findIndex((r) => r.key === key);
      if (idx < 0) return rows;
      const next = idx + dir;
      if (next < 0 || next >= rows.length) return rows;
      const copy = [...rows];
      const tmp = copy[idx]!;
      copy[idx] = copy[next]!;
      copy[next] = tmp;
      return copy;
    });
  };

  const openCell = (dayOfWeek: number, period: number): void => {
    if (holidayOnExceptionDate) return;
    if (exceptionDate && exceptionDayOfWeek !== null && exceptionDayOfWeek !== dayOfWeek) {
      return;
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
  const gridRows = structure.length > 0 ? structure : periods.map((p) => ({
    type: 'LESSON' as const,
    label: p.label,
    startTime: p.startTime,
    endTime: p.endTime,
    period: p.period,
  }));
  const selectedClass = classes?.find((c) => c.id === classId);

  const holidayEditor = (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900">Feiertag / schulfrei</h3>
        <p className="text-xs text-neutral-500 mt-0.5">
          Gilt für alle Klassen – an diesen Tagen findet kein Unterricht statt.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="date"
          value={holidayDate}
          onChange={(e) => setHolidayDate(e.target.value)}
          className={`${fieldClass} sm:w-40`}
        />
        <input
          type="text"
          value={holidayName}
          onChange={(e) => setHolidayName(e.target.value)}
          placeholder="z.B. Bundesfeiertag"
          className={fieldClass}
        />
        <button
          type="button"
          onClick={() => saveHolidayMutation.mutate()}
          disabled={saveHolidayMutation.isPending || !holidayDate || !holidayName.trim()}
          className={`${btnPrimary} shrink-0`}
        >
          Hinzufügen
        </button>
      </div>
      {holidaySaveError && (
        <p className="text-sm text-error">{holidaySaveError}</p>
      )}
      {(holidays?.length ?? 0) === 0 ? (
        <p className="text-sm text-neutral-400 py-2">Noch keine Feiertage erfasst.</p>
      ) : (
        <ul className="rounded-lg border border-neutral-200 divide-y divide-neutral-100 overflow-hidden bg-white">
          {holidays!.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">{h.name}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{holidayDateLabel(h.date)}</p>
              </div>
              <button
                type="button"
                onClick={() => deleteHolidayMutation.mutate(h.id)}
                disabled={deleteHolidayMutation.isPending}
                className="p-2 rounded-md text-neutral-400 hover:text-error hover:bg-red-50 transition-colors"
                title="Feiertag entfernen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-red-light text-brand-red">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Stundenplan</h1>
            <p className="text-sm text-neutral-500 mt-1 max-w-xl leading-relaxed">
              Wochenvorlage pro Klasse für das Semester. Zeiten, Feiertage und Ausnahmen zentral pflegen.
            </p>
          </div>
        </div>
        <button type="button" onClick={openTimesEditor} className={`${btnSecondary} shrink-0`}>
          <Clock className="w-4 h-4" />
          Zeiten bearbeiten
        </button>
      </div>

      {/* Toolbar */}
      <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex-1 min-w-0 max-w-md">
            <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1.5">
              Klasse
            </label>
            <select
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setExceptionDate('');
                setShowExceptionPanel(false);
                closeEditor();
              }}
              className={fieldClass}
            >
              <option value="">— Klasse wählen —</option>
              {classes?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.schoolYear ? ` · ${c.schoolYear}` : ''}
                </option>
              ))}
            </select>
          </div>
          {classId && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowExceptionPanel((v) => !v)}
                className={showExceptionPanel ? btnPrimary : btnSecondary}
              >
                <CalendarRange className="w-4 h-4" />
                {showExceptionPanel ? 'Panel schliessen' : 'Ausnahme & Feiertag'}
              </button>
            </div>
          )}
        </div>
        {selectedClass && (
          <p className="mt-3 text-sm text-neutral-600">
            Aktuell:{' '}
            <span className="font-semibold text-neutral-900">{selectedClass.name}</span>
            {selectedClass.schoolYear ? (
              <span className="text-neutral-500"> · Schuljahr {selectedClass.schoolYear}</span>
            ) : null}
          </p>
        )}
      </div>

      {/* Ausnahme-/Feiertags-Panel */}
      {classId && showExceptionPanel && (
        <div className="mb-6 rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-neutral-200">
            <div className="p-4 sm:p-5 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">Ausnahme für diese Klasse</h3>
                <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                  Stellvertretung, Verschiebung oder Ausfall – die Wochenvorlage bleibt unverändert.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Datum</label>
                <input
                  type="date"
                  value={exceptionDate}
                  onChange={(e) => setExceptionDate(e.target.value)}
                  className={`${fieldClass} max-w-xs`}
                />
              </div>
            </div>
            <div className="p-4 sm:p-5">{holidayEditor}</div>
          </div>
        </div>
      )}

      {/* Feiertags-Kurzliste wenn Panel zu */}
      {classId && !showExceptionPanel && (holidays?.length ?? 0) > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Feiertage / schulfrei
            </p>
            <button type="button" onClick={() => setShowExceptionPanel(true)} className="text-xs font-medium text-brand-red hover:underline">
              Verwalten
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {holidays!.slice(0, 8).map((h) => (
              <span
                key={h.id}
                className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700"
              >
                <span className="font-medium">{h.name}</span>
                <span className="text-neutral-400">{holidayDateLabel(h.date)}</span>
              </span>
            ))}
            {(holidays?.length ?? 0) > 8 && (
              <span className="text-xs text-neutral-400 self-center">+{(holidays!.length - 8)} weitere</span>
            )}
          </div>
        </div>
      )}

      {!classId && (
        <div className="space-y-6">
          <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-14 text-center">
            <CalendarDays className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-base font-medium text-neutral-700">Klasse auswählen</p>
            <p className="text-sm text-neutral-500 mt-1 max-w-md mx-auto leading-relaxed">
              Wähle oben eine Klasse, um den Wochenstundenplan zu bearbeiten.
              Zeiten und Feiertage kannst du unabhängig davon pflegen.
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm max-w-2xl">
            {holidayEditor}
          </div>
        </div>
      )}

      {classId && isLoading && (
        <div className="rounded-xl border border-neutral-200 bg-white py-16 text-center text-sm text-neutral-400">
          Stundenplan wird geladen…
        </div>
      )}

      {classId && !isLoading && (
        <>
          {isExceptionMode && holidayOnExceptionDate && (
            <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
              <span className="font-semibold">Schulfrei</span>
              {' · '}
              {exceptionDate}: «{holidayOnExceptionDate.name}» – Zellen sind gesperrt.
            </div>
          )}
          {isExceptionMode && !holidayOnExceptionDate && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <span className="font-semibold">Ausnahme-Modus</span>
              {' · '}
              {exceptionDate} ({WEEKDAY_FULL[exceptionDayOfWeek!]}) – Änderungen gelten nur für dieses Datum.
            </div>
          )}
          {exceptionDate && exceptionDayOfWeek === null && (
            <div className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
              Ausnahmen nur Mo–Fr. Feiertage kannst du trotzdem im Panel erfassen.
            </div>
          )}

          <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse table-fixed">
                <thead>
                  <tr className="bg-neutral-50">
                    <th className="sticky left-0 z-10 w-[7.5rem] sm:w-36 p-3 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500 border-b border-r border-neutral-200 bg-neutral-50">
                      Zeit
                    </th>
                    {[1, 2, 3, 4, 5].map((d) => (
                      <th
                        key={d}
                        className={`p-3 text-center border-b border-neutral-200 ${
                          isExceptionMode && exceptionDayOfWeek === d
                            ? 'bg-amber-50 text-amber-900'
                            : isExceptionMode
                              ? 'text-neutral-300'
                              : 'text-neutral-700'
                        }`}
                      >
                        <span className="block text-sm font-semibold">{WEEKDAY_LABELS[d]}</span>
                        <span className="hidden sm:block text-[11px] font-normal text-neutral-400 mt-0.5">
                          {WEEKDAY_FULL[d]}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gridRows.map((row, rowIdx) => {
                    if (row.type === 'BREAK') {
                      return (
                        <tr key={`break-${rowIdx}-${row.label}`}>
                          <td
                            colSpan={6}
                            className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400 bg-neutral-100/90 border-y border-neutral-200"
                          >
                            {row.label}
                            {row.startTime && row.endTime ? (
                              <span className="font-mono font-normal normal-case tracking-normal ml-2 text-neutral-400">
                                {row.startTime}–{row.endTime}
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    }

                    const periodNum = row.period!;
                    return (
                      <Fragment key={`lesson-${periodNum}`}>
                        <tr>
                          <td className="sticky left-0 z-10 p-3 align-middle bg-white border-r border-b border-neutral-200">
                            <div className="text-sm font-semibold text-neutral-900 leading-tight">
                              {row.label}
                            </div>
                            <div className="text-xs text-neutral-500 font-mono mt-1 tabular-nums">
                              {row.startTime}–{row.endTime}
                            </div>
                          </td>
                          {[1, 2, 3, 4, 5].map((day) => {
                            const slot = slotsByKey.get(`${day}-${periodNum}`);
                            const ex =
                              isExceptionMode && exceptionDayOfWeek === day
                                ? exceptionByPeriod.get(periodNum)
                                : undefined;
                            const dimmed =
                              Boolean(holidayOnExceptionDate) ||
                              (isExceptionMode && exceptionDayOfWeek !== day);
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
                              color = 'bg-neutral-50 border-neutral-200 text-neutral-400';
                            } else if (ex?.type === 'OVERRIDE') {
                              displayName = ex.subject?.name ?? displayName;
                              displayTeacher = ex.teacher
                                ? `${ex.teacher.firstName} ${ex.teacher.lastName}`
                                : displayTeacher;
                              displayRoom = ex.room;
                              color = subjectColor(displayName ?? 'x');
                            }

                            return (
                              <td
                                key={`${day}-${periodNum}`}
                                className="p-1.5 align-top border-b border-neutral-100"
                              >
                                <button
                                  type="button"
                                  disabled={!clickable}
                                  onClick={() => openCell(day, periodNum)}
                                  className={`w-full h-full min-h-[76px] rounded-lg border text-left p-2.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/30 focus-visible:ring-offset-1 ${
                                    dimmed
                                      ? 'opacity-30 cursor-not-allowed border-neutral-100 bg-neutral-50'
                                      : hasContent
                                        ? `${color} hover:shadow-sm hover:border-neutral-300`
                                        : 'border-dashed border-neutral-200 bg-neutral-50/50 hover:bg-neutral-100 hover:border-neutral-300 text-neutral-300'
                                  }`}
                                >
                                  {hasContent ? (
                                    <div className="space-y-1">
                                      <div
                                        className={`text-sm font-semibold leading-snug ${
                                          cancelled ? 'line-through' : ''
                                        }`}
                                      >
                                        {displayName}
                                        {(slot?.isTest || ex?.isTest) && !cancelled && (
                                          <span className="ml-1.5 align-middle inline-block rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide opacity-80">
                                            Test
                                          </span>
                                        )}
                                      </div>
                                      {displayTeacher && (
                                        <div className="text-xs opacity-80 truncate leading-tight">
                                          {displayTeacher}
                                        </div>
                                      )}
                                      {displayRoom && (
                                        <div className="text-[11px] opacity-60 leading-tight">
                                          Raum {displayRoom}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center h-full min-h-[56px]">
                                      <Plus className="w-4 h-4" strokeWidth={1.75} />
                                    </div>
                                  )}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-neutral-100 bg-neutral-50/80 text-xs text-neutral-500">
              Klicke eine Zelle, um Fach, Lehrperson und Raum zu setzen.
            </div>
          </div>
        </>
      )}

      {showTimesEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4 backdrop-blur-[1px]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-neutral-200">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">Tageszeiten</h2>
                <p className="text-sm text-neutral-500 mt-0.5">
                  Lektionen und Pausen – gilt für alle Klassen.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTimesEditor(false)}
                className="p-2 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {draftRows.map((row, idx) => (
                <div
                  key={row.key}
                  className={`flex flex-wrap items-center gap-2 p-3 rounded-xl border ${
                    row.type === 'BREAK'
                      ? 'bg-neutral-50 border-neutral-200'
                      : 'bg-white border-neutral-200'
                  }`}
                >
                  <div className="flex flex-col items-center gap-0.5 text-neutral-400 w-7">
                    <button
                      type="button"
                      onClick={() => moveDraftRow(row.key, -1)}
                      disabled={idx === 0}
                      className="disabled:opacity-30 text-xs leading-none px-1 py-0.5 hover:text-neutral-700"
                    >
                      ↑
                    </button>
                    <GripVertical className="w-3.5 h-3.5" />
                    <button
                      type="button"
                      onClick={() => moveDraftRow(row.key, 1)}
                      disabled={idx === draftRows.length - 1}
                      className="disabled:opacity-30 text-xs leading-none px-1 py-0.5 hover:text-neutral-700"
                    >
                      ↓
                    </button>
                  </div>
                  <select
                    value={row.type}
                    onChange={(e) => {
                      const type = e.target.value as 'LESSON' | 'BREAK';
                      updateDraft(row.key, {
                        type,
                        label: type === 'BREAK' ? (row.label.includes('Lektion') ? 'Pause' : row.label) : row.label,
                      });
                    }}
                    className="h-9 px-2 border border-neutral-300 rounded-lg text-sm w-[7.25rem] bg-white"
                  >
                    <option value="LESSON">Lektion</option>
                    <option value="BREAK">Pause</option>
                  </select>
                  <input
                    value={row.label}
                    onChange={(e) => updateDraft(row.key, { label: e.target.value })}
                    className="h-9 flex-1 min-w-[8rem] px-2.5 border border-neutral-300 rounded-lg text-sm"
                    placeholder="Bezeichnung"
                  />
                  <input
                    type="time"
                    value={row.startTime}
                    onChange={(e) => updateDraft(row.key, { startTime: e.target.value })}
                    className="h-9 px-2 border border-neutral-300 rounded-lg text-sm"
                    title="Start"
                  />
                  <span className="text-neutral-400 text-xs">bis</span>
                  <input
                    type="time"
                    value={row.endTime}
                    onChange={(e) => updateDraft(row.key, { endTime: e.target.value })}
                    className="h-9 px-2 border border-neutral-300 rounded-lg text-sm"
                    title="Ende"
                  />
                  <button
                    type="button"
                    onClick={() => removeDraftRow(row.key)}
                    className="p-2 rounded-lg text-neutral-400 hover:text-error hover:bg-red-50"
                    title="Zeile entfernen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-neutral-200 space-y-3 bg-neutral-50/50">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => addDraftRow('LESSON')} className={btnSecondary}>
                  + Lektion
                </button>
                <button type="button" onClick={() => addDraftRow('BREAK')} className={btnSecondary}>
                  + Pause
                </button>
              </div>
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Entfernte Lektionen löschen auch zugehörige Stundenplan-Einträge dieser Perioden.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => saveStructureMutation.mutate()}
                  disabled={saveStructureMutation.isPending || draftRows.length === 0}
                  className={btnPrimary}
                >
                  Zeiten speichern
                </button>
                <button type="button" onClick={() => setShowTimesEditor(false)} className={btnGhost}>
                  Abbrechen
                </button>
              </div>
              {saveStructureMutation.isError && (
                <p className="text-sm text-error">Speichern fehlgeschlagen. Zeiten und Bezeichnungen prüfen.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4 backdrop-blur-[1px]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-neutral-200">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">
                  {WEEKDAY_FULL[editing.dayOfWeek] ?? WEEKDAY_LABELS[editing.dayOfWeek]}
                </h2>
                <p className="text-sm text-neutral-500 mt-0.5">
                  {periods.find((p) => p.period === editing.period)?.label ?? `${editing.period}. Lektion`}
                  {periods.find((p) => p.period === editing.period) && (
                    <span className="font-mono text-neutral-400 ml-2">
                      {periods.find((p) => p.period === editing.period)!.startTime}
                      –
                      {periods.find((p) => p.period === editing.period)!.endTime}
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="p-2 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <p className="text-xs text-neutral-500 leading-relaxed">
                {isExceptionMode
                  ? `Ausnahme für ${exceptionDate} – Vorlage bleibt unverändert.`
                  : 'Eintrag in der Wochenvorlage (gilt für das Semester).'}
              </p>

              {isExceptionMode && (
                <label className="flex items-center gap-2.5 text-sm text-neutral-800">
                  <input
                    type="checkbox"
                    checked={exceptionCancel}
                    onChange={(e) => setExceptionCancel(e.target.checked)}
                    className="rounded border-neutral-300"
                  />
                  Ausfall an diesem Datum
                </label>
              )}

              {!exceptionCancel && (
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Fach *</label>
                    <select
                      required
                      value={subjectId}
                      onChange={(e) => onSubjectChange(e.target.value)}
                      className={fieldClass}
                    >
                      <option value="">Fach wählen</option>
                      {subjects?.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Lehrperson *</label>
                    <select
                      required
                      value={teacherId}
                      onChange={(e) => setTeacherId(e.target.value)}
                      className={fieldClass}
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
                    <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Raum *</label>
                    <input
                      required
                      value={room}
                      onChange={(e) => setRoom(e.target.value)}
                      className={fieldClass}
                      placeholder="z. B. 101"
                      maxLength={50}
                    />
                  </div>
                  <label className="flex items-center gap-2.5 text-sm text-neutral-800">
                    <input
                      type="checkbox"
                      checked={isTest}
                      onChange={(e) => setIsTest(e.target.checked)}
                      className="rounded border-neutral-300"
                    />
                    Prüfung / Test
                  </label>
                  {!isExceptionMode && canDoubleLesson(structure, editing.period) && (
                    <label className="flex items-center gap-2.5 text-sm text-neutral-800">
                      <input
                        type="checkbox"
                        checked={doubleLesson}
                        onChange={(e) => setDoubleLesson(e.target.checked)}
                        className="rounded border-neutral-300"
                      />
                      Doppellektion (nächste Periode mitbelegen)
                    </label>
                  )}
                </div>
              )}

              {saveErrorMessage && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800" role="alert">
                  {saveErrorMessage}
                </div>
              )}
              {deleteMutation.isError && (
                <p className="text-sm text-error">Löschen fehlgeschlagen.</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 px-5 py-4 border-t border-neutral-200 bg-neutral-50/60">
              <button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={
                  saveMutation.isPending ||
                  (!exceptionCancel && (!subjectId || !teacherId || !room.trim()))
                }
                className={btnPrimary}
              >
                Speichern
              </button>
              {(editing.slot || editing.exception) && (
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="inline-flex h-10 items-center px-4 rounded-lg border border-red-200 text-error text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                >
                  {isExceptionMode ? 'Ausnahme entfernen' : 'Löschen'}
                </button>
              )}
              <button type="button" onClick={closeEditor} className={btnGhost}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
