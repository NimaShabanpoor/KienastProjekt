// Zentrale, typisierte API-Schicht für alle Ressourcen.
// Alle Backend-Antworten sind in { data: ... } verpackt.

import { apiClient } from './client';
import type {
  Student,
  Class,
  Subject,
  Lesson,
  Absence,
  Grade,
  GradeCategory,
  GradeCorrection,
  User,
} from '@schuladmin/shared/types/entities';
import type { Role, AbsenceStatus } from '@schuladmin/shared/types/roles';

async function unwrap<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  const res = await p;
  return res.data.data;
}

function qs(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (!entries.length) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
}

// ---------------- Schüler ----------------
export interface StudentInput {
  firstName: string;
  lastName: string;
  email?: string | null;
  dateOfBirth?: string | null;
  gender?: 'M' | 'F' | 'D' | null;
  classId: string;
}

export const studentsApi = {
  list: (params?: { search?: string; classId?: string; isActive?: boolean }) =>
    unwrap<Student[]>(apiClient.get(`/api/v1/students${qs(params)}`)),
  get: (id: string) => unwrap<Student>(apiClient.get(`/api/v1/students/${id}`)),
  create: (body: StudentInput) => unwrap<Student>(apiClient.post('/api/v1/students', body)),
  update: (id: string, body: Partial<StudentInput>) =>
    unwrap<Student>(apiClient.put(`/api/v1/students/${id}`, body)),
  deactivate: (id: string) =>
    unwrap<{ id: string; isActive: boolean }>(apiClient.patch(`/api/v1/students/${id}/deactivate`)),
  activate: (id: string) =>
    unwrap<{ id: string; isActive: boolean }>(apiClient.patch(`/api/v1/students/${id}/activate`)),
  absences: (id: string) => unwrap<Absence[]>(apiClient.get(`/api/v1/students/${id}/absences`)),
  grades: (id: string) => unwrap<Grade[]>(apiClient.get(`/api/v1/students/${id}/grades`)),
};

// ---------------- Klassen ----------------
export interface ClassInput {
  name: string;
  semester: number;
  schoolYear: string;
}

export const classesApi = {
  list: () => unwrap<Class[]>(apiClient.get('/api/v1/classes')),
  get: (id: string) => unwrap<Class>(apiClient.get(`/api/v1/classes/${id}`)),
  create: (body: ClassInput) => unwrap<Class>(apiClient.post('/api/v1/classes', body)),
  update: (id: string, body: Partial<ClassInput>) =>
    unwrap<Class>(apiClient.put(`/api/v1/classes/${id}`, body)),
  students: (id: string) => unwrap<Student[]>(apiClient.get(`/api/v1/classes/${id}/students`)),
  subjects: (id: string) => unwrap<Subject[]>(apiClient.get(`/api/v1/classes/${id}/subjects`)),
  timetable: (id: string, dateFrom?: string, dateTo?: string) =>
    unwrap<Lesson[]>(apiClient.get(`/api/v1/classes/${id}/timetable${qs({ dateFrom, dateTo })}`)),
};

// ---------------- Lektionen ----------------
export interface LessonInput {
  subjectId: string;
  date: string;
  startTime: string;
  endTime: string;
  room?: string | null;
}

export const lessonsApi = {
  list: (params?: { subjectId?: string; classId?: string; dateFrom?: string; dateTo?: string; isCancelled?: boolean }) =>
    unwrap<Lesson[]>(apiClient.get(`/api/v1/lessons${qs(params)}`)),
  get: (id: string) => unwrap<Lesson>(apiClient.get(`/api/v1/lessons/${id}`)),
  create: (body: LessonInput) => unwrap<Lesson>(apiClient.post('/api/v1/lessons', body)),
  update: (id: string, body: Partial<LessonInput>) =>
    unwrap<Lesson>(apiClient.put(`/api/v1/lessons/${id}`, body)),
  cancel: (id: string, reason: string) =>
    unwrap<Lesson>(apiClient.patch(`/api/v1/lessons/${id}/cancel`, { reason })),
  remove: (id: string) => unwrap<{ message: string }>(apiClient.delete(`/api/v1/lessons/${id}`)),
};

// ---------------- Absenzen ----------------
export interface AbsenceEntryInput {
  studentId: string;
  status: AbsenceStatus;
  note?: string | null;
}

export interface AbsenceStats {
  totalAbsences: number;
  entschuldigt: number;
  unentschuldigt: number;
  quote: number;
}

export const absencesApi = {
  list: (params?: { lessonId?: string; studentId?: string; status?: AbsenceStatus }) =>
    unwrap<Absence[]>(apiClient.get(`/api/v1/absences${qs(params)}`)),
  createBatch: (lessonId: string, absences: AbsenceEntryInput[]) =>
    unwrap<Absence[]>(apiClient.post('/api/v1/absences', { lessonId, absences })),
  update: (id: string, body: { status: AbsenceStatus; note?: string | null }) =>
    unwrap<Absence>(apiClient.put(`/api/v1/absences/${id}`, body)),
  stats: (params?: { classId?: string; studentId?: string; dateFrom?: string; dateTo?: string }) =>
    unwrap<AbsenceStats>(apiClient.get(`/api/v1/absences/stats${qs(params)}`)),
  thresholdAlerts: () =>
    unwrap<Array<{ student: Student & { class?: { name: string } }; unentschuldigteAbsenzen: number }>>(
      apiClient.get('/api/v1/absences/threshold-alerts')
    ),
};

