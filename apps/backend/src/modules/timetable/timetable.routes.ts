// Stundenplan-Routen (nur Leiter)

import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminOnly } from '../../middleware/role.middleware';
import { validateMiddleware } from '../../middleware/validate.middleware';
import { auditLogMiddleware } from '../../middleware/auditLog.middleware';
import { AuditEntityType } from '@prisma/client';
import * as timetableController from './timetable.controller';
import { UpsertTimetableSlotBodySchema, UpsertTimetableExceptionBodySchema } from './timetable.schemas';

const router = Router();
router.use(authMiddleware, adminOnly);

router.get('/', timetableController.getTimetable);
router.put(
  '/slots',
  validateMiddleware({ body: UpsertTimetableSlotBodySchema }),
  auditLogMiddleware('TIMETABLE_IMPORT', AuditEntityType.TIMETABLE_IMPORT),
  timetableController.upsertSlot
);
router.delete(
  '/slots/:id',
  auditLogMiddleware('TIMETABLE_IMPORT', AuditEntityType.TIMETABLE_IMPORT),
  timetableController.removeSlot
);
router.get('/exceptions', timetableController.listExceptions);
router.put(
  '/exceptions',
  validateMiddleware({ body: UpsertTimetableExceptionBodySchema }),
  auditLogMiddleware('TIMETABLE_IMPORT', AuditEntityType.TIMETABLE_IMPORT),
  timetableController.upsertException
);
router.delete(
  '/exceptions/:id',
  auditLogMiddleware('TIMETABLE_IMPORT', AuditEntityType.TIMETABLE_IMPORT),
  timetableController.removeException
);

export default router;
