// Zod-Request-Validierungs-Middleware
// Validiert Body, Query und Params gegen ein Zod-Schema
// Gibt strukturierte Fehlermeldungen zurück

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

interface ValidationTargets {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export const validateMiddleware = (schemas: ValidationTargets) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Body validieren
      if (schemas.body) {
        req.body = schemas.body.parse(req.body) as unknown;
      }

      // Query-Parameter validieren
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as typeof req.query;
      }

      // URL-Parameter validieren
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as typeof req.params;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details: Record<string, string[]> = {};

        error.errors.forEach((err) => {
          const path = err.path.join('.');
          if (!details[path]) details[path] = [];
          details[path].push(err.message);
        });

        res.status(400).json({
          error: 'Validierungsfehler. Bitte überprüfe die Eingaben.',
          code: 'VALIDATION_ERROR',
          details,
        });
        return;
      }

      // Unerwarteter Fehler
      next(error);
    }
  };
};
