// Prisma-Client Singleton
// Verhindert mehrfache DB-Verbindungen bei Hot-Reload in der Entwicklung

import { PrismaClient } from '@prisma/client';
import { env } from './env';

// Globale Variable für Entwicklungs-Hot-Reload
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const createPrismaClient = (): PrismaClient => {
  return new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });
};

// Singleton-Pattern: In Entwicklung globale Instanz nutzen
export const prisma: PrismaClient =
  env.NODE_ENV === 'production'
    ? createPrismaClient()
    : (global.__prisma ?? (global.__prisma = createPrismaClient()));
