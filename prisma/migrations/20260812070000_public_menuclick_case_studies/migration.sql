ALTER TABLE `successcase` ADD COLUMN `isPublicCaseStudy` BOOLEAN NOT NULL DEFAULT false;
UPDATE `successcase` SET `isPublicCaseStudy` = true WHERE `status` = 'published';
