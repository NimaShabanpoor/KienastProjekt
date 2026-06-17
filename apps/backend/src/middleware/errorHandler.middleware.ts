// Zentraler Fehler-Handler
// Alle unbehandelten Fehler landen hier
// Kein Silent-Catch – alle Fehler werden geloggt

import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

// Typisierter API-Fehler für kontrollierte Fehlermeldungen
export class ApiError extends Error {
  constructor(
    public readonly message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Fehler-Handler-Middleware (muss 4 Parameter haben für Express)
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  // Kontrollierter API-Fehler
  if (err instanceof ApiError) {
    logger.warn('API-Fehler', {
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      path: req.path,
      userId: req.user?.id,
    });

    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details,
    });
    return;
  }

  // Unerwarteter Fehler – vollständig loggen
  logger.error('Unerwarteter Fehler', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    ip: req.ip,
  });

  // In Produktion keine internen Fehlerdetails ausgeben
  res.status(500).json({
    error: 'Interner Serverfehler. Bitte versuche es später erneut.',
    code: 'INTERNAL_ERROR',
  });
};

// 404-Handler für nicht gefundene Routen
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    error: `Route '${req.path}' nicht gefunden.`,
    code: 'NOT_FOUND',
  });
};
