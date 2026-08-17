// React Router v6 – Alle Routen + ProtectedRoute Wrapper

import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { Role } from '@schuladmin/shared/types/roles';
import type { ReactNode } from 'react';
import AppShell from './components/AppShell';

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
const AbsenceExcusePage = lazy(() => import('./pages/absences/AbsenceExcusePage'));
const GradesPage = lazy(() => import('./pages/grades/GradesPage'));
const UsersPage = lazy(() => import('./pages/users/UsersPage'));
const ExportsPage = lazy(() => import('./pages/exports/ExportsPage'));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));
const ZeugnisPrintPage = lazy(() => import('./pages/reports/ZeugnisPrintPage'));

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

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}

const leaderOnly = Role.ABTEILUNGSLEITUNG;

export const router = createBrowserRouter([
  { path: '/login', element: <Suspense fallback={null}><LoginPage /></Suspense> },
  { path: '/2fa', element: <Suspense fallback={null}><TwoFactorPage /></Suspense> },

  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'students', element: <StudentsPage /> },
      { path: 'students/:id', element: <StudentDetailPage /> },
      { path: 'classes', element: <ProtectedRoute requiredRole={leaderOnly}><ClassesPage /></ProtectedRoute> },
      { path: 'subjects', element: <SubjectsPage /> },
      { path: 'timetable', element: <ProtectedRoute requiredRole={leaderOnly}><TimetablePage /></ProtectedRoute> },
      { path: 'timetable/print', element: <TimetablePrintPage /> },
      { path: 'zeugnis', element: <ZeugnisPrintPage /> },
      { path: 'absences', element: <AbsencesPage /> },
      { path: 'absences/excuse', element: <ProtectedRoute requiredRole={leaderOnly}><AbsenceExcusePage /></ProtectedRoute> },
      { path: 'grades', element: <GradesPage /> },
      { path: 'users', element: <ProtectedRoute requiredRole={leaderOnly}><UsersPage /></ProtectedRoute> },
      { path: 'exports', element: <ProtectedRoute requiredRole={leaderOnly}><ExportsPage /></ProtectedRoute> },
      { path: 'profile', element: <ProfilePage /> },
      { path: '403', element: <div className="p-8 text-center"><h1 className="text-2xl font-bold text-red-600">Kein Zugriff</h1><p>Du hast keine Berechtigung für diese Seite.</p></div> },
    ],
  },

  { path: '*', element: <Navigate to="/" replace /> },
]);
