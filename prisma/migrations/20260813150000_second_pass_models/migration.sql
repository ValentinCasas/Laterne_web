-- AlterTable second pass: landing sections, invoice design, loyalty rewards
ALTER TABLE `brandsettings` ADD COLUMN `landingSections` JSON NULL;

ALTER TABLE `invoicesettings`
  ADD COLUMN `templatePreset` VARCHAR(30) NOT NULL DEFAULT 'classic',
  ADD COLUMN `design` JSON NULL;

-- CreateTable loyaltyreward
CREATE TABLE `loyaltyreward` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `name` VARCHAR(140) NOT NULL,
  `pointsNeeded` INTEGER NOT NULL,
  `description` VARCHAR(500) NULL,
  `benefitType` VARCHAR(30) NOT NULL DEFAULT 'discount',
  `value` VARCHAR(120) NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `loyaltyreward_tenantId_active_sortOrder_idx` (`tenantId`, `active`, `sortOrder`),
  CONSTRAINT `loyaltyreward_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
