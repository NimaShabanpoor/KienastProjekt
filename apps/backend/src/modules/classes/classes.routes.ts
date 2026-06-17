// Klassen-Routen

import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminOnly, authenticated } from '../../middleware/role.middleware';
import { auditLogMiddleware } from '../../middleware/auditLog.middleware';
import * as classesController from './classes.controller';
import { AuditEntityType } from '@prisma/client';

const router = Router();
router.use(authMiddleware);

router.get('/', authenticated, classesController.list);
router.post('/', adminOnly, auditLogMiddleware('CLASS_CREATED', AuditEntityType.CLASS), classesController.create);
router.get('/:id', authenticated, classesController.getById);
router.put('/:id', adminOnly, auditLogMiddleware('CLASS_UPDATED', AuditEntityType.CLASS), classesController.update);
router.get('/:id/students', authenticated, classesController.getStudents);
router.get('/:id/subjects', authenticated, classesController.getSubjects);
router.get('/:id/timetable', authenticated, classesController.getTimetable);

export default router;
