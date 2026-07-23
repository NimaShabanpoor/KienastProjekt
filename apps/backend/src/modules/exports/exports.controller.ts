// Export-Controller

import { Request, Response, NextFunction } from 'express';
import * as exportsService from './exports.service';

function sendCsv(res: Response, filename: string, content: string): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + content);
}

export const absencesCsv = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const csv = await exportsService.exportAbsencesCsv();
    sendCsv(res, 'absenzen.csv', csv);
  } catch (err) { next(err); }
};

export const gradesCsv = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const classId = req.query['classId'] as string;
    if (!classId) {
      res.status(400).json({ error: 'classId erforderlich.', code: 'MISSING_PARAMS' });
      return;
    }
    const csv = await exportsService.exportGradesCsv(classId);
    sendCsv(res, 'noten.csv', csv);
  } catch (err) { next(err); }
};

export const promotionCsv = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const classId = req.query['classId'] as string;
    const schoolYear = req.query['schoolYear'] as string;
    if (!classId || !schoolYear) {
      res.status(400).json({ error: 'classId und schoolYear erforderlich.', code: 'MISSING_PARAMS' });
      return;
    }
    const csv = await exportsService.exportPromotionCsv(classId, schoolYear);
    sendCsv(res, 'promotion.csv', csv);
  } catch (err) { next(err); }
};

export const auditLogCsv = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const csv = await exportsService.exportAuditLogCsv();
    sendCsv(res, 'audit-log.csv', csv);
  } catch (err) { next(err); }
};
