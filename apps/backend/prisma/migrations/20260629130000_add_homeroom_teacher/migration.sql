-- Klassenlehrer-Zuweisung: Lehrer sehen nur ihre zugewiesene Klasse
ALTER TABLE `classes` ADD COLUMN `homeroomTeacherId` VARCHAR(191) NULL;

CREATE INDEX `classes_homeroomTeacherId_idx` ON `classes`(`homeroomTeacherId`);

ALTER TABLE `classes` ADD CONSTRAINT `classes_homeroomTeacherId_fkey` FOREIGN KEY (`homeroomTeacherId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
