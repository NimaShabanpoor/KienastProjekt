// SchulAdmin – Express-App Einstiegspunkt
// Alle Middlewares, Routen und Fehlerbehandlung werden hier konfiguriert

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/database';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.middleware';
import { startThresholdCheckJob } from './modules/notifications/thresholdCheck.job';

// Routen-Importe
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import studentsRoutes from './modules/students/students.routes';
import classesRoutes from './modules/classes/classes.routes';
import lessonsRoutes from './modules/lessons/lessons.routes';
import absencesRoutes from './modules/absences/absences.routes';
import gradesRoutes from './modules/grades/grades.routes';
import exportsRoutes from './modules/exports/exports.routes';

const app = express();

// ============================================================
// SICHERHEITS-MIDDLEWARES
// ============================================================

// HTTP-Security-Header (CSP, HSTS, X-Frame-Options, etc.)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind CSS
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
  })
);

// CORS – nur erlaubte Origins
app.use(
  cors({
    origin: env.ALLOWED_ORIGINS.split(','),
    credentials: true, // Cookies erlauben (Refresh-Token)
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Cookie-Parser für Refresh-Token
app.use(cookieParser());

// JSON-Body-Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Allgemeines Rate Limiting: 200 Requests pro 15 Minuten pro IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Zu viele Anfragen. Bitte später versuchen.',
    code: 'RATE_LIMITED',
  },
});
app.use('/api', apiLimiter);

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// ============================================================
// API-ROUTEN
// ============================================================
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/students', studentsRoutes);
app.use('/api/v1/classes', classesRoutes);
app.use('/api/v1/lessons', lessonsRoutes);
app.use('/api/v1/absences', absencesRoutes);
app.use('/api/v1/grades', gradesRoutes);
app.use('/api/v1/exports', exportsRoutes);

// ============================================================
// FEHLERBEHANDLUNG
// ============================================================
app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================
// SERVER STARTEN
// ============================================================
const server = app.listen(env.PORT, () => {
  logger.info(`SchulAdmin Backend gestartet`, {
    port: env.PORT,
    env: env.NODE_ENV,
    url: `http://localhost:${env.PORT}`,
  });

  // Cron-Jobs starten
  startThresholdCheckJob();
});

// Graceful Shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM empfangen – Server wird heruntergefahren...');
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Server heruntergefahren.');
    process.exit(0);
  });
});

export default app;
