// User-Routen (nur Abteilungsleitung)

import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminOnly } from '../../middleware/role.middleware';
import { auditLogMiddleware } from '../../middleware/auditLog.middleware';
import { validateMiddleware } from '../../middleware/validate.middleware';
import * as usersController from './users.controller';
import { CreateUserBodySchema, UpdateUserBodySchema } from './users.schemas';
import { AuditEntityType } from '@prisma/client';

const router = Router();

// Alle User-Routen erfordern Auth + Abteilungsleitung
router.use(authMiddleware, adminOnly);

router.get('/', usersController.list);
router.post('/', validateMiddleware({ body: CreateUserBodySchema }), auditLogMiddleware('USER_CREATED', AuditEntityType.USER), usersController.create);
router.get('/:id', usersController.getById);
router.put('/:id', validateMiddleware({ body: UpdateUserBodySchema }), auditLogMiddleware('USER_UPDATED', AuditEntityType.USER), usersController.update);
router.patch('/:id/deactivate', auditLogMiddleware('USER_DEACTIVATED', AuditEntityType.USER), usersController.deactivate);
router.patch('/:id/activate', auditLogMiddleware('USER_ACTIVATED', AuditEntityType.USER), usersController.activate);
router.delete('/:id/2fa', auditLogMiddleware('USER_2FA_RESET', AuditEntityType.USER), usersController.reset2FA);

export default router;
