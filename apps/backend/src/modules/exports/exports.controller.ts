// Export-Controller: setzt Header und liefert Dateien aus

import { Request, Response, NextFunction } from 'express';
import * as exportsService from './exports.service';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const absencesCsv = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const csv = await exportsService.absencesCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="absenzen.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

export const gradesExcel = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const buffer = await exportsService.gradesWorkbook();
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', 'attachment; filename="noten.xlsx"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
};

export const promotionReport = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const buffer = await exportsService.promotionWorkbook();
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', 'attachment; filename="promotion.xlsx"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
};

export const auditLogCsv = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const csv = await exportsService.auditLogCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-log.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
};
