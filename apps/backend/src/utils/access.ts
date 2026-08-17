// Zugriffskontrolle auf Objektebene (Object-Level Authorization)
// Eine LEHRPERSON darf nur auf Daten der von ihr unterrichteten Klassen/Fächer
// zugreifen. ABTEILUNGSLEITUNG hat uneingeschränkten Zugriff.
// nDSG: Zugriff auf Personendaten Minderjähriger strikt auf das Notwendige begrenzen.

import { Role } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../middleware/errorHandler.middleware';

/**
 * Klassen-IDs, auf die eine Lehrperson Zugriff hat:
 * Klassen, in denen sie ein aktives Fach unterrichtet, PLUS Klassen,
 * denen sie als Klassenlehrer (homeroomTeacher) zugewiesen ist.
 */
export async function getTeacherClassIds(teacherId: string): Promise<string[]> {
  const [subjects, homeroomClasses] = await Promise.all([
    prisma.subject.findMany({
      where: { teacherId, isActive: true },
      select: { classId: true },
    }),
    prisma.class.findMany({
      where: { homeroomTeacherId: teacherId },
      select: { id: true },
    }),
  ]);
  return [
    ...new Set([...subjects.map((s) => s.classId), ...homeroomClasses.map((c) => c.id)]),
  ];
}

/** Fach-IDs, die eine Lehrperson unterrichtet. */
export async function getTeacherSubjectIds(teacherId: string): Promise<string[]> {
  const subjects = await prisma.subject.findMany({
    where: { teacherId, isActive: true },
    select: { id: true },
  });
  return subjects.map((s) => s.id);
}

/** True, wenn die Rolle uneingeschränkten Zugriff hat. */
export function isPrivileged(role: Role): boolean {
  return role === Role.ABTEILUNGSLEITUNG;
}

/**
 * Stellt sicher, dass der Benutzer auf den Schüler zugreifen darf.
 * Wirft 404, wenn der Schüler nicht existiert, und 403, wenn eine Lehrperson
 * auf einen Schüler ausserhalb ihrer Klassen zugreift.
 */
export async function assertStudentAccessible(
  studentId: string,
  userId: string,
  role: Role
): Promise<void> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { classId: true },
  });
  if (!student) throw new ApiError('Schüler nicht gefunden.', 'STUDENT_NOT_FOUND', 404);
  if (isPrivileged(role)) return;

  const classIds = await getTeacherClassIds(userId);
  if (!classIds.includes(student.classId)) {
    throw new ApiError('Keine Berechtigung für diesen Schüler.', 'FORBIDDEN', 403);
  }
}

/**
 * Stellt sicher, dass der Benutzer auf die Klasse zugreifen darf.
 * Wirft 403, wenn eine Lehrperson auf eine nicht von ihr unterrichtete Klasse zugreift.
 */
export async function assertClassAccessible(
  classId: string,
  userId: string,
  role: Role
): Promise<void> {
  if (isPrivileged(role)) return;
  const classIds = await getTeacherClassIds(userId);
  if (!classIds.includes(classId)) {
    throw new ApiError('Keine Berechtigung für diese Klasse.', 'FORBIDDEN', 403);
  }
}

/**
 * Stellt sicher, dass der Benutzer auf das Fach zugreifen darf.
 * Wirft 404, wenn das Fach nicht existiert, und 403, wenn eine Lehrperson
 * auf ein fremdes Fach zugreift.
 */
export async function assertSubjectAccessible(
  subjectId: string,
  userId: string,
  role: Role
): Promise<void> {
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: { teacherId: true },
  });
  if (!subject) throw new ApiError('Fach nicht gefunden.', 'SUBJECT_NOT_FOUND', 404);
  if (isPrivileged(role)) return;
  if (subject.teacherId !== userId) {
    throw new ApiError('Keine Berechtigung für dieses Fach.', 'FORBIDDEN', 403);
  }
}
