// Auth-Routen
// Rate Limiting auf Login-Endpunkt zum Schutz vor Brute-Force

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from './auth.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validateMiddleware } from '../../middleware/validate.middleware';
import {
  LoginBodySchema,
  TwoFactorVerifyBodySchema,
  TwoFactorConfirmBodySchema,
} from './auth.schemas';

const router = Router();

// Login-Rate-Limiter: max. 5 Versuche pro 15 Minuten pro IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Zu viele Anmeldeversuche. Bitte 15 Minuten warten.',
    code: 'RATE_LIMITED',
  },
});

// Öffentliche Routen (kein Auth erforderlich)
router.post(
  '/login',
  loginLimiter,
  validateMiddleware({ body: LoginBodySchema }),
  authController.login
);

router.post(
  '/2fa/verify',
  loginLimiter, // Auch 2FA-Verify rate-limiten
  validateMiddleware({ body: TwoFactorVerifyBodySchema }),
  authController.verify2FA
);

router.post('/refresh', authController.refresh);

// Geschützte Routen (Auth erforderlich)
router.post(
  '/2fa/setup',
  authMiddleware,
  authController.setup2FA
);

router.post(
  '/2fa/confirm',
  authMiddleware,
  validateMiddleware({ body: TwoFactorConfirmBodySchema }),
  authController.confirm2FA
);

router.post('/logout', authMiddleware, authController.logout);

router.get('/me', authMiddleware, authController.getMe);

export default router;
