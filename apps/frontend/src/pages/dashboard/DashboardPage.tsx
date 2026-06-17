// Dashboard-Seite
// Übersicht je nach Rolle: Lehrperson vs. Abteilungsleitung

import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import { Users, BookOpen, AlertTriangle, BarChart2, CalendarDays, GraduationCap } from 'lucide-react';
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
  const { isAdmin } = usePermissions();

  const teacherActions: QuickActionCard[] = [
    {
      title: 'Absenzen erfassen',
      description: 'Präsenz für meine heutigen Lektionen eintragen',
      icon: AlertTriangle,
      href: '/absences',
      color: 'bg-orange-50 text-orange-600',
    },
    {
      title: 'Noten eintragen',
      description: 'Prüfungs- und Hausaufgabennoten eintragen',
      icon: GraduationCap,
      href: '/grades',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Stundenplan',
      description: 'Meine Lektionen übersicht',
      icon: CalendarDays,
      href: '/timetable',
      color: 'bg-green-50 text-green-600',
    },
    {
      title: 'Schülerliste',
      description: 'Schüler meiner Klassen anzeigen',
      icon: Users,
      href: '/students',
      color: 'bg-purple-50 text-purple-600',
    },
  ];

  const adminActions: QuickActionCard[] = [
    ...teacherActions,
    {
      title: 'Klassen verwalten',
      description: 'Klassen, Fächer und Zuteilungen',
      icon: BookOpen,
      href: '/classes',
      color: 'bg-indigo-50 text-indigo-600',
    },
    {
      title: 'Statistiken & Export',
      description: 'Berichte, Zeugnisse, Absenzen-Statistiken',
      icon: BarChart2,
      href: '/exports',
      color: 'bg-teal-50 text-teal-600',
    },
  ];

  const actions = isAdmin ? adminActions : teacherActions;

  return (
    <div className="p-6">
      {/* Begrüssung */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">
          Guten Tag, {user?.firstName} {user?.lastName}
        </h1>
        <p className="text-neutral-500 mt-1">
          {isAdmin ? 'Abteilungsleitung' : 'Lehrperson'} – IT Bénédict Zürich
        </p>
      </div>

      {/* Quick-Actions */}
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
