// TypeScript-Entitäts-Typen für SchulAdmin
// Spiegeln das Prisma-Schema wider (ohne Prisma-Abhängigkeit im Frontend)

import { Role, AbsenceStatus } from './roles';

// Benutzer (Lehrperson oder Abteilungsleitung)
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// Klasse (z.B. INF-2023-A)
export interface Class {
  id: string;
  name: string;
  semester: number;
  schoolYear: string;
  homeroomTeacherId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  homeroomTeacher?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
  _count?: { students: number };
}

// Schüler
export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  classId: string;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  class?: Class;
}

// Fach / Modul (schulweit)
export interface Subject {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  teachers?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>[];
}

// Lektion
export interface Lesson {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  date: string; // ISO-Datum YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  room: string | null;
  isTest: boolean;
  isCancelled: boolean;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  class?: Pick<Class, 'id' | 'name'>;
  teacher?: Pick<User, 'id' | 'firstName' | 'lastName'>;
  subject?: Subject;
}

// Absenz
export interface Absence {
  id: string;
  studentId: string;
  lessonId: string;
  status: AbsenceStatus;
  note: string | null;
  hasMedicalCertificate: boolean | null;
  medicalCertificatePath: string | null;
  medicalCertificateFileName: string | null;
  medicalCertificateUploadedAt: string | null;
  recordedById: string;
  recordedAt: string;
  updatedAt: string;
  student?: Pick<Student, 'id' | 'firstName' | 'lastName'> & {
    class?: Pick<Class, 'id' | 'name'>;
  };
  lesson?: Pick<Lesson, 'id' | 'date' | 'startTime' | 'endTime' | 'isTest'> & {
    subject?: Pick<Subject, 'name'>;
  };
  recordedBy?: Pick<User, 'id' | 'firstName' | 'lastName'>;
}

// Notenkategorie
export interface GradeCategory {
  id: string;
  subjectId: string;
  name: string;
  weight: number; // 0.0 - 1.0
}

// Note
export interface Grade {
  id: string;
  studentId: string;
  subjectId: string;
  categoryId: string;
  value: number; // 1.0 - 6.0
  description: string | null;
  date: string;
  isLocked: boolean;
  lockedAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  category?: GradeCategory;
  student?: Pick<Student, 'id' | 'firstName' | 'lastName'>;
  subject?: Pick<Subject, 'id' | 'name'>;
  corrections?: GradeCorrection[];
}

// Notenkorrektur
export interface GradeCorrection {
  id: string;
  gradeId: string;
  oldValue: number;
  newValue: number;
  reason: string;
  correctedById: string;
  correctedAt: string;
  correctedBy?: Pick<User, 'id' | 'firstName' | 'lastName'>;
}

// Promotionsregel
export interface PromotionRule {
  id: string;
  classId: string;
  schoolYear: string;
  minAverage: number;
  maxFailing: number;
  description: string | null;
}

// Benachrichtigung
export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}

// Audit-Log-Eintrag
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: string | null;
  newValue: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
}
