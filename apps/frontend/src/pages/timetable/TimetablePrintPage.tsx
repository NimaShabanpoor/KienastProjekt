// Stundenplan-Druckvorlage nach Benedict-Klassenplan (Fach / Zimmer / Lehrperson)

import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { apiClient } from '../../api/client';
import type { Class } from '@schuladmin/shared';
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

type Slot = {
  id: string;
  classId: string;
  dayOfWeek: number;
  period: number;
  subjectId: string;
  teacherId: string;
  room: string | null;
  subject?: { id: string; name: string; color?: string };
  teacher?: { id: string; firstName: string; lastName: string };
};

const WEEKDAYS = [1, 2, 3, 4, 5] as const;
const WEEKDAY_FULL: Record<number, string> = {
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag',
};

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

export default function TimetablePrintPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const classId = searchParams.get('classId') ?? '';

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
    setSearchParams({ classId: it1b?.id ?? classes[0]!.id }, { replace: true });
  }, [classes, classId, setSearchParams]);

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

  const selectedClass = classes?.find((c) => c.id === classId);
  const structure = timetable?.structure ?? [];
  const periods = timetable?.periods ?? [];
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

  const slotsByKey = useMemo(() => {
    const map = new Map<string, Slot>();
    for (const s of timetable?.slots ?? []) {
      map.set(`${s.dayOfWeek}-${s.period}`, s);
    }
    return map;
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

  const legend = useMemo(() => {
    const items = new Map<string, string>();
    for (const s of timetable?.slots ?? []) {
      if (!s.subject?.name) continue;
      items.set(s.subject.id, s.subject.name);
    }
    return [...items.values()].sort((a, b) => a.localeCompare(b, 'de'));
  }, [timetable]);

  return (
    <div className="space-y-6">
      <style>{'@page { size: A4 landscape; margin: 10mm; }'}</style>

      <div className="print:hidden space-y-5">
        <Link to={classId ? `/timetable?classId=${classId}` : '/timetable'} className="btn-secondary w-fit">
          <ArrowLeft className="h-4 w-4" />
          Zurück zum Stundenplan
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-md flex-1">
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Klasse
            </label>
            <select
              className="input-modern h-10"
              value={classId}
              onChange={(e) => setSearchParams(e.target.value ? { classId: e.target.value } : {}, { replace: true })}
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
          <button
            type="button"
            className="btn-primary h-10"
            onClick={() => window.print()}
            disabled={!classId}
          >
            <Printer className="h-4 w-4" />
            Drucken / PDF
          </button>
        </div>
      </div>

      {!classId && (
        <div className="print:hidden rounded-xl border border-neutral-200 bg-white px-6 py-16 text-center text-sm text-neutral-500">
          Klasse wählen, dann erscheint der Druckplan.
        </div>
      )}

      {classId && isLoading && (
        <div className="print:hidden rounded-xl border border-neutral-200 bg-white py-16 text-center text-sm text-neutral-400">
          Stundenplan wird geladen…
        </div>
      )}

      {classId && !isLoading && selectedClass && (
        <div className="overflow-x-auto">
          <div className="print-sheet mx-auto min-w-[960px] max-w-[1100px] rounded-xl border border-neutral-200 bg-white p-8 text-black print:min-w-0 print:rounded-none print:border-0 print:p-0">
            <div className="mb-4 flex items-start justify-between gap-6">
              <div>
                <p className="text-lg font-bold leading-tight">Stundenplan</p>
                <p className="text-lg leading-tight">{selectedClass.name}</p>
              </div>
              <div className="text-right">
                {selectedClass.semester ? (
                  <p className="text-lg font-bold leading-tight">{selectedClass.semester}. Semester</p>
                ) : null}
                {selectedClass.schoolYear ? (
                  <p className="text-lg leading-tight">{selectedClass.schoolYear}</p>
                ) : null}
              </div>
            </div>

            <table className="w-full table-fixed border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="w-24 border-2 border-black bg-neutral-900 p-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white">
                    Tag / Zeit
                  </th>
                  {WEEKDAYS.map((d) => (
                    <th key={d} className="border-2 border-black bg-neutral-900 p-1.5 text-center text-sm font-bold text-white">
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
                          className="border border-black bg-neutral-200 px-2 py-0.5 text-center text-[10px] font-medium uppercase tracking-wider"
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
                      <td className="border-2 border-black bg-neutral-100 p-1.5 text-center font-medium whitespace-nowrap">
                        {formatTime(row.startTime)} – {formatTime(row.endTime)}
                      </td>
                      {WEEKDAYS.map((day) => {
                        const merge = mergeByDay.get(day);
                        if (merge?.skip.has(periodNum)) return null;
                        const slot = slotsByKey.get(`${day}-${periodNum}`);
                        const rowspan = merge?.span.get(periodNum) ?? 1;
                        const name = slot?.subject?.name ?? '';
                        const teacher = teacherLabel(slot?.teacher);
                        const room = roomLabel(slot?.room);

                        return (
                          <td
                            key={`${day}-${periodNum}`}
                            rowSpan={rowspan}
                            className="border border-black border-l-2 p-1.5 text-center align-middle"
                            style={name ? subjectTint(slot?.subject?.color) : undefined}
                          >
                            {name ? (
                              <>
                                <p className="font-bold leading-tight">{name}</p>
                                {room ? <p className="leading-tight">{room}</p> : null}
                                {teacher ? <p className="leading-tight">{teacher}</p> : null}
                              </>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-6">
              <p className="mb-1 text-[11px] font-bold">Legende</p>
              {legend.length === 0 ? (
                <p className="text-[10px] text-neutral-500">Noch keine Lektionen in dieser Klasse.</p>
              ) : (
                <ul className="columns-2 gap-x-10 text-[10px] leading-relaxed">
                  {legend.map((name) => (
                    <li key={name} className="break-inside-avoid">
                      {moduleLegendLine(name)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
