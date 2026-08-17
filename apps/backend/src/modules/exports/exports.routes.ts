// Export-Routen (nur Abteilungsleitung)

import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminOnly } from '../../middleware/role.middleware';
import * as exportsController from './exports.controller';

const router = Router();
router.use(authMiddleware, adminOnly);

router.get('/absences/csv', exportsController.absencesCsv);
router.get('/grades/excel', exportsController.gradesExcel);
router.get('/statistics/promotion', exportsController.promotionReport);
router.get('/audit-log', exportsController.auditLogCsv);

export default router;
