// Auth-Controller: HTTP-Handler für Auth-Endpunkte
// Delegiert Geschäftslogik an auth.service.ts

import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { env } from '../../config/env';

// Cookie-Optionen für Refresh-Token
// Cross-Origin (Vercel + Railway): sameSite=none + secure
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: (env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/v1/auth',
};

// POST /api/v1/auth/login
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const result = await authService.login(email, password);

    if (result.requiresTOTP) {
      // 2FA erforderlich – Temp-Token zurückgeben
      res.status(200).json({
        data: {
          requiresTOTP: true,
          tempToken: result.tempToken,
        },
      });
      return;
    }

    // Refresh-Token als httpOnly Cookie setzen
    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

    res.status(200).json({
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/auth/2fa/verify
export const verify2FA = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { tempToken, totpCode } = req.body as { tempToken: string; totpCode: string };
    const result = await authService.verify2FA(tempToken, totpCode);

    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

    res.status(200).json({
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/auth/2fa/setup
export const setup2FA = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await authService.setup2FA(req.user!.id);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/auth/2fa/confirm
export const confirm2FA = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { totpCode } = req.body as { totpCode: string };
    const result = await authService.confirm2FA(req.user!.id, totpCode);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/auth/refresh
export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Refresh-Token aus httpOnly Cookie lesen
    const refreshToken = req.cookies['refreshToken'] as string | undefined;

    if (!refreshToken) {
      res.status(401).json({
        error: 'Kein Refresh-Token vorhanden.',
        code: 'NO_REFRESH_TOKEN',
      });
      return;
    }

    const result = await authService.refreshAccessToken(refreshToken);

    // Neuen Refresh-Token setzen (Token Rotation)
    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

    res.status(200).json({ data: { accessToken: result.accessToken } });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/auth/logout
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user) {
      await authService.logout(req.user.id);
    }

    // Cookie löschen
    res.clearCookie('refreshToken', { path: '/api/v1/auth' });

    res.status(200).json({ data: { message: 'Erfolgreich abgemeldet.' } });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/auth/me
export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await authService.getMe(req.user!.id);
    res.status(200).json({ data: user });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/auth/change-password
export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };
    await authService.changePassword(req.user!.id, currentPassword, newPassword);
    res.clearCookie('refreshToken', { path: '/api/v1/auth' });
    res.status(200).json({ data: { message: 'Passwort erfolgreich geändert.' } });
  } catch (err) {
    next(err);
  }
};
