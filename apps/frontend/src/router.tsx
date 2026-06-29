// React Router v6 – Alle Routen + ProtectedRoute Wrapper

import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { Role } from '@schuladmin/shared';
import type { ReactNode } from 'react';

// Lazy-Imports für Code-Splitting
import { lazy, Suspense } from 'react';

const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const TwoFactorPage = lazy(() => import('./pages/auth/TwoFactorPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const StudentsPage = lazy(() => import('./pages/students/StudentsPage'));
const StudentDetailPage = lazy(() => import('./pages/students/StudentDetailPage'));
const ClassesPage = lazy(() => import('./pages/classes/ClassesPage'));
const TimetablePage = lazy(() => import('./pages/timetable/TimetablePage'));
const AbsencesPage = lazy(() => import('./pages/absences/AbsencesPage'));
const AbsenceExcusePage = lazy(() => import('./pages/absences/AbsenceExcusePage'));
const GradesPage = lazy(() => import('./pages/grades/GradesPage'));
const ExportsPage = lazy(() => import('./pages/exports/ExportsPage'));

// ProtectedRoute: Weiterleitung wenn nicht authentifiziert
function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: ReactNode;
  requiredRole?: Role;
}) {
  const { accessToken, user } = useAuthStore();

  if (!accessToken) {
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
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Laden...</div>}>
      <Outlet />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  // Öffentliche Routen
  { path: '/login', element: <Suspense fallback={null}><LoginPage /></Suspense> },
  { path: '/2fa', element: <Suspense fallback={null}><TwoFactorPage /></Suspense> },

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
      {
        path: 'timetable',
        element: (
          <ProtectedRoute requiredRole={Role.ABTEILUNGSLEITUNG}>
            <TimetablePage />
          </ProtectedRoute>
        ),
      },
      { path: 'absences', element: <AbsencesPage /> },
      {
        path: 'absences/excuse',
        element: (
          <ProtectedRoute requiredRole={Role.ABTEILUNGSLEITUNG}>
            <AbsenceExcusePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'grades',
        element: (
          <ProtectedRoute requiredRole={Role.ABTEILUNGSLEITUNG}>
            <GradesPage />
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
      { path: '403', element: <div className="p-8 text-center"><h1 className="text-2xl font-bold text-red-600">Kein Zugriff</h1><p>Du hast keine Berechtigung für diese Seite.</p></div> },
    ],
  },

  // Fallback
  { path: '*', element: <Navigate to="/" replace /> },
]);
