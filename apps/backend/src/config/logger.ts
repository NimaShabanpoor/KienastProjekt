// Winston-Logger-Konfiguration für SchulAdmin
// Strukturiertes Logging + separater Audit-Log-Stream

import winston from 'winston';
import path from 'path';
import { env } from './env';

// Datum-Format für Log-Einträge
const LOG_TIMESTAMP_FORMAT = 'YYYY-MM-DD HH:mm:ss';

// Benutzerdefiniertes Log-Format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: LOG_TIMESTAMP_FORMAT }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Konsolen-Format für Entwicklung (leserlicher)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: LOG_TIMESTAMP_FORMAT }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${String(timestamp)} [${level}] ${String(message)}${metaStr}`;
  })
);

// Transports konfigurieren
const transports: winston.transport[] = [
  // Fehler-Log-Datei
  new winston.transports.File({
    filename: path.join(env.LOG_FILE_PATH, 'error.log'),
    level: 'error',
    format: logFormat,
  }),
  // Allgemeiner Log
  new winston.transports.File({
    filename: path.join(env.LOG_FILE_PATH, 'combined.log'),
    format: logFormat,
  }),
];

// In Entwicklung zusätzlich auf Konsole ausgeben
if (env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  transports,
});

// Separater Audit-Logger für nDSG-konforme Protokollierung
export const auditLogger = winston.createLogger({
  level: 'info',
  transports: [
    new winston.transports.File({
      filename: path.join(env.LOG_FILE_PATH, 'audit.log'),
      format: logFormat,
    }),
  ],
});
