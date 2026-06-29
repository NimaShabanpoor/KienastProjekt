// Berechtigungs-Hook
// HINWEIS: Frontend-Guards sind nur UX – Sicherheit wird serverseitig erzwungen!

import { useAuthStore } from '../store/authStore';
import { Role } from '@schuladmin/shared';

export function usePermissions() {
  const { user } = useAuthStore();
  const isLeader = user?.role === Role.ABTEILUNGSLEITUNG;
  const isTeacher = user?.role === Role.LEHRPERSON;

  return {
    isLeader,
    isAdmin: isLeader, // Alias für bestehenden Code
    isTeacher,
    role: user?.role,

    // Lehrer: nur Anwesenheit erfassen, Schülerliste der eigenen Klasse
    canRecordAbsences: isTeacher || isLeader,

    // Leiter: Verwaltung
    canExcuseAbsences: isLeader,
    canManageGrades: isLeader,
    canEditGrades: isLeader,
    canManageStudents: isLeader,
    canManageClasses: isLeader,
    canManageUsers: isLeader,
    canExport: isLeader,
    canViewAuditLog: isLeader,
    canViewAllStudents: isLeader,
    canManageTimetable: isLeader,
    canViewAbsenceStats: isLeader,
  };
}
