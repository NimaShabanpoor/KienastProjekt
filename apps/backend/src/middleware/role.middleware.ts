// Rollen-basierte Zugriffskontrolle (RBAC)
// Prüft ob der authentifizierte Benutzer die erforderliche Rolle hat
// WICHTIG: authMiddleware muss vorher ausgeführt werden

import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';

export const roleMiddleware = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // req.user wird von authMiddleware gesetzt
    if (!req.user) {
      res.status(401).json({
        error: 'Nicht authentifiziert.',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Keine Berechtigung für diese Aktion.',
        code: 'FORBIDDEN',
        details: {
          required: allowedRoles,
          current: req.user.role,
        },
      });
      return;
    }

    next();
  };
};

// Kurzform: Nur Abteilungsleitung
export const adminOnly = roleMiddleware([Role.ABTEILUNGSLEITUNG]);

// Kurzform: Beide Rollen erlaubt
export const authenticated = roleMiddleware([Role.LEHRPERSON, Role.ABTEILUNGSLEITUNG]);
