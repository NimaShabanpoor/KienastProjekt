// Unit Tests für die rollenbasierte Zugriffskontrolle (echter Produktionscode)

import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { roleMiddleware, adminOnly, authenticated } from '../../src/middleware/role.middleware';

function mockRes() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res) as unknown as Response['status'];
  res.json = vi.fn().mockReturnValue(res) as unknown as Response['json'];
  return res;
}

describe('roleMiddleware', () => {
  it('lehnt nicht authentifizierte Anfragen mit 401 ab', () => {
    const req = {} as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    adminOnly(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('lehnt eine Lehrperson auf einer Admin-Route mit 403 ab', () => {
    const req = { user: { id: 'u1', email: '', role: Role.LEHRPERSON } } as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    adminOnly(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('lässt die Abteilungsleitung auf einer Admin-Route durch', () => {
    const req = { user: { id: 'u2', email: '', role: Role.ABTEILUNGSLEITUNG } } as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    adminOnly(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('lässt beide Rollen auf einer "authenticated"-Route durch', () => {
    for (const role of [Role.LEHRPERSON, Role.ABTEILUNGSLEITUNG]) {
      const req = { user: { id: 'u', email: '', role } } as Request;
      const res = mockRes();
      const next = vi.fn() as NextFunction;

      authenticated(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    }
  });

  it('respektiert eine benutzerdefinierte Rollenliste', () => {
    const onlyAdmin = roleMiddleware([Role.ABTEILUNGSLEITUNG]);
    const req = { user: { id: 'u', email: '', role: Role.LEHRPERSON } } as Request;
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    onlyAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});
