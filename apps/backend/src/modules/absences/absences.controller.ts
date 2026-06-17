// Absenzen-Controller

import { Request, Response, NextFunction } from 'express';
import * as absencesService from './absences.service';
import { env } from '../../config/env';

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { prisma } = await import('../../config/database');
    const absences = await prisma.absence.findMany({
      where: {
        ...(req.query['lessonId'] && { lessonId: req.query['lessonId'] as string }),
        ...(req.query['studentId'] && { studentId: req.query['studentId'] as string }),
        ...(req.query['status'] && { status: req.query['status'] as 'ANWESEND' | 'ENTSCHULDIGT' | 'UNENTSCHULDIGT' }),
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        lesson: { select: { id: true, date: true, startTime: true, endTime: true } },
        recordedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      take: 100,
    });
    res.json({ data: absences });
  } catch (err) { next(err); }
};

export const createBatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { lessonId, absences } = req.body as { lessonId: string; absences: Array<{ studentId: string; status: 'ANWESEND' | 'ENTSCHULDIGT' | 'UNENTSCHULDIGT'; note?: string | null }> };
    const results = await absencesService.createAbsenceBatch(lessonId, absences, req.user!.id, req.user!.role);
    req.auditEntityId = lessonId;
    req.auditNewValue = { count: results.length, lessonId };
    res.status(201).json({ data: results });
  } catch (err) { next(err); }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] ?? '';
    const { status, note } = req.body as { status: 'ANWESEND' | 'ENTSCHULDIGT' | 'UNENTSCHULDIGT'; note?: string | null };
    const absence = await absencesService.updateAbsence(id, status, note, req.user!.id, req.user!.role);
    req.auditEntityId = id;
    req.auditNewValue = { status };
    res.json({ data: absence });
  } catch (err) { next(err); }
};

export const getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stats = await absencesService.getAbsenceStats({
      classId: req.query['classId'] as string | undefined,
      studentId: req.query['studentId'] as string | undefined,
      dateFrom: req.query['dateFrom'] as string | undefined,
      dateTo: req.query['dateTo'] as string | undefined,
    });
    res.json({ data: stats });
  } catch (err) { next(err); }
};

export const getAlerts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const threshold = env.ABSENCE_THRESHOLD;
    const alerts = await absencesService.getThresholdAlerts(threshold);
    res.json({ data: alerts });
  } catch (err) { next(err); }
};
