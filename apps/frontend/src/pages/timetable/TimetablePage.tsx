// Stundenplan-Seite mit Wochennavigation und Lektions-Verwaltung
// (Anlegen, Absagen, Löschen) – Aktionen sind rollenbasiert sichtbar.

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Ban,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Plus,
  Printer,
  Trash2,
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Lesson } from '@schuladmin/shared/types/entities';
import { lessonsApi, classesApi, apiErrorMessage } from '../../api/endpoints';
import type { LessonInput } from '../../api/endpoints';
import { usePermissions } from '../../hooks/usePermissions';
import { toast } from '../../store/toastStore';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import ActionModal from '../../components/ui/ActionModal';

type LessonForm = {
  classId: string;
  subjectId: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
};

const emptyLessonForm: LessonForm = {
  classId: '',
  subjectId: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  startTime: '08:00',
  endTime: '08:45',
  room: '',
};

export default function TimetablePage() {
  const { canManageTimetable } = usePermissions();
  const queryClient = useQueryClient();

  const [weekOffset, setWeekOffset] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<LessonForm>(emptyLessonForm);
  const [cancelState, setCancelState] = useState<Lesson | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteState, setDeleteState] = useState<Lesson | null>(null);

  // Woche berechnen (Montag – Sonntag), abhängig vom Offset.
  const weekStart = useMemo(
    () => startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 }),
    [weekOffset]
  );
  const weekEndDate = useMemo(() => endOfWeek(weekStart, { weekStartsOn: 1 }), [weekStart]);
  const dateFrom = format(weekStart, 'yyyy-MM-dd');
  const dateTo = format(weekEndDate, 'yyyy-MM-dd');
  const rangeLabel = `${format(weekStart, 'd. MMM', { locale: de })} – ${format(weekEndDate, 'd. MMM yyyy', { locale: de })}`;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['lessons', dateFrom, dateTo],
    queryFn: () => lessonsApi.list({ dateFrom, dateTo }),
  });

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: classesApi.list,
    enabled: canManageTimetable && createOpen,
  });

  const { data: subjects } = useQuery({
    queryKey: ['class-subjects', form.classId],
    queryFn: () => classesApi.subjects(form.classId),
    enabled: canManageTimetable && createOpen && !!form.classId,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['lessons'] });

  const createMutation = useMutation({
    mutationFn: (body: LessonInput) => lessonsApi.create(body),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      toast.success('Lektion angelegt.');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Anlegen fehlgeschlagen.')),
  });

  const cancelMutation = useMutation({
    mutationFn: (payload: { id: string; reason: string }) => lessonsApi.cancel(payload.id, payload.reason),
    onSuccess: () => {
      invalidate();
      setCancelState(null);
      setCancelReason('');
      toast.success('Lektion abgesagt.');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Absage fehlgeschlagen.')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => lessonsApi.remove(id),
    onSuccess: () => {
      invalidate();
      setDeleteState(null);
      toast.success('Lektion gelöscht.');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Löschen fehlgeschlagen.')),
  });

  const openCreate = () => {
    setForm(emptyLessonForm);
    setCreateOpen(true);
  };

  const submitCreate = () => {
    if (!form.subjectId) {
      toast.error('Bitte Klasse und Fach wählen.');
      return;
    }
    if (!form.date || !form.startTime || !form.endTime) {
      toast.error('Bitte Datum, Start- und Endzeit ausfüllen.');
      return;
    }
    if (form.startTime >= form.endTime) {
      toast.error('Die Startzeit muss vor der Endzeit liegen.');
      return;
    }
    createMutation.mutate({
      subjectId: form.subjectId,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      room: form.room.trim() ? form.room.trim() : null,
    });
  };

  const submitCancel = () => {
    if (!cancelState) return;
    if (!cancelReason.trim()) {
      toast.error('Bitte einen Grund für die Absage angeben.');
      return;
    }
    cancelMutation.mutate({ id: cancelState.id, reason: cancelReason.trim() });
  };

  // Lektionen nach Tag gruppieren und chronologisch sortieren.
  const groupedByDay = useMemo(() => {
    const map = new Map<string, Lesson[]>();
    const sorted = [...(data ?? [])].sort((a, b) => {
      const dayCompare = a.date.slice(0, 10).localeCompare(b.date.slice(0, 10));
      return dayCompare !== 0 ? dayCompare : a.startTime.localeCompare(b.startTime);
    });
    for (const lesson of sorted) {
      const key = lesson.date.slice(0, 10);
      const bucket = map.get(key);
      if (bucket) bucket.push(lesson);
      else map.set(key, [lesson]);
    }
    return Array.from(map.entries());
  }, [data]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Planung"
        title="Stundenplan"
        description={`${data?.length ?? 0} Lektionen in der Woche vom ${rangeLabel}. Zeitfenster, Raum und Ausfallstatus im Überblick.`}
        actions={
          <>
            <Link to="/timetable/print" className="btn-secondary">
              <Printer className="h-4 w-4" />
              Druckvorlage
            </Link>
            {canManageTimetable && (
              <button type="button" className="btn-primary" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Neue Lektion
              </button>
            )}
          </>
        }
      />

      <div className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o - 1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            title="Vorherige Woche"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
              weekOffset === 0
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Heute
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o + 1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            title="Nächste Woche"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
          <CalendarDays className="h-4 w-4 text-slate-400" />
          {rangeLabel}
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-red border-t-transparent" />
          </div>
        )}

        {isError && (
          <div className="px-6 py-14 text-center text-red-600">Fehler beim Laden der Lektionen.</div>
        )}

        {!isLoading && !isError && data?.length === 0 && (
          <div className="p-6">
            <EmptyState
              icon={<CalendarDays className="h-6 w-6" />}
              title="Keine Lektionen in dieser Woche"
              description="Wähle eine andere Woche oder lege eine neue Lektion an."
              action={
                canManageTimetable ? (
                  <button type="button" className="btn-primary" onClick={openCreate}>
                    <Plus className="h-4 w-4" />
                    Lektion anlegen
                  </button>
                ) : null
              }
            />
          </div>
        )}

        {!isLoading && !isError && data && data.length > 0 &&
          groupedByDay.map(([day, lessons]) => (
            <div key={day}>
              <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {format(parseISO(day), 'EEEE, d. MMMM yyyy', { locale: de })}
              </div>
              {lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className={`flex flex-col gap-3 border-b border-slate-100 p-5 last:border-0 md:flex-row md:items-center md:justify-between ${
                    lesson.isCancelled ? 'bg-slate-50/80 opacity-70' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{lesson.subject?.name ?? 'Lektion'}</span>
                      {lesson.subject?.class?.name && (
                        <span className="text-xs text-slate-400">· {lesson.subject.class.name}</span>
                      )}
                      {lesson.isCancelled && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          Ausgefallen
                        </span>
                      )}
                    </div>
                    {lesson.isCancelled && lesson.cancelReason && (
                      <p className="mt-1 text-xs text-rose-500">Grund: {lesson.cancelReason}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 md:justify-end">
                    <span className="inline-flex items-center gap-2 font-mono">
                      <Clock3 className="h-4 w-4 text-slate-400" />
                      {lesson.startTime} – {lesson.endTime}
                    </span>
                    {lesson.room && (
                      <span className="inline-flex items-center gap-2 text-xs text-slate-400">
                        <MapPin className="h-4 w-4" />
                        Raum {lesson.room}
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      {!lesson.isCancelled && (
                        <button
                          type="button"
                          onClick={() => {
                            setCancelState(lesson);
                            setCancelReason('');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                          title="Lektion absagen"
                        >
                          <Ban className="h-4 w-4" />
                          Absagen
                        </button>
                      )}
                      {canManageTimetable && (
                        <button
                          type="button"
                          onClick={() => setDeleteState(lesson)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                          title="Lektion löschen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
      </div>

      {/* Neue Lektion anlegen */}
      <ActionModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Neue Lektion anlegen"
        description="Wähle Klasse und Fach, lege Datum und Zeitfenster fest. Raum ist optional."
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>
              Abbrechen
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={submitCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Speichern...' : 'Lektion anlegen'}
            </button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Klasse *</label>
            <select
              className="input-modern"
              value={form.classId}
              onChange={(e) => setForm((p) => ({ ...p, classId: e.target.value, subjectId: '' }))}
            >
              <option value="">— wählen —</option>
              {(classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.schoolYear})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Fach *</label>
            <select
              className="input-modern"
              value={form.subjectId}
              onChange={(e) => setForm((p) => ({ ...p, subjectId: e.target.value }))}
              disabled={!form.classId}
            >
              <option value="">{form.classId ? '— wählen —' : 'Zuerst Klasse wählen'}</option>
              {(subjects ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Datum *</label>
            <input
              type="date"
              className="input-modern"
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Startzeit *</label>
            <input
              type="time"
              className="input-modern"
              value={form.startTime}
              onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Endzeit *</label>
            <input
              type="time"
              className="input-modern"
              value={form.endTime}
              onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Raum</label>
            <input
              type="text"
              className="input-modern"
              value={form.room}
              onChange={(e) => setForm((p) => ({ ...p, room: e.target.value }))}
              placeholder="z.B. B204"
            />
          </div>
        </div>
      </ActionModal>

      {/* Lektion absagen */}
      <ActionModal
        open={cancelState !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCancelState(null);
            setCancelReason('');
          }
        }}
        title="Lektion absagen"
        description="Die Lektion wird als ausgefallen markiert. Bitte einen Grund angeben."
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setCancelState(null);
                setCancelReason('');
              }}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={submitCancel}
              disabled={cancelMutation.isPending || !cancelReason.trim()}
            >
              {cancelMutation.isPending ? 'Wird abgesagt...' : 'Lektion absagen'}
            </button>
          </>
        }
      >
        <div>
          {cancelState && (
            <p className="mb-3 text-sm text-slate-500">
              {cancelState.subject?.name ?? 'Lektion'} am{' '}
              {format(parseISO(cancelState.date.slice(0, 10)), 'd. MMMM yyyy', { locale: de })} ({cancelState.startTime} – {cancelState.endTime})
            </p>
          )}
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Grund *</label>
          <textarea
            className="input-modern"
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="z.B. Krankheit der Lehrperson"
          />
        </div>
      </ActionModal>

      {/* Lektion löschen */}
      <ActionModal
        open={deleteState !== null}
        onOpenChange={(open) => !open && setDeleteState(null)}
        title="Lektion löschen"
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setDeleteState(null)}>
              Abbrechen
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => deleteState && deleteMutation.mutate(deleteState.id)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
              {deleteMutation.isPending ? 'Wird gelöscht...' : 'Endgültig löschen'}
            </button>
          </>
        }
      >
        {deleteState && (
          <p className="text-sm text-slate-600">
            Möchtest du die Lektion{' '}
            <span className="font-semibold text-slate-900">{deleteState.subject?.name ?? 'Lektion'}</span> am{' '}
            {format(parseISO(deleteState.date.slice(0, 10)), 'd. MMMM yyyy', { locale: de })} wirklich löschen?
          </p>
        )}
      </ActionModal>
    </div>
  );
}
