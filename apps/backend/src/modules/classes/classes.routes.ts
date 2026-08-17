// Klassen-Routen

import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminOnly, authenticated } from '../../middleware/role.middleware';
import { auditLogMiddleware } from '../../middleware/auditLog.middleware';
import { validateMiddleware } from '../../middleware/validate.middleware';
import * as classesController from './classes.controller';
import { CreateClassBodySchema, UpdateClassBodySchema } from './classes.schemas';
import { AuditEntityType } from '@prisma/client';

const router = Router();
router.use(authMiddleware);

router.get('/', authenticated, classesController.list);
router.post('/', adminOnly, validateMiddleware({ body: CreateClassBodySchema }), auditLogMiddleware('CLASS_CREATED', AuditEntityType.CLASS), classesController.create);
router.get('/:id', authenticated, classesController.getById);
router.put('/:id', adminOnly, validateMiddleware({ body: UpdateClassBodySchema }), auditLogMiddleware('CLASS_UPDATED', AuditEntityType.CLASS), classesController.update);
router.get('/:id/students', authenticated, classesController.getStudents);
router.get('/:id/subjects', authenticated, classesController.getSubjects);
router.get('/:id/timetable', authenticated, classesController.getTimetable);
router.post('/:id/subjects', adminOnly, auditLogMiddleware('SUBJECT_CREATED', AuditEntityType.SUBJECT), classesController.createSubject);

export default router;
