// Schüler-Routen
// Lehrperson: nur eigene Schüler lesen
// Abteilungsleitung: vollzugriff

import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminOnly, authenticated } from '../../middleware/role.middleware';
import { auditLogMiddleware } from '../../middleware/auditLog.middleware';
import { validateMiddleware } from '../../middleware/validate.middleware';
import * as studentsController from './students.controller';
import { CreateStudentBodySchema, UpdateStudentBodySchema } from './students.schemas';
import { AuditEntityType } from '@prisma/client';

const router = Router();
router.use(authMiddleware);

router.get('/', authenticated, studentsController.list);
router.post('/', adminOnly, validateMiddleware({ body: CreateStudentBodySchema }), auditLogMiddleware('STUDENT_CREATED', AuditEntityType.STUDENT), studentsController.create);
router.get('/:id', authenticated, studentsController.getById);
router.put('/:id', adminOnly, validateMiddleware({ body: UpdateStudentBodySchema }), auditLogMiddleware('STUDENT_UPDATED', AuditEntityType.STUDENT), studentsController.update);
router.patch('/:id/deactivate', adminOnly, auditLogMiddleware('STUDENT_DEACTIVATED', AuditEntityType.STUDENT), studentsController.deactivate);
router.patch('/:id/activate', adminOnly, auditLogMiddleware('STUDENT_ACTIVATED', AuditEntityType.STUDENT), studentsController.activate);
router.get('/:id/absences', authenticated, studentsController.getAbsences);
router.get('/:id/grades', authenticated, studentsController.getGrades);

export default router;
