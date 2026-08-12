ALTER TABLE `reservation` ADD COLUMN `branchId` INTEGER NULL;
ALTER TABLE `reservationblock` ADD COLUMN `branchId` INTEGER NULL;
ALTER TABLE `branch` ADD COLUMN `inheritLanding` BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE `branchproduct` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `branchId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `priceOverride` DECIMAL(12,2) NULL,
    `availabilityOverride` VARCHAR(30) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `branchproduct_branchId_productId_key`(`branchId`, `productId`),
    INDEX `branchproduct_tenantId_branchId_active_sortOrder_idx`(`tenantId`, `branchId`, `active`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `branchlicense` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `branchId` INTEGER NOT NULL,
    `status` VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    `startsAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `currentPeriodEnd` DATETIME(3) NULL,
    `graceUntil` DATETIME(3) NULL,
    `priceOverride` DECIMAL(14,2) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `branchlicense_tenantId_branchId_key`(`tenantId`, `branchId`),
    INDEX `branchlicense_tenantId_status_currentPeriodEnd_idx`(`tenantId`, `status`, `currentPeriodEnd`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `reservation` ADD INDEX `reservation_tenant_branch_date_idx`(`tenantId`, `branchId`, `reservationDate`, `reservationTime`);
ALTER TABLE `reservationblock` ADD INDEX `reservationblock_tenant_branch_date_idx`(`tenantId`, `branchId`, `startDate`, `endDate`);
ALTER TABLE `reservation` ADD CONSTRAINT `reservation_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `reservationblock` ADD CONSTRAINT `reservationblock_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `branchproduct` ADD CONSTRAINT `branchproduct_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `branchproduct` ADD CONSTRAINT `branchproduct_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `branchproduct` ADD CONSTRAINT `branchproduct_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `branchlicense` ADD CONSTRAINT `branchlicense_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `branchlicense` ADD CONSTRAINT `branchlicense_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE `customerorder` AS `o` INNER JOIN `diningtable` AS `t` ON `t`.`id` = `o`.`tableId` SET `o`.`branchId` = `t`.`branchId` WHERE `o`.`branchId` IS NULL AND `t`.`branchId` IS NOT NULL;
UPDATE `customerorder` AS `o` INNER JOIN `branch` AS `b` ON `b`.`tenantId` = `o`.`tenantId` AND `b`.`isPrimary` = true SET `o`.`branchId` = `b`.`id` WHERE `o`.`branchId` IS NULL;
UPDATE `invoicerecord` AS `i` INNER JOIN `customerorder` AS `o` ON `o`.`id` = `i`.`orderId` SET `i`.`branchId` = `o`.`branchId` WHERE `i`.`branchId` IS NULL;
UPDATE `reservation` AS `r` INNER JOIN `branch` AS `b` ON `b`.`tenantId` = `r`.`tenantId` AND `b`.`isPrimary` = true SET `r`.`branchId` = `b`.`id` WHERE `r`.`branchId` IS NULL;
UPDATE `reservationblock` AS `r` INNER JOIN `branch` AS `b` ON `b`.`tenantId` = `r`.`tenantId` AND `b`.`isPrimary` = true SET `r`.`branchId` = `b`.`id` WHERE `r`.`branchId` IS NULL;

INSERT INTO `branchproduct` (`tenantId`, `branchId`, `productId`, `updatedAt`)
SELECT `p`.`tenantId`, `b`.`id`, `p`.`id`, CURRENT_TIMESTAMP(3)
FROM `product` AS `p` INNER JOIN `branch` AS `b` ON `b`.`tenantId` = `p`.`tenantId`
WHERE NOT EXISTS (SELECT 1 FROM `branchproduct` AS `bp` WHERE `bp`.`branchId` = `b`.`id` AND `bp`.`productId` = `p`.`id`);

INSERT INTO `branchlicense` (`tenantId`, `branchId`, `status`, `updatedAt`)
SELECT `b`.`tenantId`, `b`.`id`, 'ACTIVE', CURRENT_TIMESTAMP(3)
FROM `branch` AS `b`
WHERE NOT EXISTS (SELECT 1 FROM `branchlicense` AS `bl` WHERE `bl`.`branchId` = `b`.`id`);
