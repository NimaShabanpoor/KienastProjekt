// Lektionen-Routen

import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminOnly, authenticated } from '../../middleware/role.middleware';
import { auditLogMiddleware } from '../../middleware/auditLog.middleware';
import { validateMiddleware } from '../../middleware/validate.middleware';
import * as lessonsController from './lessons.controller';
import { CreateLessonBodySchema, UpdateLessonBodySchema, CancelLessonBodySchema } from './lessons.schemas';
import { AuditEntityType } from '@prisma/client';

const router = Router();
router.use(authMiddleware);

router.get('/', authenticated, lessonsController.list);
router.post('/', adminOnly, validateMiddleware({ body: CreateLessonBodySchema }), auditLogMiddleware('LESSON_CREATED', AuditEntityType.LESSON), lessonsController.create);
router.get('/:id', authenticated, lessonsController.getById);
router.put('/:id', adminOnly, validateMiddleware({ body: UpdateLessonBodySchema }), auditLogMiddleware('LESSON_UPDATED', AuditEntityType.LESSON), lessonsController.update);
router.patch('/:id/cancel', authenticated, validateMiddleware({ body: CancelLessonBodySchema }), auditLogMiddleware('LESSON_CANCELLED', AuditEntityType.LESSON), lessonsController.cancel);
router.delete('/:id', adminOnly, auditLogMiddleware('LESSON_DELETED', AuditEntityType.LESSON), lessonsController.remove);

export default router;
