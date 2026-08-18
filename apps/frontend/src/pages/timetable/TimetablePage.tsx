// Stundenplan: Wochenraster pro Klasse (Fach, Lehrperson, Zimmer)

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { apiClient } from '../../api/client';
import type { Class, Subject, User } from '@schuladmin/shared';
import { CalendarDays, Clock, GripVertical, Plus, Printer, Trash2, X } from 'lucide-react';
import { moduleLegendLine } from './moduleLegend';

type Period = { period: number; startTime: string; endTime: string; label: string };

type StructureRow = {
  id?: string;
  sortOrder?: number;
  type: 'LESSON' | 'BREAK';
  label: string;
  startTime: string | null;
  endTime: string | null;
  period: number | null;
};

type SchoolHoliday = { id: string; date: string; name: string };

type Slot = {
  id: string;
  classId: string;
  dayOfWeek: number;
  period: number;
  subjectId: string;
  teacherId: string;
  room: string | null;
  isTest: boolean;
  subject?: { id: string; name: string; color?: string };
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

const WEEKDAYS = [1, 2, 3, 4, 5] as const;
const WEEKDAY_FULL: Record<number, string> = {
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag',
};

/** Tageszeiten gemäss IT-Bénédict-Stundenplan (IT1b-Beispiel) */
const BENEDICT_STRUCTURE: DraftRow[] = [
  { key: 'b-1', type: 'LESSON', label: '1. Lektion', startTime: '07:20', endTime: '08:05' },
  { key: 'b-2', type: 'LESSON', label: '2. Lektion', startTime: '08:15', endTime: '09:00' },
  { key: 'b-3', type: 'LESSON', label: '3. Lektion', startTime: '09:10', endTime: '09:55' },
  { key: 'b-p1', type: 'BREAK', label: 'Pause', startTime: '09:55', endTime: '10:15' },
  { key: 'b-4', type: 'LESSON', label: '4. Lektion', startTime: '10:15', endTime: '11:00' },
  { key: 'b-5', type: 'LESSON', label: '5. Lektion', startTime: '11:10', endTime: '11:55' },
  { key: 'b-6', type: 'LESSON', label: '6. Lektion', startTime: '12:05', endTime: '12:50' },
  { key: 'b-p2', type: 'BREAK', label: 'Mittagspause', startTime: '12:50', endTime: '13:00' },
  { key: 'b-7', type: 'LESSON', label: '7. Lektion', startTime: '13:00', endTime: '13:45' },
  { key: 'b-8', type: 'LESSON', label: '8. Lektion', startTime: '13:55', endTime: '14:40' },
  { key: 'b-9', type: 'LESSON', label: '9. Lektion', startTime: '14:55', endTime: '15:40' },
  { key: 'b-10', type: 'LESSON', label: '10. Lektion', startTime: '15:50', endTime: '16:35' },
  { key: 'b-11', type: 'LESSON', label: '11. Lektion', startTime: '16:45', endTime: '17:30' },
];

const fieldClass = 'input-modern h-10';
const btnPrimary = 'btn-primary h-10';
const btnSecondary = 'btn-secondary h-10';

function formatTime(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/^0/, '');
}

function roomLabel(room: string | null | undefined): string {
  const r = (room ?? '').trim();
  if (!r) return '';
  return /^zimmer\b/i.test(r) ? r : `Zimmer ${r}`;
}

function teacherLabel(teacher?: { firstName: string; lastName: string } | null): string {
  if (!teacher) return '';
  return `${teacher.firstName} ${teacher.lastName}`.trim();
}

function subjectTeacherName(
  subject: { teachers?: { id: string; firstName: string; lastName: string }[] | null },
  teacherId?: string
): string {
  const list = subject.teachers ?? [];
  const t = teacherId ? list.find((u) => u.id === teacherId) : list[0];
  return t ? teacherLabel(t) : list.map((u) => teacherLabel(u)).filter(Boolean).join(', ');
}

function subjectTint(color?: string | null): { backgroundColor: string; boxShadow: string } | undefined {
  const hex = color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : null;
  if (!hex) return undefined;
  return {
    backgroundColor: `color-mix(in srgb, ${hex} 22%, white)`,
    boxShadow: `inset 3px 0 0 ${hex}`,
  };
}

