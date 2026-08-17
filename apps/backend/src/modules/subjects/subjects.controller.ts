// Fächer-/Module-Controller

import { Request, Response, NextFunction } from 'express';
import * as subjectsService from './subjects.service';
import { CreateSubjectBodySchema, UpdateSubjectBodySchema } from './subjects.schemas';
import type { z } from 'zod';

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const subjects = await subjectsService.listSubjects({
      classId: req.query['classId'] as string | undefined,
      teacherId: req.query['teacherId'] as string | undefined,
      isActive:
        req.query['isActive'] !== undefined ? req.query['isActive'] === 'true' : undefined,
      requestingUserId: req.user!.id,
      requestingUserRole: req.user!.role,
    });
    res.json({ data: subjects });
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = req.body as z.infer<typeof CreateSubjectBodySchema>;
    const subject = await subjectsService.createSubject(body);
    req.auditEntityId = subject.id;
    req.auditNewValue = { name: subject.name, classId: subject.classId, teacherId: subject.teacherId };
    res.status(201).json({ data: subject });
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] ?? '';
    const body = req.body as z.infer<typeof UpdateSubjectBodySchema>;
    const subject = await subjectsService.updateSubject(id, body);
    req.auditEntityId = id;
    res.json({ data: subject });
  } catch (err) {
    next(err);
  }
};

export const deactivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] ?? '';
    const result = await subjectsService.deactivateSubject(id);
    req.auditEntityId = id;
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
};

export const activate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] ?? '';
    const result = await subjectsService.activateSubject(id);
    req.auditEntityId = id;
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
};
