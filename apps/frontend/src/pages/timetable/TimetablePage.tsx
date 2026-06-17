// Stundenplan-Seite

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import type { Lesson } from '@schuladmin/shared';
import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function TimetablePage() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const weekEnd = format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
    queryKey: ['lessons', today, weekEnd],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Lesson[] }>(
        `/api/v1/lessons?dateFrom=${today}&dateTo=${weekEnd}`
      );
      return data.data;
    },
  });

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <CalendarDays className="w-6 h-6 text-brand-red" />
        <h1 className="text-2xl font-bold text-neutral-900">Stundenplan</h1>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        {isLoading && <div className="p-8 text-center text-neutral-400">Laden...</div>}
        {!isLoading && !data?.length && (
          <div className="p-8 text-center">
            <CalendarDays className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-400">Keine Lektionen in dieser Woche.</p>
          </div>
        )}
        {data?.map((lesson) => (
          <div
            key={lesson.id}
            className={`flex items-center justify-between p-4 border-b border-neutral-100 last:border-0 ${
              lesson.isCancelled ? 'opacity-50 bg-neutral-50' : ''
            }`}
          >
            <div>
              <span className="font-medium text-neutral-900">{lesson.subject?.name}</span>
              {lesson.isCancelled && (
                <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Ausgefallen</span>
              )}
              <p className="text-sm text-neutral-500">
                {format(new Date(lesson.date), 'EEEE, d. MMMM yyyy', { locale: de })}
              </p>
            </div>
            <div className="text-right">
              <span className="text-sm font-mono text-neutral-700">
                {lesson.startTime} – {lesson.endTime}
              </span>
              {lesson.room && <p className="text-xs text-neutral-400">Raum: {lesson.room}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
