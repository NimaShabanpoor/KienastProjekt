// User-Service: CRUD für Benutzer (nur Abteilungsleitung)
// Soft Delete: isActive=false statt hartem Löschen

import bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler.middleware';
import { BCRYPT_ROUNDS, PAGINATION } from '../../config/constants';

interface CreateUserInput {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  password: string;
}

interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: Role;
}

export async function listUsers(params: {
  page: number;
  limit: number;
  role?: Role;
  isActive?: boolean;
  search?: string;
}) {
  const { page = PAGINATION.DEFAULT_PAGE, limit = PAGINATION.DEFAULT_LIMIT, role, isActive, search } = params;
  const skip = (page - 1) * limit;

  // Deaktivieren ≠ Löschen: inaktive Benutzer bleiben in der Liste sichtbar
  const where = {
    ...(role !== undefined && { role }),
    ...(isActive !== undefined ? { isActive } : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        totpEnabled: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: [{ isActive: 'desc' }, { lastName: 'asc' }],
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      totpEnabled: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user) throw new ApiError('Benutzer nicht gefunden.', 'USER_NOT_FOUND', 404);
  return user;
}

export async function createUser(input: CreateUserInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ApiError(
      'Ein Benutzer mit dieser E-Mail-Adresse existiert bereits.',
      'EMAIL_ALREADY_EXISTS',
      409
    );
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  return prisma.user.create({
    data: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      passwordHash,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      totpEnabled: true,
      createdAt: true,
    },
  });
}

export async function updateUser(id: string, input: UpdateUserInput) {
  await getUserById(id);

  if (input.email) {
    const existing = await prisma.user.findFirst({
      where: { email: input.email, NOT: { id } },
    });
    if (existing) {
      throw new ApiError('E-Mail-Adresse bereits vergeben.', 'EMAIL_ALREADY_EXISTS', 409);
    }
  }

  // Nur explizit erlaubte Felder aktualisieren (kein Mass-Assignment)
  const data: UpdateUserInput = {};
  if (input.firstName !== undefined) data.firstName = input.firstName;
  if (input.lastName !== undefined) data.lastName = input.lastName;
  if (input.email !== undefined) data.email = input.email;
  if (input.role !== undefined) data.role = input.role;

  return prisma.user.update({
    where: { id },
    data,
    select: {
      id: true, email: true, firstName: true, lastName: true,
      role: true, isActive: true, updatedAt: true,
    },
  });
}

export async function deactivateUser(id: string, requestingUserId: string) {
  if (id === requestingUserId) {
    throw new ApiError(
      'Du kannst deinen eigenen Account nicht deaktivieren.',
      'CANNOT_DEACTIVATE_SELF',
      400
    );
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new ApiError('Benutzer nicht gefunden.', 'USER_NOT_FOUND', 404);

  // Nur inaktiv setzen – kein Soft-Delete / deletedAt
  return prisma.user.update({
    where: { id },
    data: { isActive: false, deletedAt: null },
    select: { id: true, isActive: true },
  });
}

export async function activateUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new ApiError('Benutzer nicht gefunden.', 'USER_NOT_FOUND', 404);

  return prisma.user.update({
    where: { id },
    data: { isActive: true, deletedAt: null },
    select: { id: true, isActive: true },
  });
}

export async function reset2FA(id: string) {
  await getUserById(id);
  return prisma.user.update({
    where: { id },
    data: { totpSecret: null, totpEnabled: false, backupCodes: null },
    select: { id: true, totpEnabled: true },
  });
}
