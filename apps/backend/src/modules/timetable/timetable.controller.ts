// Stundenplan-Controller

import { Request, Response, NextFunction } from 'express';
import * as timetableService from './timetable.service';

export const getTimetable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const classId = req.query['classId'] as string;
    if (!classId) {
      res.status(400).json({ error: 'classId erforderlich.', code: 'MISSING_PARAMS' });
      return;
    }
    const data = await timetableService.getClassTimetable(classId);
    res.json({ data });
  } catch (err) { next(err); }
};

export const upsertSlot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const slots = await timetableService.upsertSlot(req.body as Parameters<typeof timetableService.upsertSlot>[0]);
    req.auditEntityId = slots[0]?.id;
    res.status(201).json({ data: slots });
  } catch (err) { next(err); }
};

export const removeSlot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] ?? '';
    await timetableService.deleteSlot(id);
    req.auditEntityId = id;
    res.json({ data: { message: 'Eintrag gelöscht.' } });
  } catch (err) { next(err); }
};

export const listExceptions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const classId = req.query['classId'] as string;
    if (!classId) {
      res.status(400).json({ error: 'classId erforderlich.', code: 'MISSING_PARAMS' });
      return;
    }
    const data = await timetableService.listExceptions(
      classId,
      req.query['dateFrom'] as string | undefined,
      req.query['dateTo'] as string | undefined
    );
    res.json({ data });
  } catch (err) { next(err); }
};

export const upsertException = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ex = await timetableService.upsertException(req.body as Parameters<typeof timetableService.upsertException>[0]);
    req.auditEntityId = ex.id;
    res.status(201).json({ data: ex });
  } catch (err) { next(err); }
};

export const removeException = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] ?? '';
    await timetableService.deleteException(id);
    req.auditEntityId = id;
    res.json({ data: { message: 'Ausnahme gelöscht.' } });
  } catch (err) { next(err); }
};

export const getStructure = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await timetableService.getStructure();
    res.json({ data });
  } catch (err) { next(err); }
};

export const saveStructure = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = req.body as { rows: Parameters<typeof timetableService.saveStructure>[0] };
    const data = await timetableService.saveStructure(body.rows);
    res.json({ data });
  } catch (err) { next(err); }
};

export const listHolidays = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await timetableService.listHolidays(
      req.query['dateFrom'] as string | undefined,
      req.query['dateTo'] as string | undefined
    );
    res.json({ data });
  } catch (err) { next(err); }
};

export const upsertHoliday = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const holiday = await timetableService.upsertHoliday(
      req.body as Parameters<typeof timetableService.upsertHoliday>[0]
    );
    req.auditEntityId = holiday.id;
    res.status(201).json({ data: holiday });
  } catch (err) { next(err); }
};

export const removeHoliday = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] ?? '';
    await timetableService.deleteHoliday(id);
    req.auditEntityId = id;
    res.json({ data: { message: 'Feiertag gelöscht.' } });
  } catch (err) { next(err); }
};
