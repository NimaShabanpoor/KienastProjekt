// Dashboard-Seite
// Übersicht je nach Rolle: Lehrperson vs. Abteilungsleitung

import type { ComponentType } from 'react';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import {
  ArrowRight,
  AlertTriangle,
  BarChart2,
  BookOpen,
  CalendarDays,
  GraduationCap,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';

interface QuickActionCard {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title={`Guten Tag, ${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()}
        description={`Du bist als ${isAdmin ? 'Abteilungsleitung' : 'Lehrperson'} angemeldet. Nutze die Schnellaktionen, um direkt in deine wichtigsten Arbeitsbereiche zu springen.`}
        actions={
          <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            {user?.totpEnabled ? '2FA aktiv' : '2FA optional'}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="stat-card">
          <p className="text-sm text-slate-500">Rolle</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {isAdmin ? 'Abteilungsleitung' : 'Lehrperson'}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-slate-500">Verfügbare Bereiche</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{actions.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-slate-500">Schule</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">IT Bénédict Zürich</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {actions.map((action) => (
          <Link
            key={action.href}
            to={action.href}
            className="group surface-card block overflow-hidden p-6 transition hover:-translate-y-1"
          >
            <div className="flex items-start justify-between gap-4">
              <div className={`inline-flex rounded-2xl p-3 ${action.color}`}>
                <action.icon className="h-5 w-5" />
              </div>
              <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-brand-red" />
            </div>
            <h3 className="mt-8 text-lg font-semibold text-slate-950 transition-colors group-hover:text-brand-red">
              {action.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">{action.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
