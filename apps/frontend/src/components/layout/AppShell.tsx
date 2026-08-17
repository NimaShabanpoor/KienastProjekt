import type { ComponentType } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarDays,
  Download,
  GraduationCap,
  Layers,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { useLogout } from '../../hooks/useAuth';
import { useAuthStore } from '../../store/authStore';
import Toaster from '../ui/Toaster';

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

const navigationItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/students', label: 'Schüler', icon: Users },
  { to: '/classes', label: 'Klassen', icon: BookOpen, adminOnly: true },
  { to: '/subjects', label: 'Module', icon: Layers },
  { to: '/timetable', label: 'Stundenplan', icon: CalendarDays },
  { to: '/absences', label: 'Absenzen', icon: AlertTriangle },
  { to: '/grades', label: 'Noten', icon: GraduationCap },
  { to: '/absences/stats', label: 'Statistiken', icon: BarChart3 },
  { to: '/users', label: 'Benutzer', icon: ShieldCheck, adminOnly: true },
  { to: '/exports', label: 'Exporte', icon: Download, adminOnly: true },
];

export default function AppShell() {
  const { user } = useAuthStore();
  const { isAdmin } = usePermissions();
  const logoutMutation = useLogout();

  const visibleItems = navigationItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-app-gradient text-slate-900">
      <Toaster />
      <div className="mx-auto flex min-h-screen max-w-7xl gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-4 overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-6 shadow-soft backdrop-blur">
            <div className="mb-8">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-red text-white shadow-lg shadow-red-200">
                <BookOpen className="h-6 w-6" />
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-brand-red">SchulAdmin</p>
                <h1 className="text-xl font-semibold text-slate-900">IT Bénédict Zürich</h1>
              </div>
            </div>

            <nav className="space-y-2">
              {visibleItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="mt-8 rounded-2xl bg-slate-950 px-4 py-4 text-white">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Angemeldet als</p>
              <p className="mt-2 font-semibold">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-sm text-slate-300">{user?.email}</p>
              <button
                type="button"
                onClick={() => logoutMutation.mutate()}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={logoutMutation.isPending}
              >
                <LogOut className="h-4 w-4" />
                Abmelden
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="overflow-hidden rounded-3xl border border-white/70 bg-white/85 px-5 py-4 shadow-soft backdrop-blur lg:hidden">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-brand-red">SchulAdmin</p>
                <p className="text-sm text-slate-500">
                  {user?.firstName} {user?.lastName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => logoutMutation.mutate()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <LogOut className="h-4 w-4" />
                Abmelden
              </button>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {visibleItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                    }`
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </header>

          <main className="min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