// ---------------- Noten ----------------
export interface GradeInput {
  studentId: string;
  subjectId: string;
  categoryId: string;
  value: number;
  description?: string | null;
  date: string;
}

export interface PromotionResult {
  status: 'OK' | 'KEINE_REGEL';
  details?: string;
  rule?: { minAverage: number; maxFailing: number };
  results?: Array<{
    student: { id: string; firstName: string; lastName: string };
    status: 'BESTANDEN' | 'NICHT_BESTANDEN' | 'KEINE_NOTEN' | 'UNVOLLSTAENDIG';
    overallAverage: number | null;
    failingSubjects: number;
    missingSubjects?: number;
  }>;
}

export const gradesApi = {
  list: (params?: { subjectId?: string; studentId?: string; classId?: string; categoryId?: string }) =>
    unwrap<Grade[]>(apiClient.get(`/api/v1/grades${qs(params)}`)),
  create: (body: GradeInput) => unwrap<Grade>(apiClient.post('/api/v1/grades', body)),
  correct: (id: string, newValue: number, reason: string) =>
    unwrap<GradeCorrection>(apiClient.patch(`/api/v1/grades/${id}/correct`, { newValue, reason })),
  corrections: (id: string) =>
    unwrap<GradeCorrection[]>(apiClient.get(`/api/v1/grades/${id}/corrections`)),
  average: (studentId: string, subjectId: string) =>
    unwrap<{ average: number | null }>(
      apiClient.get(`/api/v1/grades/average${qs({ studentId, subjectId })}`)
    ),
  promotionCheck: (classId: string, schoolYear: string) =>
    unwrap<PromotionResult>(apiClient.get(`/api/v1/grades/promotion-check${qs({ classId, schoolYear })}`)),
  categories: (subjectId: string) =>
    unwrap<GradeCategory[]>(apiClient.get(`/api/v1/grades/subjects/${subjectId}/categories`)),
  createCategory: (subjectId: string, name: string, weight: number) =>
    unwrap<GradeCategory>(apiClient.post(`/api/v1/grades/subjects/${subjectId}/categories`, { name, weight })),
};

// ---------------- Fächer / Module ----------------
export interface SubjectInput {
  name: string;
  classId: string;
  teacherId: string;
}

// Fach/Modul inkl. Klasse, Lehrperson und Zählern (Backend-Antwort der Liste)
export type SubjectListItem = Subject & {
  class?: { id: string; name: string; schoolYear: string; semester: number };
  teacher?: { id: string; firstName: string; lastName: string };
  _count?: { lessons: number; grades: number; gradeCategories: number };
};

export const subjectsApi = {
  list: (params?: { classId?: string; teacherId?: string; isActive?: boolean }) =>
    unwrap<SubjectListItem[]>(apiClient.get(`/api/v1/subjects${qs(params)}`)),
  create: (body: SubjectInput) => unwrap<Subject>(apiClient.post('/api/v1/subjects', body)),
  update: (id: string, body: Partial<{ name: string; teacherId: string; isActive: boolean }>) =>
    unwrap<Subject>(apiClient.put(`/api/v1/subjects/${id}`, body)),
  deactivate: (id: string) =>
    unwrap<{ id: string; isActive: boolean }>(apiClient.patch(`/api/v1/subjects/${id}/deactivate`)),
  activate: (id: string) =>
    unwrap<{ id: string; isActive: boolean }>(apiClient.patch(`/api/v1/subjects/${id}/activate`)),
};

// ---------------- Benutzer ----------------
export interface UserInput {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  password: string;
}

export const usersApi = {
  list: (params?: { role?: Role; isActive?: boolean }) =>
    unwrap<User[]>(apiClient.get(`/api/v1/users${qs(params)}`)),
  get: (id: string) => unwrap<User>(apiClient.get(`/api/v1/users/${id}`)),
  create: (body: UserInput) => unwrap<User>(apiClient.post('/api/v1/users', body)),
  update: (id: string, body: Partial<Omit<UserInput, 'password'>>) =>
    unwrap<User>(apiClient.put(`/api/v1/users/${id}`, body)),
  deactivate: (id: string) =>
    unwrap<{ id: string; isActive: boolean }>(apiClient.patch(`/api/v1/users/${id}/deactivate`)),
  activate: (id: string) =>
    unwrap<{ id: string; isActive: boolean }>(apiClient.patch(`/api/v1/users/${id}/activate`)),
  reset2FA: (id: string) =>
    unwrap<{ id: string; totpEnabled: boolean }>(apiClient.delete(`/api/v1/users/${id}/2fa`)),
};

// Gemeinsamer Fehlertext-Extraktor für Toasts
export function apiErrorMessage(err: unknown, fallback = 'Aktion fehlgeschlagen.'): string {
  const anyErr = err as { response?: { data?: { error?: string } } };
  return anyErr?.response?.data?.error ?? fallback;
}
