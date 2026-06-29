-- Test-Lektionen und Arztzeugnis bei Absenzen
ALTER TABLE `lessons` ADD COLUMN `isTest` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `absences` ADD COLUMN `hasMedicalCertificate` BOOLEAN NULL;
ALTER TABLE `absences` ADD COLUMN `medicalCertificatePath` VARCHAR(191) NULL;
ALTER TABLE `absences` ADD COLUMN `medicalCertificateFileName` VARCHAR(191) NULL;
ALTER TABLE `absences` ADD COLUMN `medicalCertificateUploadedAt` DATETIME(3) NULL;
