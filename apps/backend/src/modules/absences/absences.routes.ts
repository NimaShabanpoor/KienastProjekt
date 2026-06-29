// Absenzen-Routen

import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminOnly, authenticated } from '../../middleware/role.middleware';
import { auditLogMiddleware } from '../../middleware/auditLog.middleware';
import { validateMiddleware } from '../../middleware/validate.middleware';
import * as absencesController from './absences.controller';
import { CreateAbsenceBatchBodySchema, UpdateAbsenceBodySchema } from './absences.schemas';
import { AuditEntityType } from '@prisma/client';
import { medicalCertificateUpload } from '../../config/upload';

const router = Router();
router.use(authMiddleware);

router.get('/', adminOnly, absencesController.list);
router.post('/', authenticated, validateMiddleware({ body: CreateAbsenceBatchBodySchema }), auditLogMiddleware('ABSENCE_CREATED', AuditEntityType.ABSENCE), absencesController.createBatch);
router.patch(
  '/:id/medical-certificate',
  adminOnly,
  medicalCertificateUpload.single('file'),
  auditLogMiddleware('MEDICAL_CERTIFICATE_UPLOADED', AuditEntityType.MEDICAL_CERTIFICATE),
  absencesController.uploadMedicalCertificate
);
router.get('/:id/medical-certificate', adminOnly, absencesController.downloadMedicalCertificate);
router.put('/:id', adminOnly, validateMiddleware({ body: UpdateAbsenceBodySchema }), auditLogMiddleware('ABSENCE_UPDATED', AuditEntityType.ABSENCE), absencesController.update);
router.get('/stats', adminOnly, absencesController.getStats);
router.get('/threshold-alerts', adminOnly, absencesController.getAlerts);

export default router;
