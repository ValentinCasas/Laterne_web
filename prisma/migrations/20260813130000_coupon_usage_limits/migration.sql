ALTER TABLE `promotion` ADD COLUMN `usageLimit` INTEGER NULL;
ALTER TABLE `promotion` ADD COLUMN `perCustomerLimit` INTEGER NULL;
ALTER TABLE `promotion` ADD COLUMN `usedCount` INTEGER NOT NULL DEFAULT 0;

CREATE TABLE `promotionusage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `promotionId` INTEGER NOT NULL,
    `orderId` INTEGER NOT NULL,
    `customerId` INTEGER NULL,
    `customerEmail` VARCHAR(190) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `promotionusage_orderId_key`(`orderId`),
    INDEX `promotionusage_promotionId_customerEmail_idx`(`promotionId`, `customerEmail`),
    INDEX `promotionusage_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `promotionusage` ADD CONSTRAINT `promotionusage_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `promotionusage` ADD CONSTRAINT `promotionusage_promotionId_fkey` FOREIGN KEY (`promotionId`) REFERENCES `promotion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `promotionusage` ADD CONSTRAINT `promotionusage_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `customerorder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `promotionusage` ADD CONSTRAINT `promotionusage_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `loyaltycustomer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
