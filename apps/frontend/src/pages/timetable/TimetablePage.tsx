// Stundenplan-Seite (Leiter)

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import type { Lesson, Class, Subject } from '@schuladmin/shared';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function TimetablePage() {
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [subjectId, setSubjectId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('08:45');
  const [lessonCount, setLessonCount] = useState(1);
  const [room, setRoom] = useState('');
  const [isTest, setIsTest] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');
  const weekEnd = format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

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

  const { data, isLoading } = useQuery({
    queryKey: ['lessons', today, weekEnd, classId],
    queryFn: async () => {
      const params = new URLSearchParams({ dateFrom: today, dateTo: weekEnd });
      if (classId) params.set('classId', classId);
      const { data } = await apiClient.get<{ data: Lesson[] }>(`/api/v1/lessons?${params}`);
      return data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/api/v1/lessons', {
        subjectId,
        date,
        startTime,
        endTime,
        room: room || null,
        isTest,
        lessonCount,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lessons'] });
      setShowForm(false);
      setLessonCount(1);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/v1/lessons/${id}`);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['lessons'] }),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/api/v1/lessons/${id}/cancel`, { reason: 'Ausgefallen' });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['lessons'] }),
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-6 h-6 text-brand-red" />
          <h1 className="text-2xl font-bold text-neutral-900">Stundenplan</h1>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-brand-red text-white px-4 py-2 rounded-lg text-sm">
          <Plus className="w-4 h-4" /> Lektion hinzufügen
        </button>
      </div>

      <div className="mb-4">
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className="px-3 py-2 border border-neutral-300 rounded-lg text-sm">
          <option value="">Alle Klassen</option>
          {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
          className="bg-white rounded-xl border border-neutral-200 p-5 mb-6 space-y-4"
        >
          <h2 className="font-semibold">Neue Lektion</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <select required value={classId} onChange={(e) => { setClassId(e.target.value); setSubjectId(''); }} className="px-3 py-2 border rounded-lg text-sm">
              <option value="">Klasse</option>
              {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select required value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" disabled={!classId}>
              <option value="">Fach</option>
              {subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Start (1. Lektion)</label>
              <input required type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Ende (1. Lektion)</label>
              <input required type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Anzahl Lektionen</label>
              <input
                required
                type="number"
                min={1}
                max={8}
                value={lessonCount}
                onChange={(e) => setLessonCount(Math.min(8, Math.max(1, Number(e.target.value) || 1)))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Raum" className="px-3 py-2 border rounded-lg text-sm" />
            <label className="flex items-center gap-2 text-sm text-neutral-700 px-1">
              <input type="checkbox" checked={isTest} onChange={(e) => setIsTest(e.target.checked)} className="rounded" />
              Test / Prüfung (Arztzeugnis bei Absenz)
            </label>
          </div>
          {lessonCount > 1 && (
            <p className="text-xs text-neutral-500">
              Es werden {lessonCount} aufeinanderfolgende Lektionen angelegt (je mit der Dauer von Start bis Ende).
            </p>
          )}
          <button type="submit" disabled={createMutation.isPending} className="bg-brand-red text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
            {lessonCount > 1 ? `${lessonCount} Lektionen erstellen` : 'Lektion erstellen'}
          </button>
          {createMutation.isError && (
            <p className="text-sm text-red-600">Erstellen fehlgeschlagen. Zeitkonflikt oder ungültige Angaben prüfen.</p>
          )}
        </form>
      )}

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        {isLoading && <div className="p-8 text-center text-neutral-400">Laden...</div>}
        {!isLoading && !data?.length && (
          <div className="p-8 text-center text-neutral-400">Keine Lektionen in dieser Woche.</div>
        )}
        {data?.map((lesson) => (
          <div key={lesson.id} className={`flex items-center justify-between p-4 border-b border-neutral-100 last:border-0 ${lesson.isCancelled ? 'opacity-50 bg-neutral-50' : ''}`}>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-neutral-900">{lesson.subject?.name}</span>
                {lesson.isTest && (
                  <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">TEST</span>
                )}
              </div>
              {lesson.subject?.class && <span className="text-xs text-neutral-400 ml-2">{lesson.subject.class.name}</span>}
              {lesson.isCancelled && <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Ausgefallen</span>}
              <p className="text-sm text-neutral-500">{format(new Date(lesson.date), 'EEEE, d. MMMM yyyy', { locale: de })}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-sm font-mono text-neutral-700">{lesson.startTime} – {lesson.endTime}</span>
                {lesson.room && <p className="text-xs text-neutral-400">Raum: {lesson.room}</p>}
              </div>
              {!lesson.isCancelled && (
                <button onClick={() => cancelMutation.mutate(lesson.id)} className="text-xs text-amber-600 font-medium">Ausfall</button>
              )}
              <button onClick={() => deleteMutation.mutate(lesson.id)} className="text-neutral-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
