// App-Shell: ausklappbare Sidebar + Topbar

import { Link, Outlet, useLocation } from 'react-router-dom';
import { Suspense, useEffect, type ComponentType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { useUiStore } from '../store/uiStore';
import { usePermissions } from '../hooks/usePermissions';
import { useLogout } from '../hooks/useAuth';
import { ROLE_LABELS, AbsenceStatus } from '@schuladmin/shared';
import type { Absence } from '@schuladmin/shared';
import { apiClient } from '../api/client';
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Download,
  GraduationCap,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  UserCog,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import Toaster from './ui/Toaster';

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge?: 'unexcused';
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const LEADER_NAV: NavGroup[] = [
  {
    label: 'Übersicht',
    items: [{ href: '/', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Personen',
    items: [
      { href: '/students', label: 'Schüler', icon: Users },
      { href: '/classes', label: 'Klassen', icon: BookOpen },
      { href: '/users', label: 'Benutzer', icon: UserCog },
    ],
  },
  {
    label: 'Unterricht',
    items: [
      { href: '/subjects', label: 'Module', icon: Layers },
      { href: '/timetable', label: 'Stundenplan', icon: CalendarDays },
      { href: '/grades', label: 'Noten', icon: GraduationCap },
      { href: '/absences/excuse', label: 'Entschuldigen', icon: CheckCircle2, badge: 'unexcused' },
    ],
  },
  {
    label: 'Berichte',
    items: [{ href: '/exports', label: 'Exporte', icon: Download }],
  },
];

const TEACHER_NAV: NavGroup[] = [
  {
    label: 'Übersicht',
    items: [{ href: '/', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Unterricht',
    items: [
      { href: '/absences', label: 'Anwesenheit', icon: AlertTriangle },
      { href: '/grades', label: 'Noten', icon: GraduationCap },
      { href: '/subjects', label: 'Module', icon: Layers },
    ],
  },
  {
    label: 'Personen',
    items: [{ href: '/students', label: 'Schüler', icon: Users }],
  },
];

function pathIsActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  if (href === '/absences') return pathname === '/absences';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function currentPageLabel(groups: NavGroup[], pathname: string): string {
  if (pathname === '/profile') return 'Profil';
  const items = groups.flatMap((g) => g.items);
  const match = items
    .filter((item) => pathIsActive(item.href, pathname))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? 'SchulAdmin';
}

function BrandMark({ collapsed }: { collapsed: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-3 min-w-0 px-1">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-red text-sm font-semibold text-white">
        S
      </span>
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-neutral-900">SchulAdmin</span>
          <span className="block truncate text-[11px] text-neutral-500">IT Bénédict</span>
        </span>
      )}
    </Link>
  );
}

function SidebarNav({
  groups,
  collapsed,
  pathname,
  hasOpenAbsences,
  onNavigate,
}: {
  groups: NavGroup[];
  collapsed: boolean;
  pathname: string;
  hasOpenAbsences: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
      {groups.map((group) => (
        <div key={group.label}>
          {!collapsed && (
            <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              {group.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = pathIsActive(item.href, pathname);
              return (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    title={collapsed ? item.label : undefined}
                    onClick={onNavigate}
                    className={[
                      'group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                      collapsed ? 'justify-center' : '',
                      active
                        ? 'bg-brand-red-light text-brand-red'
                        : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                    ].join(' ')}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand-red" />
                    )}
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {!collapsed && item.badge === 'unexcused' && hasOpenAbsences && (
                      <AlertCircle className="h-4 w-4 shrink-0 text-brand-red" aria-label="Offene Absenzen" />
                    )}
                    {collapsed && item.badge === 'unexcused' && hasOpenAbsences && (
                      <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand-red" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export default function AppShell() {
  const { user } = useAuthStore();
  const { isLeader } = usePermissions();
  const location = useLocation();
  const logoutMutation = useLogout();
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);

  const groups = isLeader ? LEADER_NAV : TEACHER_NAV;
  const roleLabel = user?.role ? ROLE_LABELS[user.role] : '';
  const pageLabel = currentPageLabel(groups, location.pathname);

  const { data: unexcusedCount } = useQuery({
    queryKey: ['unexcused-absence-count'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Absence[] }>(
        `/api/v1/absences?status=${AbsenceStatus.UNENTSCHULDIGT}&unreviewed=true`
      );
      return data.data.length;
    },
    enabled: isLeader,
    refetchInterval: 60_000,
  });

  const hasOpenAbsences = (unexcusedCount ?? 0) > 0;

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname, setMobileNavOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileNavOpen, setMobileNavOpen]);

  const sidebarInner = (collapsed: boolean, onNavigate?: () => void) => (
    <>
      <div className={`flex h-16 shrink-0 items-center ${collapsed ? 'justify-center px-2' : 'px-3'}`}>
        <BrandMark collapsed={collapsed} />
      </div>
      <SidebarNav
        groups={groups}
        collapsed={collapsed}
        pathname={location.pathname}
        hasOpenAbsences={hasOpenAbsences}
        onNavigate={onNavigate}
      />
      <div className="shrink-0 border-t border-neutral-200 p-2">
        <Link
          to="/profile"
          onClick={onNavigate}
          title={collapsed ? 'Profil' : undefined}
          className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors ${
            location.pathname === '/profile'
              ? 'bg-brand-red-light text-brand-red'
              : 'text-neutral-600 hover:bg-neutral-100'
          } ${collapsed ? 'justify-center' : ''}`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
            <UserRound className="h-4 w-4" />
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-neutral-900">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="block truncate text-[11px] text-neutral-500">{roleLabel}</span>
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={() => logoutMutation.mutate()}
          title={collapsed ? 'Abmelden' : undefined}
          disabled={logoutMutation.isPending}
          className={`mt-0.5 flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50 ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && (logoutMutation.isPending ? 'Abmelden…' : 'Abmelden')}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-[#f7f8fa] print:bg-white">
      <Toaster />

      {/* Desktop-Sidebar */}
      <aside
        className={`print:hidden sticky top-0 hidden h-screen min-h-0 shrink-0 flex-col overflow-hidden border-r border-neutral-200 bg-white transition-[width] duration-200 ease-out lg:flex ${
          sidebarCollapsed ? 'w-[72px]' : 'w-[248px]'
        }`}
      >
        {sidebarInner(sidebarCollapsed)}
      </aside>

      {/* Mobile-Drawer */}
      {mobileNavOpen && (
        <div className="print:hidden fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-neutral-900/40"
            aria-label="Menü schliessen"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative flex h-full w-[260px] flex-col bg-white shadow-xl">
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100"
              aria-label="Schliessen"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebarInner(false, () => setMobileNavOpen(false))}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="print:hidden sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 backdrop-blur-sm lg:px-6">
          <button
            type="button"
            className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 lg:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Menü öffnen"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="hidden rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 lg:inline-flex"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
            title={sidebarCollapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
          >
            <ChevronLeft
              className={`h-5 w-5 transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''}`}
            />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-neutral-900">{pageLabel}</p>
            <p className="hidden truncate text-xs text-neutral-500 sm:block">IT Bénédict Zürich</p>
          </div>
          <Link
            to="/profile"
            className={`hidden items-center gap-2.5 rounded-lg px-2 py-1.5 sm:flex ${
              location.pathname === '/profile' ? 'bg-brand-red-light text-brand-red' : 'hover:bg-neutral-100'
            }`}
          >
            <span className="text-right">
              <span className="block text-sm font-medium leading-tight text-neutral-900">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="block text-xs leading-tight text-neutral-500">{roleLabel}</span>
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 text-neutral-600">
              <UserRound className="h-4 w-4" />
            </span>
          </Link>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 print:px-0 print:py-0">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-16 text-sm text-neutral-400">Laden…</div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
