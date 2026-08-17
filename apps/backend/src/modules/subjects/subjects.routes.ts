// Fächer-/Module-Routen
// Lesen: alle authentifizierten Benutzer (Lehrperson gescoped auf eigene Fächer).
// Anlegen/Ändern/Deaktivieren: nur Abteilungsleitung.

import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminOnly, authenticated } from '../../middleware/role.middleware';
import { auditLogMiddleware } from '../../middleware/auditLog.middleware';
import { validateMiddleware } from '../../middleware/validate.middleware';
import * as subjectsController from './subjects.controller';
import { CreateSubjectBodySchema, UpdateSubjectBodySchema } from './subjects.schemas';
import { AuditEntityType } from '@prisma/client';

const router = Router();
router.use(authMiddleware);

router.get('/', authenticated, subjectsController.list);
router.post(
  '/',
  adminOnly,
  validateMiddleware({ body: CreateSubjectBodySchema }),
  auditLogMiddleware('SUBJECT_CREATED', AuditEntityType.SUBJECT),
  subjectsController.create
);
router.put(
  '/:id',
  adminOnly,
  validateMiddleware({ body: UpdateSubjectBodySchema }),
  auditLogMiddleware('SUBJECT_UPDATED', AuditEntityType.SUBJECT),
  subjectsController.update
);
router.patch(
  '/:id/deactivate',
  adminOnly,
  auditLogMiddleware('SUBJECT_DEACTIVATED', AuditEntityType.SUBJECT),
  subjectsController.deactivate
);
router.patch(
  '/:id/activate',
  adminOnly,
  auditLogMiddleware('SUBJECT_ACTIVATED', AuditEntityType.SUBJECT),
  subjectsController.activate
);

export default router;
