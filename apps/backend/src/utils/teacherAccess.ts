// Hilfsfunktionen für Klassenlehrer-Zugriff

import { prisma } from '../config/database';
import { ApiError } from '../middleware/errorHandler.middleware';

export async function getHomeroomClassIds(teacherId: string): Promise<string[]> {
  const classes = await prisma.class.findMany({
    where: { homeroomTeacherId: teacherId, isActive: true },
    select: { id: true },
  });
  return classes.map((c) => c.id);
}

export async function assertTeacherHasClassAccess(
  teacherId: string,
  classId: string
): Promise<void> {
  const cls = await prisma.class.findFirst({
    where: { id: classId, homeroomTeacherId: teacherId, isActive: true },
  });
  if (!cls) {
    throw new ApiError('Keine Berechtigung für diese Klasse.', 'FORBIDDEN', 403);
  }
}
