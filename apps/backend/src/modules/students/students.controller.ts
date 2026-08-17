// Schüler-Controller: HTTP-Handler

import { Request, Response, NextFunction } from 'express';
import * as studentsService from './students.service';
import { getPaginationParams } from '../../utils/pagination';

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit } = getPaginationParams({
      page: Number(req.query['page']) || undefined,
      limit: Number(req.query['limit']) || undefined,
    });
    const result = await studentsService.listStudents({
      page,
      limit,
      classId: req.query['classId'] as string | undefined,
      isActive: req.query['isActive'] !== undefined ? req.query['isActive'] === 'true' : undefined,
      search: req.query['search'] as string | undefined,
      requestingUserId: req.user!.id,
      requestingUserRole: req.user!.role,
    });
    res.json({ data: result.students, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
  } catch (err) { next(err); }
};

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const student = await studentsService.getStudentById(req.params['id'] ?? '', req.user!.id, req.user!.role);
    res.json({ data: student });
  } catch (err) { next(err); }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const student = await studentsService.createStudent(req.body as Parameters<typeof studentsService.createStudent>[0]);
    req.auditEntityId = student.id;
    req.auditNewValue = { firstName: student.firstName, lastName: student.lastName, classId: student.classId };
    res.status(201).json({ data: student });
  } catch (err) { next(err); }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] ?? '';
    const student = await studentsService.updateStudent(id, req.body as Partial<Parameters<typeof studentsService.createStudent>[0]>);
    req.auditEntityId = id;
    res.json({ data: student });
  } catch (err) { next(err); }
};

export const deactivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] ?? '';
    const result = await studentsService.deactivateStudent(id);
    req.auditEntityId = id;
    res.json({ data: result });
  } catch (err) { next(err); }
};

export const activate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] ?? '';
    const result = await studentsService.activateStudent(id);
    req.auditEntityId = id;
    res.json({ data: result });
  } catch (err) { next(err); }
};

export const getAbsences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const absences = await studentsService.getStudentAbsences(req.params['id'] ?? '', req.user!.id, req.user!.role);
    res.json({ data: absences });
  } catch (err) { next(err); }
};

export const getGrades = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const grades = await studentsService.getStudentGrades(req.params['id'] ?? '', req.user!.id, req.user!.role);
    res.json({ data: grades });
  } catch (err) { next(err); }
};
