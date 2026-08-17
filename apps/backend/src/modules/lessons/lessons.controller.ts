// Lektionen-Controller

import { Request, Response, NextFunction } from 'express';
import * as lessonsService from './lessons.service';
import { getPaginationParams } from '../../utils/pagination';

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit } = getPaginationParams({
      page: Number(req.query['page']) || undefined,
      limit: Number(req.query['limit']) || 50,
    });
    const result = await lessonsService.listLessons({
      page,
      limit,
      subjectId: req.query['subjectId'] as string | undefined,
      classId: req.query['classId'] as string | undefined,
      dateFrom: req.query['dateFrom'] as string | undefined,
      dateTo: req.query['dateTo'] as string | undefined,
      isCancelled: req.query['isCancelled'] !== undefined ? req.query['isCancelled'] === 'true' : undefined,
      requestingUserId: req.user!.id,
      requestingUserRole: req.user!.role,
    });
    res.json({ data: result.lessons, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
  } catch (err) { next(err); }
};

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const lesson = await lessonsService.getLessonById(req.params['id'] ?? '');
    res.json({ data: lesson });
  } catch (err) { next(err); }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const lessons = await lessonsService.createLesson(req.body as Parameters<typeof lessonsService.createLesson>[0]);
    req.auditEntityId = lessons[0]?.id;
    req.auditNewValue = { count: lessons.length };
    res.status(201).json({ data: lessons.length === 1 ? lessons[0] : lessons });
  } catch (err) { next(err); }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] ?? '';
    const lesson = await lessonsService.updateLesson(id, req.body as Parameters<typeof lessonsService.updateLesson>[1]);
    req.auditEntityId = id;
    res.json({ data: lesson });
  } catch (err) { next(err); }
};

export const cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] ?? '';
    const { reason } = req.body as { reason: string };
    const lesson = await lessonsService.cancelLesson(id, reason, req.user!.id, req.user!.role);
    req.auditEntityId = id;
    req.auditNewValue = { isCancelled: true, reason };
    res.json({ data: lesson });
  } catch (err) { next(err); }
};

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] ?? '';
    await lessonsService.deleteLesson(id);
    req.auditEntityId = id;
    res.json({ data: { message: 'Lektion gelöscht.' } });
  } catch (err) { next(err); }
};
