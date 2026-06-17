// Rollen im SchulAdmin-System
// Berechtigungsprüfung immer serverseitig – diese Types nur für Typsicherheit

export enum Role {
  LEHRPERSON = 'LEHRPERSON',
  ABTEILUNGSLEITUNG = 'ABTEILUNGSLEITUNG',
}

// Absenzen-Status pro Lektion
export enum AbsenceStatus {
  ANWESEND = 'ANWESEND',
  ENTSCHULDIGT = 'ENTSCHULDIGT',
  UNENTSCHULDIGT = 'UNENTSCHULDIGT',
}

// Entität-Typen für den AuditLog
export enum AuditEntityType {
  USER = 'USER',
  STUDENT = 'STUDENT',
  CLASS = 'CLASS',
  SUBJECT = 'SUBJECT',
  LESSON = 'LESSON',
  ABSENCE = 'ABSENCE',
  GRADE = 'GRADE',
  GRADE_CORRECTION = 'GRADE_CORRECTION',
  TIMETABLE_IMPORT = 'TIMETABLE_IMPORT',
}
