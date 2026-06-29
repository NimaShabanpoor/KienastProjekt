// Multer-Konfiguration für Arztzeugnis-Uploads

import fs from 'fs';
import path from 'path';
import multer from 'multer';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'medical-certificates');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const medicalCertificateStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const absenceId = req.params['id'] ?? 'unknown';
    const ext = path.extname(file.originalname) || '.pdf';
    cb(null, `${absenceId}_${Date.now()}${ext}`);
  },
});

export const medicalCertificateUpload = multer({
  storage: medicalCertificateStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Nur PDF oder Bilder (JPG, PNG, WebP) erlaubt.'));
    }
  },
});

export function getMedicalCertificateDir(): string {
  return UPLOAD_DIR;
}
