// Noten-Controller

import { Request, Response, NextFunction } from 'express';
import * as gradesService from './grades.service';

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const grades = await gradesService.listGrades({
      subjectId: req.query['subjectId'] as string | undefined,
      studentId: req.query['studentId'] as string | undefined,
      classId: req.query['classId'] as string | undefined,
      categoryId: req.query['categoryId'] as string | undefined,
      requestingUserId: req.user!.id,
      requestingUserRole: req.user!.role,
    });
    res.json({ data: grades });
  } catch (err) { next(err); }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const grade = await gradesService.createGrade(
      req.body as Parameters<typeof gradesService.createGrade>[0],
      req.user!.id,
      req.user!.role
    );
    req.auditEntityId = grade.id;
    req.auditNewValue = { value: grade.value, studentId: grade.studentId };
    res.status(201).json({ data: grade });
  } catch (err) { next(err); }
};

export const correct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] ?? '';
    const { newValue, reason } = req.body as { newValue: number; reason: string };
    const correction = await gradesService.correctGrade(id, newValue, reason, req.user!.id);
    req.auditEntityId = id;
    req.auditNewValue = { newValue, reason };
    res.json({ data: correction });
  } catch (err) { next(err); }
};

export const getCorrections = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const corrections = await gradesService.getGradeCorrections(req.params['id'] ?? '');
    res.json({ data: corrections });
  } catch (err) { next(err); }
};

export const getAverage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const studentId = req.query['studentId'] as string;
    const subjectId = req.query['subjectId'] as string;
    if (!studentId || !subjectId) {
      res.status(400).json({ error: 'studentId und subjectId erforderlich.', code: 'MISSING_PARAMS' });
      return;
    }
    const average = await gradesService.calculateWeightedAverage(studentId, subjectId);
    res.json({ data: { average } });
  } catch (err) { next(err); }
};

export const getPromotionCheck = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const classId = req.query['classId'] as string;
    const schoolYear = req.query['schoolYear'] as string;
    if (!classId || !schoolYear) {
      res.status(400).json({ error: 'classId und schoolYear erforderlich.', code: 'MISSING_PARAMS' });
      return;
    }
    const result = await gradesService.checkPromotion(classId, schoolYear);
    res.json({ data: result });
  } catch (err) { next(err); }
};

export const getCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categories = await gradesService.getGradeCategories(req.params['subjectId'] ?? '');
    res.json({ data: categories });
  } catch (err) { next(err); }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, weight } = req.body as { name: string; weight: number };
    const category = await gradesService.createGradeCategory(req.params['subjectId'] ?? '', name, weight);
    res.status(201).json({ data: category });
  } catch (err) { next(err); }
};
