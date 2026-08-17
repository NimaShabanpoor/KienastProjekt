// Absenzen-Controller

import { Request, Response, NextFunction } from 'express';
import { AbsenceStatus } from '@prisma/client';
import * as absencesService from './absences.service';
import { prisma } from '../../config/database';
import { env } from '../../config/env';

const ABSENCE_STATUSES = Object.values(AbsenceStatus);

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const statusParam = req.query['status'] as string | undefined;
    if (statusParam && !ABSENCE_STATUSES.includes(statusParam as AbsenceStatus)) {
      res.status(400).json({ error: 'Ungültiger Absenz-Status.', code: 'VALIDATION_ERROR' });
      return;
    }
    const absences = await absencesService.listAbsences({
      lessonId: req.query['lessonId'] as string | undefined,
      studentId: req.query['studentId'] as string | undefined,
      status: statusParam as AbsenceStatus | undefined,
      requestingUserId: req.user!.id,
      requestingUserRole: req.user!.role,
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
      requestingUserId: req.user!.id,
      requestingUserRole: req.user!.role,
    });
    res.json({ data: stats });
  } catch (err) { next(err); }
};

export const getAlerts = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Denselben Schwellenwert wie der Cron-Job verwenden (DB-Config vor ENV-Fallback)
    const config = await prisma.config.findUnique({ where: { key: 'ABSENCE_THRESHOLD' } });
    let threshold = env.ABSENCE_THRESHOLD;
    if (config) {
      const parsed = Number(JSON.parse(config.value));
      if (Number.isInteger(parsed) && parsed > 0) threshold = parsed;
    }
    const alerts = await absencesService.getThresholdAlerts(threshold);
    res.json({ data: alerts });
  } catch (err) { next(err); }
};
