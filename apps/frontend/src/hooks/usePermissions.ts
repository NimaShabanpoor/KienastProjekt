// Berechtigungs-Hook
// HINWEIS: Frontend-Guards sind nur UX – Sicherheit wird serverseitig erzwungen!

import { useAuthStore } from '../store/authStore';
import { Role } from '@schuladmin/shared/types/roles';

export function usePermissions() {
  const { user } = useAuthStore();
  const isLeader = user?.role === Role.ABTEILUNGSLEITUNG;
  const isTeacher = user?.role === Role.LEHRPERSON;

  return {
    isLeader,
    isAdmin: isLeader, // Alias für bestehenden Code
    isTeacher,
    role: user?.role,

    // Lehrer: Anwesenheit + Noten für eigene Fächer
    canRecordAbsences: isTeacher || isLeader,
    canEnterGrades: isTeacher,
    canCorrectGrades: isLeader,

    // Leiter: Verwaltung
    canExcuseAbsences: isLeader,
    canManageGrades: isLeader || isTeacher,
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
