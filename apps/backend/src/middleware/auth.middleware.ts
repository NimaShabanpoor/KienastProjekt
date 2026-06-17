// JWT-Authentifizierungs-Middleware
// Verifiziert den Access Token und setzt req.user
// Sicherheit: Berechtigungsprüfung IMMER serverseitig

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { Role } from '@prisma/client';

// Payload-Struktur des Access Tokens
interface AccessTokenPayload {
  sub: string;   // userId
  role: Role;
  iat: number;
  exp: number;
}

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Authorization-Header auslesen
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Nicht authentifiziert. Bitte melde dich an.',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    // Token verifizieren und Payload dekodieren
    const payload = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;

    // Benutzer-Informationen auf Request setzen
    req.user = {
      id: payload.sub,
      email: '',  // Wird bei Bedarf aus DB geladen
      role: payload.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: 'Sitzung abgelaufen. Bitte neu anmelden.',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Ungültiger JWT-Token empfangen', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      res.status(401).json({
        error: 'Ungültiger Token.',
        code: 'INVALID_TOKEN',
      });
      return;
    }

    logger.error('Unerwarteter Auth-Fehler', { error });
    res.status(500).json({
      error: 'Interner Serverfehler bei der Authentifizierung.',
      code: 'AUTH_ERROR',
    });
  }
};
