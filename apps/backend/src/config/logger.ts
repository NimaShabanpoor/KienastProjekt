// Winston-Logger – Konsole in Produktion (Railway-Logs), Dateien lokal

import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { env } from './env';

const LOG_TIMESTAMP_FORMAT = 'YYYY-MM-DD HH:mm:ss';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: LOG_TIMESTAMP_FORMAT }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: LOG_TIMESTAMP_FORMAT }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${String(timestamp)} [${level}] ${String(message)}${metaStr}`;
  })
);

const transports: winston.transport[] = [];

if (env.NODE_ENV === 'production') {
  transports.push(new winston.transports.Console({ format: logFormat }));
} else {
  try {
    fs.mkdirSync(env.LOG_FILE_PATH, { recursive: true });
    transports.push(
      new winston.transports.File({
        filename: path.join(env.LOG_FILE_PATH, 'error.log'),
        level: 'error',
        format: logFormat,
      }),
      new winston.transports.File({
        filename: path.join(env.LOG_FILE_PATH, 'combined.log'),
        format: logFormat,
      })
    );
  } catch {
    // Fallback wenn Log-Ordner nicht beschreibbar
  }
  transports.push(new winston.transports.Console({ format: consoleFormat }));
}

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  transports,
});

export const auditLogger = winston.createLogger({
  level: 'info',
  transports:
    env.NODE_ENV === 'production'
      ? [new winston.transports.Console({ format: logFormat })]
      : [
          new winston.transports.File({
            filename: path.join(env.LOG_FILE_PATH, 'audit.log'),
            format: logFormat,
          }),
        ],
});
