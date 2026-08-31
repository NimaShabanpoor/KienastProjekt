// User-Controller: HTTP-Handler (nur Abteilungsleitung)

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import * as usersService from './users.service';
import { getPaginationParams } from '../../utils/pagination';
import { CreateUserBodySchema, UpdateUserBodySchema } from './users.schemas';

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page, limit } = getPaginationParams({
      page: Number(req.query['page']) || undefined,
      limit: Number(req.query['limit']) || undefined,
    });
    const role = req.query['role'] as Role | undefined;
    const isActive = req.query['isActive'] !== undefined
      ? req.query['isActive'] === 'true'
      : undefined;
    const search = (req.query['search'] as string | undefined)?.trim() || undefined;
    const result = await usersService.listUsers({ page, limit, role, isActive, search });
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
    // Body wurde bereits von validateMiddleware(CreateUserBodySchema) validiert
    const input = req.body as z.infer<typeof CreateUserBodySchema>;
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
    // Body wurde bereits von validateMiddleware(UpdateUserBodySchema) validiert
    const user = await usersService.updateUser(id, req.body as z.infer<typeof UpdateUserBodySchema>);
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
