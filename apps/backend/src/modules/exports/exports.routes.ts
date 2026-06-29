// Export-Routen (nur Leiter)

import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminOnly } from '../../middleware/role.middleware';
import * as exportsController from './exports.controller';

const router = Router();
router.use(authMiddleware, adminOnly);

router.get('/absences/csv', exportsController.absencesCsv);
router.get('/grades/excel', exportsController.gradesCsv);
router.get('/statistics/promotion', exportsController.promotionCsv);
router.get('/audit-log', exportsController.auditLogCsv);

export default router;
