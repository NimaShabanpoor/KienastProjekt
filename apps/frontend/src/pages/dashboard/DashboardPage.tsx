// Dashboard-Seite
// Übersicht je nach Rolle: Lehrer vs. Leiter

import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import { ROLE_LABELS } from '@schuladmin/shared';
import { Users, BookOpen, AlertTriangle, BarChart2, CalendarDays, GraduationCap, CheckCircle2, UserCog } from 'lucide-react';
import { Link } from 'react-router-dom';

interface QuickActionCard {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: string;
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
      color: 'bg-orange-50 text-orange-600',
    },
    {
      title: 'Noten eintragen',
      description: 'Testtitel vergeben und Noten der Schüler erfassen',
      icon: GraduationCap,
      href: '/grades',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Schülerliste',
      description: 'Schüler meiner Klasse anzeigen',
      icon: Users,
      href: '/students',
      color: 'bg-purple-50 text-purple-600',
    },
  ];

  const leaderActions: QuickActionCard[] = [
    {
      title: 'Absenzen entschuldigen',
      description: 'Unentschuldigte Absenzen bearbeiten',
      icon: CheckCircle2,
      href: '/absences/excuse',
      color: 'bg-yellow-50 text-yellow-600',
    },
    {
      title: 'Noten korrigieren',
      description: 'Eingetragene Noten prüfen und korrigieren',
      icon: GraduationCap,
      href: '/grades',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Schüler verwalten',
      description: 'Schülerinnen und Schüler hinzufügen',
      icon: Users,
      href: '/students',
      color: 'bg-purple-50 text-purple-600',
    },
    {
      title: 'Klassen verwalten',
      description: 'Klassen anlegen und Lehrer zuweisen',
      icon: BookOpen,
      href: '/classes',
      color: 'bg-indigo-50 text-indigo-600',
    },
    {
      title: 'Stundenplan',
      description: 'Lektionen und Stundenplan pflegen',
      icon: CalendarDays,
      href: '/timetable',
      color: 'bg-green-50 text-green-600',
    },
    {
      title: 'Benutzer verwalten',
      description: 'Lehrer und Leiter anlegen',
      icon: UserCog,
      href: '/users',
      color: 'bg-rose-50 text-rose-600',
    },
    {
      title: 'Statistiken & Export',
      description: 'Berichte und Absenzen-Statistiken',
      icon: BarChart2,
      href: '/exports',
      color: 'bg-teal-50 text-teal-600',
    },
  ];

  const actions = isLeader ? leaderActions : teacherActions;
  const roleLabel = user?.role ? ROLE_LABELS[user.role] : '';

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">
          Guten Tag, {user?.firstName} {user?.lastName}
        </h1>
        <p className="text-neutral-500 mt-1">
          {roleLabel} – IT Bénédict Zürich
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {actions.map((action) => (
          <Link
            key={action.href}
            to={action.href}
            className="block bg-white rounded-xl border border-neutral-200 p-5 hover:shadow-md hover:border-brand-red transition-all group"
          >
            <div className={`inline-flex p-3 rounded-xl mb-3 ${action.color}`}>
              <action.icon className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-neutral-900 group-hover:text-brand-red transition-colors">
              {action.title}
            </h3>
            <p className="text-sm text-neutral-500 mt-1">{action.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
