// Audit-Log-Middleware
// Schreibt nach erfolgreicher Antwort automatisch einen AuditLog-Eintrag
// nDSG: Nachvollziehbarkeit aller kritischen Aktionen sicherstellen

import { Request, Response, NextFunction } from 'express';
import { AuditEntityType } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

export const auditLogMiddleware = (action: string, entityType: AuditEntityType) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Original-json-Methode sichern
    const originalJson = res.json.bind(res);

    // json-Methode überschreiben um den Antwort-Zeitpunkt abzufangen
    res.json = function (body: unknown) {
      // Nur bei erfolgreichen Antworten (2xx) loggen
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        // Asynchron schreiben – blockiert die Antwort nicht
        setImmediate(async () => {
          try {
            await prisma.auditLog.create({
              data: {
                userId: req.user!.id,
                action,
                entityType,
                entityId: req.auditEntityId ?? req.params['id'] ?? 'unbekannt',
                oldValue: req.auditOldValue
                  ? JSON.stringify(req.auditOldValue)
                  : null,
                newValue: req.auditNewValue
                  ? JSON.stringify(req.auditNewValue)
                  : null,
                ipAddress: req.ip ?? null,
                userAgent: req.headers['user-agent'] ?? null,
              },
            });
          } catch (err) {
            // AuditLog-Fehler dürfen die API nicht zum Absturz bringen
            logger.error('AuditLog-Schreibfehler', { err, action, entityType });
          }
        });
      }

      return originalJson(body);
    };

    next();
  };
};
