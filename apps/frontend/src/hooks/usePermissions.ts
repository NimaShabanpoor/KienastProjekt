// Berechtigungs-Hook
// HINWEIS: Frontend-Guards sind nur UX – Sicherheit wird serverseitig erzwungen!

import { useAuthStore } from '../store/authStore';
import { Role } from '@schuladmin/shared';

export function usePermissions() {
  const { user } = useAuthStore();

  return {
    // Rolle
    isAdmin: user?.role === Role.ABTEILUNGSLEITUNG,
    isTeacher: user?.role === Role.LEHRPERSON,
    role: user?.role,

    // Berechtigungen
    canEditGrades: user?.role === Role.ABTEILUNGSLEITUNG,       // Nur Korrekturen
    canManageStudents: user?.role === Role.ABTEILUNGSLEITUNG,
    canManageClasses: user?.role === Role.ABTEILUNGSLEITUNG,
    canManageUsers: user?.role === Role.ABTEILUNGSLEITUNG,
    canExport: user?.role === Role.ABTEILUNGSLEITUNG,
    canViewAuditLog: user?.role === Role.ABTEILUNGSLEITUNG,
    canViewAllStudents: user?.role === Role.ABTEILUNGSLEITUNG,
    canManageTimetable: user?.role === Role.ABTEILUNGSLEITUNG,
  };
}
