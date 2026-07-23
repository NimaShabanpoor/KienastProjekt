// Noten-Routen

import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminOnly, authenticated } from '../../middleware/role.middleware';
import { auditLogMiddleware } from '../../middleware/auditLog.middleware';
import { validateMiddleware } from '../../middleware/validate.middleware';
import * as gradesController from './grades.controller';
import {
  CreateGradeBodySchema,
  CreateGradeBatchBodySchema,
  CorrectGradeBodySchema,
  CreateGradeCategoryBodySchema,
} from './grades.schemas';
import { AuditEntityType } from '@prisma/client';

const router = Router();
router.use(authMiddleware);

router.get('/', authenticated, gradesController.list);
router.get('/my-subjects', authenticated, gradesController.mySubjects);
router.post(
  '/',
  authenticated,
  validateMiddleware({ body: CreateGradeBodySchema }),
  auditLogMiddleware('GRADE_CREATED', AuditEntityType.GRADE),
  gradesController.create
);
router.post(
  '/batch',
  authenticated,
  validateMiddleware({ body: CreateGradeBatchBodySchema }),
  auditLogMiddleware('GRADE_CREATED', AuditEntityType.GRADE),
  gradesController.createBatch
);
router.patch(
  '/:id/correct',
  adminOnly,
  validateMiddleware({ body: CorrectGradeBodySchema }),
  auditLogMiddleware('GRADE_CORRECTED', AuditEntityType.GRADE_CORRECTION),
  gradesController.correct
);
router.get('/:id/corrections', adminOnly, gradesController.getCorrections);
router.get('/average', authenticated, gradesController.getAverage);
router.get('/promotion-check', adminOnly, gradesController.getPromotionCheck);

router.get('/subjects/:subjectId/categories', authenticated, gradesController.getCategories);
router.post(
  '/subjects/:subjectId/categories',
  adminOnly,
  validateMiddleware({ body: CreateGradeCategoryBodySchema }),
  gradesController.createCategory
);

export default router;
