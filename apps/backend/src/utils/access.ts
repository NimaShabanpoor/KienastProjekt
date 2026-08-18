// Zugriffskontrolle auf Objektebene (Object-Level Authorization)

import { Role } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../middleware/errorHandler.middleware';

/**
 * Klassen-IDs einer Lehrperson: Stundenplan-Slots + Klassenlehrer.
 */
export async function getTeacherClassIds(teacherId: string): Promise<string[]> {
  const [slots, homeroomClasses, lessons] = await Promise.all([
    prisma.timetableSlot.findMany({
      where: { teacherId },
      select: { classId: true },
      distinct: ['classId'],
    }),
    prisma.class.findMany({
      where: { homeroomTeacherId: teacherId },
      select: { id: true },
    }),
    prisma.lesson.findMany({
      where: { teacherId },
      select: { classId: true },
      distinct: ['classId'],
    }),
  ]);
  return [
    ...new Set([
      ...slots.map((s) => s.classId),
      ...homeroomClasses.map((c) => c.id),
      ...lessons.map((l) => l.classId),
    ]),
  ];
}

/** Fach-IDs, die eine Lehrperson unterrichtet. */
export async function getTeacherSubjectIds(teacherId: string): Promise<string[]> {
  const rows = await prisma.subjectTeacher.findMany({
    where: { teacherId },
    select: { subjectId: true },
  });
  return rows.map((r) => r.subjectId);
}

export function isPrivileged(role: Role): boolean {
  return role === Role.ABTEILUNGSLEITUNG;
}

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

export async function assertSubjectAccessible(
  subjectId: string,
  userId: string,
  role: Role
): Promise<void> {
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: { id: true },
  });
  if (!subject) throw new ApiError('Fach nicht gefunden.', 'SUBJECT_NOT_FOUND', 404);
  if (isPrivileged(role)) return;
  const assigned = await prisma.subjectTeacher.findUnique({
    where: { subjectId_teacherId: { subjectId, teacherId: userId } },
  });
  if (!assigned) {
    throw new ApiError('Keine Berechtigung für dieses Fach.', 'FORBIDDEN', 403);
  }
}
