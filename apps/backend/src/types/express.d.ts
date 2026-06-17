// Express Request-Erweiterung für TypeScript
// req.user wird durch authMiddleware gesetzt

import { Role, AuditEntityType } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      // Authentifizierter Benutzer (wird von authMiddleware gesetzt)
      user?: {
        id: string;
        email: string;
        role: Role;
      };
      // AuditLog-Felder (werden von Controllern gesetzt)
      auditEntityType?: AuditEntityType;
      auditEntityId?: string;
      auditOldValue?: unknown;
      auditNewValue?: unknown;
    }
  }
}

export {};
