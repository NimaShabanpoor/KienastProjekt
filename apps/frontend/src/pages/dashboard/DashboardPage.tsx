// Dashboard-Seite
// Übersicht je nach Rolle: Lehrer vs. Leiter

import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import { ROLE_LABELS } from '@schuladmin/shared';
import {
  Users,
  BookOpen,
  AlertTriangle,
  BarChart2,
  CalendarDays,
  GraduationCap,
  CheckCircle2,
  UserCog,
  ArrowRight,
  Layers,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface QuickActionCard {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { isLeader } = usePermissions();

  const teacherActions: QuickActionCard[] = [
    {
      title: 'Anwesenheit erfassen',
      description: 'Schüler als anwesend oder abwesend markieren',
      icon: AlertTriangle,
      href: '/absences',
    },
    {
      title: 'Noten eintragen',
      description: 'Tests anlegen und Noten erfassen',
      icon: GraduationCap,
      href: '/grades',
    },
    {
      title: 'Schülerliste',
      description: 'Schüler deiner Klasse anzeigen',
      icon: Users,
      href: '/students',
    },
    {
      title: 'Module',
      description: 'Zugewiesene Fächer und Module',
      icon: Layers,
      href: '/subjects',
    },
  ];

  const leaderActions: QuickActionCard[] = [
    {
      title: 'Absenzen entschuldigen',
      description: 'Offene Absenzen prüfen und bearbeiten',
      icon: CheckCircle2,
      href: '/absences/excuse',
    },
    {
      title: 'Noten',
      description: 'Eingetragene Noten prüfen und korrigieren',
      icon: GraduationCap,
      href: '/grades',
    },
    {
      title: 'Schüler',
      description: 'Schülerinnen und Schüler verwalten',
      icon: Users,
      href: '/students',
    },
    {
      title: 'Klassen',
      description: 'Klassen anlegen und Lehrpersonen zuweisen',
      icon: BookOpen,
      href: '/classes',
    },
    {
      title: 'Stundenplan',
      description: 'Lektionen und Wochenplan pflegen',
      icon: CalendarDays,
      href: '/timetable',
    },
    {
      title: 'Benutzer',
      description: 'Lehrpersonen und Leitung anlegen',
      icon: UserCog,
      href: '/users',
    },
    {
      title: 'Exporte',
      description: 'Berichte und Absenzen-Statistiken',
      icon: BarChart2,
      href: '/exports',
    },
  ];

  const actions = isLeader ? leaderActions : teacherActions;
  const roleLabel = user?.role ? ROLE_LABELS[user.role] : '';

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-red">Übersicht</p>
        <h1 className="page-title mt-1">
          Guten Tag
        </h1>
        <p className="page-desc">
          {roleLabel} · IT Bénédict Zürich
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {actions.map((action) => (
          <Link
            key={action.href}
            to={action.href}
            className="group flex items-start gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-brand-red/30 hover:shadow-soft"
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-red-light text-brand-red">
              <action.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold text-neutral-900 group-hover:text-brand-red">
                  {action.title}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-brand-red" />
              </span>
              <span className="mt-1 block text-sm text-neutral-500">{action.description}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
