// React Router v6 – Alle Routen + ProtectedRoute Wrapper

import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { Role } from '@schuladmin/shared/types/roles';
import type { ReactNode } from 'react';
import AppShell from './components/layout/AppShell';

// Lazy-Imports für Code-Splitting
import { lazy, Suspense } from 'react';

const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const TwoFactorPage = lazy(() => import('./pages/auth/TwoFactorPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const StudentsPage = lazy(() => import('./pages/students/StudentsPage'));
const StudentDetailPage = lazy(() => import('./pages/students/StudentDetailPage'));
const ClassesPage = lazy(() => import('./pages/classes/ClassesPage'));
const SubjectsPage = lazy(() => import('./pages/subjects/SubjectsPage'));
const TimetablePage = lazy(() => import('./pages/timetable/TimetablePage'));
const TimetablePrintPage = lazy(() => import('./pages/timetable/TimetablePrintPage'));
const AbsencesPage = lazy(() => import('./pages/absences/AbsencesPage'));
const AbsenceStatsPage = lazy(() => import('./pages/absences/AbsenceStatsPage'));
const GradesPage = lazy(() => import('./pages/grades/GradesPage'));
const UsersPage = lazy(() => import('./pages/users/UsersPage'));
const ExportsPage = lazy(() => import('./pages/exports/ExportsPage'));
const ZeugnisPrintPage = lazy(() => import('./pages/reports/ZeugnisPrintPage'));

// ProtectedRoute: Weiterleitung wenn nicht authentifiziert
function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: ReactNode;
  requiredRole?: Role;
}) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Rollen-Prüfung (nur UX – Sicherheit ist serverseitig)
  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}

// App-Layout mit Suspense-Fallback
function AppLayout() {
  return (
    <Suspense
      fallback={
        <div className="bg-app-gradient flex min-h-screen items-center justify-center">
          <div className="surface-card px-6 py-5 text-sm font-medium text-slate-600">Ansicht wird geladen...</div>
        </div>
      }
    >
      <AppShell />
    </Suspense>
  );
}

function CenteredAuthPage(children: ReactNode) {
  return (
    <Suspense
      fallback={
        <div className="bg-app-gradient flex min-h-screen items-center justify-center">
          <div className="surface-card px-6 py-5 text-sm font-medium text-slate-600">Authentifizierung wird geladen...</div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  // Öffentliche Routen
  { path: '/login', element: CenteredAuthPage(<LoginPage />) },
  { path: '/2fa', element: CenteredAuthPage(<TwoFactorPage />) },

  // Geschützte Routen
  {
    path: '/',
    element: <ProtectedRoute><AppLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'students', element: <StudentsPage /> },
      { path: 'students/:id', element: <StudentDetailPage /> },
      {
        path: 'classes',
        element: (
          <ProtectedRoute requiredRole={Role.ABTEILUNGSLEITUNG}>
            <ClassesPage />
          </ProtectedRoute>
        ),
      },
      { path: 'subjects', element: <SubjectsPage /> },
      { path: 'timetable', element: <TimetablePage /> },
      { path: 'timetable/print', element: <TimetablePrintPage /> },
      { path: 'zeugnis', element: <ZeugnisPrintPage /> },
      { path: 'absences', element: <AbsencesPage /> },
      { path: 'absences/stats', element: <AbsenceStatsPage /> },
      { path: 'grades', element: <GradesPage /> },
      {
        path: 'users',
        element: (
          <ProtectedRoute requiredRole={Role.ABTEILUNGSLEITUNG}>
            <UsersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'exports',
        element: (
          <ProtectedRoute requiredRole={Role.ABTEILUNGSLEITUNG}>
            <ExportsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '403',
        element: (
          <div className="surface-card p-10 text-center">
            <h1 className="text-2xl font-bold text-red-600">Kein Zugriff</h1>
            <p className="mt-2 text-sm text-slate-500">
              Du hast keine Berechtigung für diese Seite.
            </p>
          </div>
        ),
      },
    ],
  },

  // Fallback
  { path: '*', element: <Navigate to="/" replace /> },
]);
