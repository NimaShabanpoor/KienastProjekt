// App-Shell mit Navigation

import { Link, Outlet, useLocation } from 'react-router-dom';
import { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { usePermissions } from '../hooks/usePermissions';
import { ROLE_LABELS, AbsenceStatus } from '@schuladmin/shared';
import type { Absence } from '@schuladmin/shared';
import { apiClient } from '../api/client';
import { LayoutDashboard, LogOut, AlertCircle } from 'lucide-react';

const LEADER_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/students', label: 'Schüler' },
  { href: '/classes', label: 'Klassen' },
  { href: '/absences/excuse', label: 'Entschuldigen' },
  { href: '/grades', label: 'Noten' },
  { href: '/timetable', label: 'Stundenplan' },
  { href: '/users', label: 'Benutzer' },
  { href: '/exports', label: 'Exporte' },
];

const TEACHER_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/absences', label: 'Anwesenheit' },
  { href: '/students', label: 'Schüler' },
];

export default function AppShell() {
  const { user, logout } = useAuthStore();
  const { isLeader } = usePermissions();
  const location = useLocation();
  const links = isLeader ? LEADER_LINKS : TEACHER_LINKS;
  const roleLabel = user?.role ? ROLE_LABELS[user.role] : '';

  const { data: unexcusedCount } = useQuery({
    queryKey: ['unexcused-absence-count'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Absence[] }>(
        `/api/v1/absences?status=${AbsenceStatus.UNENTSCHULDIGT}`
      );
      return data.data.length;
    },
    enabled: isLeader,
    refetchInterval: 60_000,
  });

  const hasOpenAbsences = (unexcusedCount ?? 0) > 0;

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-brand-red shrink-0">
            <LayoutDashboard className="w-5 h-5" />
            SchulAdmin
          </Link>
          <nav className="hidden md:flex items-center gap-1 flex-wrap">
            {links.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === link.href
                    ? 'bg-brand-red-light text-brand-red'
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                {link.label}
                {link.href === '/absences/excuse' && hasOpenAbsences && (
                  <AlertCircle className="w-4 h-4 text-red-500" aria-label="Offene Absenzen" />
                )}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-neutral-900">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-neutral-500">{roleLabel}</p>
            </div>
            <button
              onClick={() => logout()}
              className="p-2 text-neutral-500 hover:text-brand-red rounded-lg hover:bg-neutral-100"
              title="Abmelden"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        <nav className="md:hidden flex gap-1 overflow-x-auto px-4 pb-2">
          {links.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                location.pathname === link.href
                  ? 'bg-brand-red-light text-brand-red'
                  : 'text-neutral-600 bg-white border border-neutral-200'
              }`}
            >
              {link.label}
              {link.href === '/absences/excuse' && hasOpenAbsences && (
                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
              )}
            </Link>
          ))}
        </nav>
      </header>
      <main className="max-w-6xl mx-auto">
        <Suspense fallback={<div className="flex items-center justify-center py-12 text-neutral-400">Laden...</div>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