function slotSignature(slot: Slot | undefined): string | null {
  if (!slot) return null;
  return `${slot.subjectId}|${slot.teacherId}|${slot.room ?? ''}`;
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
  const d = new Date(`${raw}T12:00:00`);
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [classId, setClassId] = useState(() => searchParams.get('classId') ?? '');
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

  useEffect(() => {
    if (classId || !classes?.length) return;
    const it1b = classes.find((c) => c.name === 'IT1b');
    setClassId(it1b?.id ?? classes[0]!.id);
  }, [classes, classId]);

  useEffect(() => {
    const next = classId ? { classId } : {};
    const current = searchParams.get('classId') ?? '';
    if (current === classId) return;
    setSearchParams(next, { replace: true });
  }, [classId, searchParams, setSearchParams]);

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Subject[] }>('/api/v1/subjects');
      return data.data;
    },
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
    for (const e of exceptions ?? []) map.set(e.period, e);
    return map;
  }, [exceptions]);

  const exceptionDayOfWeek = useMemo(() => {
    if (!exceptionDate) return null;
    const js = new Date(`${exceptionDate}T12:00:00`).getDay();
    if (js === 0 || js === 6) return null;
    return js;
  }, [exceptionDate]);

  const invalidatePlan = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['timetable', classId] });
    void queryClient.invalidateQueries({ queryKey: ['timetable-exceptions'] });
    void queryClient.invalidateQueries({ queryKey: ['lessons'] });
  };

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
      invalidatePlan();
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
      if (editing.slot) await apiClient.delete(`/api/v1/timetable/slots/${editing.slot.id}`);
    },
    onSuccess: () => {
      invalidatePlan();
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

  const structureSaveError = (() => {
    const err = saveStructureMutation.error;
    if (!err || !axios.isAxiosError(err)) return null;
    const data = err.response?.data as { error?: string } | undefined;
    return data?.error ?? 'Zeiten konnten nicht gespeichert werden.';
  })();

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
    setDraftRows(
      source.length > 0
        ? structureToDraft(source)
        : BENEDICT_STRUCTURE.map((r) => ({ ...r, key: `${r.key}-${Date.now()}` }))
    );
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
        startTime: type === 'LESSON' ? '08:15' : '',
        endTime: type === 'LESSON' ? '09:00' : '',
      },
    ]);
  };

  const removeDraftRow = (key: string): void => {
    setDraftRows((rows) => rows.filter((r) => r.key !== key));
  };

  const moveDraftRow = (key: string, dir: -1 | 1): void => {
    setDraftRows((rows) => {
      const idx = rows.findIndex((r) => r.key === key);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= rows.length) return rows;
      const copy = [...rows];
      const tmp = copy[idx]!;
      copy[idx] = copy[next]!;
      copy[next] = tmp;
      return copy;
    });
  };

  const closeEditor = (): void => {
    setEditing(null);
    setDoubleLesson(false);
    setExceptionCancel(false);
  };

  const openCell = (dayOfWeek: number, period: number): void => {
    if (holidayOnExceptionDate) return;
    if (exceptionDate && exceptionDayOfWeek !== null && exceptionDayOfWeek !== dayOfWeek) return;
    const slot = slotsByKey.get(`${dayOfWeek}-${period}`);
    const ex =
      exceptionDate && exceptionDayOfWeek === dayOfWeek ? exceptionByPeriod.get(period) : undefined;
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

  const onSubjectChange = (id: string): void => {
    setSubjectId(id);
    const sub = subjects?.find((s) => s.id === id);
    const assigned = sub?.teachers ?? [];
    setTeacherId((current) => {
      if (assigned.length === 1) return assigned[0]!.id;
      if (current && assigned.some((t) => t.id === current)) return current;
      return '';
    });
  };

  const isExceptionMode = Boolean(exceptionDate && exceptionDayOfWeek);
  const gridRows: StructureRow[] =
    structure.length > 0
      ? structure
      : periods.map((p) => ({
          type: 'LESSON' as const,
          label: p.label,
          startTime: p.startTime,
          endTime: p.endTime,
          period: p.period,
        }));

  const selectedClass = classes?.find((c) => c.id === classId);

  const legend = useMemo(() => {
    const items = new Map<string, { name: string; teacher: string }>();
    for (const s of timetable?.slots ?? []) {
      if (!s.subject?.name) continue;
      items.set(s.subject.id, {
        name: s.subject.name,
        teacher: teacherLabel(s.teacher),
      });
    }
    return [...items.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }, [timetable]);

  const mergeByDay = useMemo(() => {
    const result = new Map<number, { span: Map<number, number>; skip: Set<number> }>();
    for (const day of WEEKDAYS) {
      const span = new Map<number, number>();
      const skip = new Set<number>();
      const lessonIdxs = gridRows
        .map((row, idx) => ({ row, idx }))
        .filter((x) => x.row.type === 'LESSON' && x.row.period != null);

      let i = 0;
      while (i < lessonIdxs.length) {
        const current = lessonIdxs[i]!;
        const period = current.row.period!;
        const sig = slotSignature(slotsByKey.get(`${day}-${period}`));
        let count = 1;
        if (sig) {
          while (i + count < lessonIdxs.length) {
            const next = lessonIdxs[i + count]!;
            const between = gridRows.slice(current.idx + 1, next.idx);
            if (between.some((r) => r.type === 'BREAK')) break;
            const nextSig = slotSignature(slotsByKey.get(`${day}-${next.row.period}`));
            if (nextSig !== sig) break;
            skip.add(next.row.period!);
            count++;
          }
        }
        span.set(period, count);
        i += count;
      }
      result.set(day, { span, skip });
    }
    return result;
  }, [gridRows, slotsByKey]);

  const editingPeriod = editing ? periods.find((p) => p.period === editing.period) : undefined;

  const holidayEditor = (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900">Feiertag / schulfrei</h3>
        <p className="mt-0.5 text-xs text-neutral-500">Gilt für alle Klassen.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
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
          placeholder="z. B. Auffahrt"
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
      {holidaySaveError && <p className="text-sm text-error">{holidaySaveError}</p>}
      {(holidays?.length ?? 0) === 0 ? (
        <p className="py-2 text-sm text-neutral-400">Noch keine Feiertage erfasst.</p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-neutral-200 bg-white divide-y divide-neutral-100">
          {holidays!.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-900">{h.name}</p>
                <p className="mt-0.5 text-xs text-neutral-500">{holidayDateLabel(h.date)}</p>
              </div>
              <button
                type="button"
                onClick={() => deleteHolidayMutation.mutate(h.id)}
                disabled={deleteHolidayMutation.isPending}
                className="rounded-md p-2 text-neutral-400 transition-colors hover:bg-red-50 hover:text-error"
                title="Feiertag entfernen"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-md flex-1">
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
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
            <option value="">Klasse wählen</option>
            {classes?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.schoolYear ? ` · ${c.schoolYear}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={openTimesEditor} className={btnSecondary}>
            <Clock className="h-4 w-4" />
            Zeiten
          </button>
          {classId && (
            <button
              type="button"
              onClick={() => setShowExceptionPanel((v) => !v)}
              className={showExceptionPanel ? btnPrimary : btnSecondary}
            >
              Ausnahmen
            </button>
          )}
          <Link
            to={classId ? `/timetable/print?classId=${classId}` : '/timetable/print'}
            className={btnSecondary}
          >
            <Printer className="h-4 w-4" />
            Drucken
          </Link>
        </div>
      </div>

      {classId && showExceptionPanel && (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <div className="grid divide-y divide-neutral-200 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
            <div className="space-y-3 p-5">
              <h3 className="text-sm font-semibold text-neutral-900">Ausnahme für diese Klasse</h3>
              <p className="text-xs text-neutral-500">
                Vertretung oder Ausfall an einem Datum – die Wochenvorlage bleibt.
              </p>
              <input
                type="date"
                value={exceptionDate}
                onChange={(e) => setExceptionDate(e.target.value)}
                className={`${fieldClass} max-w-xs`}
              />
            </div>
            <div className="p-5">{holidayEditor}</div>
          </div>
        </div>
      )}

      {!classId && (
        <div className="rounded-xl border border-neutral-200 bg-white px-6 py-16 text-center">
          <CalendarDays className="mx-auto mb-3 h-8 w-8 text-neutral-300" />
          <p className="font-medium text-neutral-800">Klasse wählen</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500">
            Danach setzt du pro Stunde ein Fach (mit zugewiesener Lehrperson) und buchst ein Zimmer.
          </p>
        </div>
      )}

      {classId && isLoading && (
        <div className="rounded-xl border border-neutral-200 bg-white py-16 text-center text-sm text-neutral-400">
          Stundenplan wird geladen…
        </div>
      )}

      {classId && !isLoading && selectedClass && (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-red">Stundenplan</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-neutral-900">
              {selectedClass.name}
              {selectedClass.semester ? (
                <span className="ml-2 text-base font-normal text-neutral-500">
                  {selectedClass.semester}. Semester
                </span>
              ) : null}
            </h1>
            {selectedClass.schoolYear ? (
              <p className="mt-0.5 text-sm text-neutral-500">Schuljahr {selectedClass.schoolYear}</p>
            ) : null}
          </div>

          {isExceptionMode && holidayOnExceptionDate && (
            <div className="border-b border-sky-100 bg-sky-50 px-5 py-2.5 text-sm text-sky-950">
              Schulfrei am {exceptionDate}: {holidayOnExceptionDate.name}
            </div>
          )}
          {isExceptionMode && !holidayOnExceptionDate && (
            <div className="border-b border-amber-100 bg-amber-50 px-5 py-2.5 text-sm text-amber-950">
              Ausnahme {exceptionDate} ({WEEKDAY_FULL[exceptionDayOfWeek!]}) – nur dieser Tag.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] table-fixed border-collapse">
              <thead>
                <tr className="bg-neutral-900 text-white">
                  <th className="w-28 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider">
                    Tag / Zeit
                  </th>
                  {WEEKDAYS.map((d) => (
                    <th
                      key={d}
                      className={`px-2 py-2.5 text-center text-sm font-semibold ${
                        isExceptionMode && exceptionDayOfWeek === d ? 'bg-brand-red' : ''
                      }`}
                    >
                      {WEEKDAY_FULL[d]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gridRows.map((row, rowIdx) => {
                  if (row.type === 'BREAK') {
                    return (
                      <tr key={`break-${rowIdx}`}>
                        <td
                          colSpan={6}
                          className="bg-neutral-100 px-3 py-1.5 text-center text-[11px] font-medium uppercase tracking-wider text-neutral-500"
                        >
                          {row.label}
                          {row.startTime && row.endTime
                            ? ` · ${formatTime(row.startTime)} – ${formatTime(row.endTime)}`
                            : ''}
                        </td>
                      </tr>
                    );
                  }

                  const periodNum = row.period!;
                  return (
                    <tr key={`lesson-${periodNum}`}>
                      <td className="border-r border-b border-neutral-200 bg-neutral-50 px-3 py-2 align-middle">
                        <p className="font-mono text-[13px] font-medium tabular-nums text-neutral-900">
                          {formatTime(row.startTime)} – {formatTime(row.endTime)}
                        </p>
                      </td>
                      {WEEKDAYS.map((day) => {
                        const merge = mergeByDay.get(day);
                        if (merge?.skip.has(periodNum)) return null;

                        const slot = slotsByKey.get(`${day}-${periodNum}`);
                        const ex =
                          isExceptionMode && exceptionDayOfWeek === day
                            ? exceptionByPeriod.get(periodNum)
                            : undefined;
                        const dimmed =
                          Boolean(holidayOnExceptionDate) ||
                          (isExceptionMode && exceptionDayOfWeek !== day);
                        const rowspan = merge?.span.get(periodNum) ?? 1;

                        let name = slot?.subject?.name ?? '';
                        let teacher = teacherLabel(slot?.teacher);
                        let roomText = roomLabel(slot?.room);
                        let cellColor = slot?.subject?.color;
                        let cancelled = false;
                        if (ex?.type === 'CANCEL') {
                          cancelled = true;
                          name = 'Ausfall';
                          teacher = '';
                          roomText = '';
                          cellColor = undefined;
                        } else if (ex?.type === 'OVERRIDE') {
                          name = ex.subject?.name ?? name;
                          teacher = teacherLabel(ex.teacher) || teacher;
                          roomText = roomLabel(ex.room);
                          cellColor = subjects?.find((s) => s.id === (ex.subjectId ?? slot?.subjectId))?.color ?? cellColor;
                        }
                        const filled = Boolean(name);
                        const tint = !dimmed && filled && !cancelled ? subjectTint(cellColor) : undefined;

                        return (
                          <td
                            key={`${day}-${periodNum}`}
                            rowSpan={rowspan}
                            className="border-b border-r border-neutral-200 p-0"
                          >
                            <button
                              type="button"
                              disabled={dimmed}
                              onClick={() => openCell(day, periodNum)}
                              style={tint}
                              className={`flex h-full min-h-[4.75rem] w-full flex-col items-center justify-center px-2 py-2 text-center transition ${
                                dimmed
                                  ? 'cursor-not-allowed bg-neutral-50 opacity-35'
                                  : filled
                                    ? 'hover:brightness-[0.97]'
                                    : 'bg-white hover:bg-neutral-50'
                              }`}
                            >
                              {filled ? (
                                <>
                                  <span
                                    className={`text-[13px] font-semibold leading-tight text-neutral-900 ${
                                      cancelled ? 'line-through text-neutral-400' : ''
                                    }`}
                                  >
                                    {name}
                                  </span>
                                  {roomText ? (
                                    <span className="mt-0.5 text-[11px] leading-tight text-neutral-500">
                                      {roomText}
                                    </span>
                                  ) : null}
                                  {teacher ? (
                                    <span className="mt-0.5 text-[11px] leading-tight text-neutral-600">
                                      {teacher}
                                    </span>
                                  ) : null}
                                </>
                              ) : (
                                <Plus className="h-3.5 w-3.5 text-neutral-300" strokeWidth={1.75} />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-neutral-200 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Legende</p>
            {legend.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-400">
                Noch keine Lektionen. Klicke eine Zelle: Fach wählen, Zimmer buchen.
              </p>
            ) : (
              <ul className="mt-2 columns-1 gap-x-8 text-sm text-neutral-700 sm:columns-2">
                {legend.map((item) => (
                  <li key={item.name} className="break-inside-avoid py-0.5">
                    <span className="font-medium">{moduleLegendLine(item.name)}</span>
                    {item.teacher ? <span className="text-neutral-500"> · {item.teacher}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {showTimesEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Tageszeiten</h2>
                <p className="mt-0.5 text-sm text-neutral-500">Lektionen und Pausen für alle Klassen.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTimesEditor(false)}
                className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
              {draftRows.map((row, idx) => (
                <div
                  key={row.key}
                  className={`flex flex-wrap items-center gap-2 rounded-lg border p-3 ${
                    row.type === 'BREAK' ? 'border-neutral-200 bg-neutral-50' : 'border-neutral-200 bg-white'
                  }`}
                >
                  <div className="flex w-7 flex-col items-center text-neutral-400">
                    <button type="button" onClick={() => moveDraftRow(row.key, -1)} disabled={idx === 0} className="disabled:opacity-30">
                      ↑
                    </button>
                    <GripVertical className="h-3.5 w-3.5" />
                    <button
                      type="button"
                      onClick={() => moveDraftRow(row.key, 1)}
                      disabled={idx === draftRows.length - 1}
                      className="disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                  <select
                    value={row.type}
                    onChange={(e) => updateDraft(row.key, { type: e.target.value as 'LESSON' | 'BREAK' })}
                    className="h-9 w-[7.25rem] rounded-lg border border-neutral-200 bg-white px-2 text-sm"
                  >
                    <option value="LESSON">Lektion</option>
                    <option value="BREAK">Pause</option>
                  </select>
                  <input
                    value={row.label}
                    onChange={(e) => updateDraft(row.key, { label: e.target.value })}
                    className="h-9 min-w-[8rem] flex-1 rounded-lg border border-neutral-200 px-2.5 text-sm"
                    placeholder="Bezeichnung"
                  />
                  <input
                    type="time"
                    value={row.startTime}
                    onChange={(e) => updateDraft(row.key, { startTime: e.target.value })}
                    className="h-9 rounded-lg border border-neutral-200 px-2 text-sm"
                  />
                  <span className="text-xs text-neutral-400">bis</span>
                  <input
                    type="time"
                    value={row.endTime}
                    onChange={(e) => updateDraft(row.key, { endTime: e.target.value })}
                    className="h-9 rounded-lg border border-neutral-200 px-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeDraftRow(row.key)}
                    className="rounded-lg p-2 text-neutral-400 hover:bg-red-50 hover:text-error"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="space-y-3 border-t border-neutral-200 bg-neutral-50 px-5 py-4">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => addDraftRow('LESSON')} className={btnSecondary}>
                  + Lektion
                </button>
                <button type="button" onClick={() => addDraftRow('BREAK')} className={btnSecondary}>
                  + Pause
                </button>
                <button
                  type="button"
                  onClick={() => setDraftRows(BENEDICT_STRUCTURE.map((r) => ({ ...r, key: `${r.key}-${Date.now()}` })))}
                  className={btnSecondary}
                >
                  Benedict-Zeiten laden
                </button>
              </div>
              <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Entfernte Lektionen löschen auch die Einträge dieser Perioden.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => saveStructureMutation.mutate()}
                  disabled={saveStructureMutation.isPending || draftRows.length === 0}
                  className={btnPrimary}
                >
                  {saveStructureMutation.isPending ? 'Speichern…' : 'Zeiten speichern'}
                </button>
                <button type="button" onClick={() => setShowTimesEditor(false)} className="btn-secondary h-10">
                  Abbrechen
                </button>
              </div>
              {structureSaveError && (
                <p className="text-sm text-error" role="alert">
                  {structureSaveError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">{WEEKDAY_FULL[editing.dayOfWeek]}</h2>
                <p className="mt-0.5 font-mono text-sm text-neutral-500">
                  {editingPeriod
                    ? `${formatTime(editingPeriod.startTime)} – ${formatTime(editingPeriod.endTime)}`
                    : `${editing.period}. Lektion`}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <p className="text-xs text-neutral-500">
                {isExceptionMode
                  ? `Ausnahme für ${exceptionDate}. Die Wochenvorlage bleibt.`
                  : 'Fach wählen (Lehrperson kommt vom Modul), danach Zimmer buchen.'}
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
                    <label className="mb-1.5 block text-[13px] font-medium text-neutral-700">Fach</label>
                    <select required value={subjectId} onChange={(e) => onSubjectChange(e.target.value)} className={fieldClass}>
                      <option value="">Fach wählen</option>
                      {subjects?.map((s) => {
                        const who = subjectTeacherName(s);
                        return (
                          <option key={s.id} value={s.id}>
                            {who ? `${s.name} · ${who}` : s.name}
                          </option>
                        );
                      })}
                    </select>
                    {(subjects?.length ?? 0) === 0 && (
                      <p className="mt-1.5 text-xs text-neutral-500">
                        Unter Module zuerst Fächer anlegen und jeder Lehrperson zuweisen.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-neutral-700">Lehrperson</label>
                    <select required value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className={fieldClass}>
                      <option value="">Lehrperson wählen</option>
                      {(isExceptionMode
                        ? teachers
                        : subjects?.find((s) => s.id === subjectId)?.teachers ?? []
                      )?.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.firstName} {t.lastName}
                        </option>
                      ))}
                    </select>
                    {!isExceptionMode && subjectId && (subjects?.find((s) => s.id === subjectId)?.teachers?.length ?? 0) === 0 && (
                      <p className="mt-1.5 text-xs text-neutral-500">
                        Diesem Modul sind noch keine Lehrpersonen zugewiesen.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-neutral-700">Zimmer</label>
                    <input
                      required
                      value={room}
                      onChange={(e) => setRoom(e.target.value)}
                      className={fieldClass}
                      placeholder="z. B. 1. OG 136"
                      maxLength={50}
                    />
                  </div>
                  {!isExceptionMode && canDoubleLesson(structure, editing.period) && (
                    <label className="flex items-center gap-2.5 text-sm text-neutral-800">
                      <input
                        type="checkbox"
                        checked={doubleLesson}
                        onChange={(e) => setDoubleLesson(e.target.checked)}
                        className="rounded border-neutral-300"
                      />
                      Doppellektion (nächste Stunde gleich belegen)
                    </label>
                  )}
                </div>
              )}

              {saveErrorMessage && (
                <p className="text-sm text-error" role="alert">
                  {saveErrorMessage}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-neutral-200 bg-neutral-50 px-5 py-4">
              <button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={
                  saveMutation.isPending || (!exceptionCancel && (!subjectId || !teacherId || !room.trim()))
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
                  className="inline-flex h-10 items-center rounded-lg border border-red-200 px-4 text-sm font-medium text-error hover:bg-red-50 disabled:opacity-50"
                >
                  {isExceptionMode ? 'Ausnahme entfernen' : 'Leeren'}
                </button>
              )}
              <button type="button" onClick={closeEditor} className={btnSecondary}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
