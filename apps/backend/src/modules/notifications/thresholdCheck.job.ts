// Cron-Job: Tägliche Prüfung der Absenzen-Schwellenwerte
// Läuft jeden Tag um 07:00 Uhr
// Benachrichtigt alle Abteilungsleitungen bei Überschreitung

import cron from 'node-cron';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AbsenceStatus, Role } from '@prisma/client';
import { ABSENCE_CONSTANTS } from '../../config/constants';

export function startThresholdCheckJob(): void {
  cron.schedule('0 7 * * *', async () => {
    logger.info('Schwellenwert-Check gestartet');

    try {
      // Konfigurierten Schwellenwert laden (Fallback: ENV-Variable)
      const config = await prisma.config.findUnique({
        where: { key: 'ABSENCE_THRESHOLD' },
      });
      const threshold = config
        ? (JSON.parse(config.value) as number)
        : env.ABSENCE_THRESHOLD;

      // Schüler mit >= threshold unentschuldigten Absenzen
      const grouped = await prisma.absence.groupBy({
        by: ['studentId'],
        where: { status: AbsenceStatus.UNENTSCHULDIGT },
        _count: { id: true },
        having: { id: { _count: { gte: threshold } } },
      });

      for (const { studentId, _count } of grouped) {
        // Cooldown prüfen: keine Benachrichtigung wenn in den letzten 7 Tagen bereits gesendet
        const cooldownDate = new Date(
          Date.now() - ABSENCE_CONSTANTS.NOTIFICATION_COOLDOWN_MS
        );
        const existing = await prisma.notification.findFirst({
          where: {
            type: 'ABSENCE_THRESHOLD',
            entityId: studentId,
            createdAt: { gte: cooldownDate },
          },
        });

        if (existing) continue;

        const student = await prisma.student.findUnique({
          where: { id: studentId },
          select: { firstName: true, lastName: true },
        });

        if (!student) continue;

        // Alle Abteilungsleitungen benachrichtigen
        const admins = await prisma.user.findMany({
          where: { role: Role.ABTEILUNGSLEITUNG, isActive: true },
          select: { id: true },
        });

        await prisma.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            type: 'ABSENCE_THRESHOLD',
            title: 'Absenzen-Alarm',
            message: `${student.firstName} ${student.lastName} hat ${_count.id} unentschuldigte Absenzen (Schwellenwert: ${threshold}).`,
            entityType: 'STUDENT',
            entityId: studentId,
          })),
        });

        logger.warn('Absenzen-Schwellenwert überschritten', {
          studentId,
          count: _count.id,
          threshold,
        });
      }

      logger.info('Schwellenwert-Check abgeschlossen', { checked: grouped.length });
    } catch (err) {
      logger.error('Schwellenwert-Check fehlgeschlagen', { err });
    }
  });

  logger.info('Schwellenwert-Cron-Job registriert (täglich 07:00)');
}
