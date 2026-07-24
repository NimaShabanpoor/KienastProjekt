// User-Controller: HTTP-Handler (nur Abteilungsleitung)

import { Request, Response, NextFunction } from 'express';
import * as usersService from './users.service';
import { z } from 'zod';
import { Role } from '@prisma/client';

const CreateUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.nativeEnum(Role),
  password: z.string().min(12),
});

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Number(req.query['page']) || 1;
    const limit = Number(req.query['limit']) || 20;
    const role = req.query['role'] as Role | undefined;
    const isActive = req.query['isActive'] !== undefined
      ? req.query['isActive'] === 'true'
      : undefined;
    const result = await usersService.listUsers({ page, limit, role, isActive });
    res.json({ data: result.users, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
  } catch (err) { next(err); }
};

export const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await usersService.getUserById(req.params['id'] ?? '');
    res.json({ data: user });
  } catch (err) { next(err); }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const input = CreateUserSchema.parse(req.body);
    const user = await usersService.createUser(input);
    req.auditEntityId = user.id;
    req.auditNewValue = { email: user.email, role: user.role };
    res.status(201).json({ data: user });
  } catch (err) { next(err); }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] ?? '';
    const old = await usersService.getUserById(id);
    const user = await usersService.updateUser(id, req.body as Record<string, unknown>);
    req.auditEntityId = id;
    req.auditOldValue = { role: old.role };
    req.auditNewValue = { role: user.role };
    res.json({ data: user });
  } catch (err) { next(err); }
};

export const deactivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] ?? '';
    const result = await usersService.deactivateUser(id, req.user!.id);
    req.auditEntityId = id;
    res.json({ data: result });
  } catch (err) { next(err); }
};

export const activate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] ?? '';
    const result = await usersService.activateUser(id);
    req.auditEntityId = id;
    res.json({ data: result });
  } catch (err) { next(err); }
};

export const reset2FA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params['id'] ?? '';
    const result = await usersService.reset2FA(id);
    req.auditEntityId = id;
    res.json({ data: result });
  } catch (err) { next(err); }
};
