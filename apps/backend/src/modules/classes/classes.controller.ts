// Klassen-Controller
// Objekt-Zugriffskontrolle erfolgt im Service (assertClassAccessible –
// berücksichtigt unterrichtete Fächer UND Klassenlehrer-Zuweisung).

import { Request, Response, NextFunction } from 'express';
import * as classesService from './classes.service';
import { getPaginationParams } from '../../utils/pagination';

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit } = getPaginationParams({
      page: Number(req.query['page']) || undefined,
      limit: Number(req.query['limit']) || undefined,
    });
    const result = await classesService.listClasses({
      page,
      limit,
      schoolYear: req.query['schoolYear'] as string | undefined,
      semester: req.query['semester'] ? Number(req.query['semester']) : undefined,
      isActive: req.query['isActive'] !== undefined ? req.query['isActive'] === 'true' : undefined,
      requestingUserId: req.user!.id,
      requestingUserRole: req.user!.role,
    });
    res.json({ data: result.classes, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
  } catch (err) { next(err); }
};

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cls = await classesService.getClassById(req.params['id'] ?? '', req.user!.id, req.user!.role);
    res.json({ data: cls });
  } catch (err) { next(err); }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cls = await classesService.createClass(req.body as {
      name: string;
      semester: number;
      schoolYear: string;
      homeroomTeacherId?: string | null;
    });
    req.auditEntityId = cls.id;
    res.status(201).json({ data: cls });
  } catch (err) { next(err); }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] ?? '';
    const cls = await classesService.updateClass(id, req.body as {
      name?: string;
      semester?: number;
      schoolYear?: string;
      homeroomTeacherId?: string | null;
    });
    req.auditEntityId = id;
    res.json({ data: cls });
  } catch (err) { next(err); }
};

export const getStudents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const students = await classesService.getClassStudents(req.params['id'] ?? '', req.user!.id, req.user!.role);
    res.json({ data: students });
  } catch (err) { next(err); }
};

export const getSubjects = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const subjects = await classesService.getClassSubjects(req.params['id'] ?? '', req.user!.id, req.user!.role);
    res.json({ data: subjects });
  } catch (err) { next(err); }
};

export const getTimetable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const timetable = await classesService.getClassTimetable(
      req.params['id'] ?? '',
      req.user!.id,
      req.user!.role,
      req.query['dateFrom'] as string | undefined,
      req.query['dateTo'] as string | undefined
    );
    res.json({ data: timetable });
  } catch (err) { next(err); }
};

export const createSubject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] ?? '';
    const subject = await classesService.createSubject(id, req.body as { name: string; teacherId: string });
    req.auditEntityId = subject.id;
    res.status(201).json({ data: subject });
  } catch (err) { next(err); }
};
