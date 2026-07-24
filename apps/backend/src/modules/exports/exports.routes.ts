// Export-Routen (nur Leiter)

import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminOnly } from '../../middleware/role.middleware';
import * as exportsController from './exports.controller';

const router = Router();
router.use(authMiddleware, adminOnly);

router.get('/absences/excel', exportsController.absencesExcel);
router.get('/absences/csv', exportsController.absencesExcel); // Alias für ältere Clients
router.get('/grades/excel', exportsController.gradesExcel);
router.get('/grades/pdf', exportsController.gradesPdf);
router.get('/timetable/pdf', exportsController.timetablePdf);
router.get('/statistics/promotion', exportsController.promotionCsv);
router.get('/audit-log', exportsController.auditLogCsv);

export default router;
