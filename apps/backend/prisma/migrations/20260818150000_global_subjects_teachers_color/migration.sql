-- Module schulweit, mehrere Lehrpersonen, Farbe, Lektion mit Klasse + Lehrperson

ALTER TABLE `subjects` ADD COLUMN `color` VARCHAR(191) NOT NULL DEFAULT '#C8102E';

CREATE TABLE `subject_teachers` (
    `subjectId` VARCHAR(191) NOT NULL,
    `teacherId` VARCHAR(191) NOT NULL,

    INDEX `subject_teachers_teacherId_idx`(`teacherId`),
    PRIMARY KEY (`subjectId`, `teacherId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT IGNORE INTO `subject_teachers` (`subjectId`, `teacherId`)
SELECT `id`, `teacherId` FROM `subjects`;

ALTER TABLE `lessons` ADD COLUMN `classId` VARCHAR(191) NULL;
ALTER TABLE `lessons` ADD COLUMN `teacherId` VARCHAR(191) NULL;

UPDATE `lessons` `l`
INNER JOIN `subjects` `s` ON `l`.`subjectId` = `s`.`id`
SET `l`.`classId` = `s`.`classId`, `l`.`teacherId` = `s`.`teacherId`;

DELETE FROM `lessons` WHERE `classId` IS NULL OR `teacherId` IS NULL;

CREATE TABLE `_subject_keep` (
    `name` VARCHAR(191) NOT NULL,
    `keepId` VARCHAR(191) NOT NULL,
    PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `_subject_keep` (`name`, `keepId`)
SELECT `name`, MIN(`id`) FROM `subjects` GROUP BY `name`;

INSERT IGNORE INTO `subject_teachers` (`subjectId`, `teacherId`)
SELECT `k`.`keepId`, `st`.`teacherId`
FROM `subject_teachers` `st`
INNER JOIN `subjects` `s` ON `s`.`id` = `st`.`subjectId`
INNER JOIN `_subject_keep` `k` ON `k`.`name` = `s`.`name`
WHERE `st`.`subjectId` <> `k`.`keepId`;

UPDATE `lessons` `l`
INNER JOIN `subjects` `s` ON `l`.`subjectId` = `s`.`id`
INNER JOIN `_subject_keep` `k` ON `k`.`name` = `s`.`name`
SET `l`.`subjectId` = `k`.`keepId`
WHERE `l`.`subjectId` <> `k`.`keepId`;

UPDATE `timetable_slots` `t`
INNER JOIN `subjects` `s` ON `t`.`subjectId` = `s`.`id`
INNER JOIN `_subject_keep` `k` ON `k`.`name` = `s`.`name`
SET `t`.`subjectId` = `k`.`keepId`
WHERE `t`.`subjectId` <> `k`.`keepId`;

UPDATE `timetable_exceptions` `e`
INNER JOIN `subjects` `s` ON `e`.`subjectId` = `s`.`id`
INNER JOIN `_subject_keep` `k` ON `k`.`name` = `s`.`name`
SET `e`.`subjectId` = `k`.`keepId`
WHERE `e`.`subjectId` IS NOT NULL AND `e`.`subjectId` <> `k`.`keepId`;

UPDATE `grades` `g`
INNER JOIN `subjects` `s` ON `g`.`subjectId` = `s`.`id`
INNER JOIN `_subject_keep` `k` ON `k`.`name` = `s`.`name`
SET `g`.`subjectId` = `k`.`keepId`
WHERE `g`.`subjectId` <> `k`.`keepId`;

CREATE TABLE `_cat_keep` (
    `dupId` VARCHAR(191) NOT NULL,
    `keepId` VARCHAR(191) NOT NULL,
    PRIMARY KEY (`dupId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `_cat_keep` (`dupId`, `keepId`)
SELECT `dup`.`id`, `keeper`.`id`
FROM `grade_categories` `dup`
INNER JOIN `subjects` `s` ON `s`.`id` = `dup`.`subjectId`
INNER JOIN `_subject_keep` `k` ON `k`.`name` = `s`.`name` AND `k`.`keepId` <> `s`.`id`
INNER JOIN `grade_categories` `keeper`
  ON `keeper`.`subjectId` = `k`.`keepId` AND `keeper`.`name` = `dup`.`name`;

UPDATE `grades` `g`
INNER JOIN `_cat_keep` `m` ON `g`.`categoryId` = `m`.`dupId`
SET `g`.`categoryId` = `m`.`keepId`;

DELETE `gc` FROM `grade_categories` `gc`
INNER JOIN `_cat_keep` `m` ON `gc`.`id` = `m`.`dupId`;

UPDATE `grade_categories` `gc`
INNER JOIN `subjects` `s` ON `gc`.`subjectId` = `s`.`id`
INNER JOIN `_subject_keep` `k` ON `k`.`name` = `s`.`name`
SET `gc`.`subjectId` = `k`.`keepId`
WHERE `gc`.`subjectId` <> `k`.`keepId`;

DELETE `st` FROM `subject_teachers` `st`
INNER JOIN `subjects` `s` ON `s`.`id` = `st`.`subjectId`
INNER JOIN `_subject_keep` `k` ON `k`.`name` = `s`.`name`
WHERE `s`.`id` <> `k`.`keepId`;

DELETE `s` FROM `subjects` `s`
INNER JOIN `_subject_keep` `k` ON `k`.`name` = `s`.`name`
WHERE `s`.`id` <> `k`.`keepId`;

DROP TABLE `_cat_keep`;
DROP TABLE `_subject_keep`;

ALTER TABLE `lessons` MODIFY `classId` VARCHAR(191) NOT NULL;
ALTER TABLE `lessons` MODIFY `teacherId` VARCHAR(191) NOT NULL;

ALTER TABLE `subjects` DROP FOREIGN KEY `subjects_classId_fkey`;
ALTER TABLE `subjects` DROP FOREIGN KEY `subjects_teacherId_fkey`;
DROP INDEX `subjects_classId_idx` ON `subjects`;
DROP INDEX `subjects_teacherId_idx` ON `subjects`;
ALTER TABLE `subjects` DROP COLUMN `classId`;
ALTER TABLE `subjects` DROP COLUMN `teacherId`;
CREATE UNIQUE INDEX `subjects_name_key` ON `subjects`(`name`);

CREATE INDEX `lessons_classId_idx` ON `lessons`(`classId`);
CREATE INDEX `lessons_teacherId_idx` ON `lessons`(`teacherId`);

ALTER TABLE `subject_teachers` ADD CONSTRAINT `subject_teachers_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `subject_teachers` ADD CONSTRAINT `subject_teachers_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `lessons` ADD CONSTRAINT `lessons_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `classes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `lessons` ADD CONSTRAINT `lessons_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
