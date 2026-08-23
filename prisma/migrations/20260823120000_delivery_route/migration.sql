-- CreateTable
CREATE TABLE `deliveryroute` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `driverProfileId` INTEGER NOT NULL,
    `branchId` INTEGER NULL,
    `status` VARCHAR(24) NOT NULL DEFAULT 'PREPARING',
    `startedAt` DATETIME(0) NULL,
    `completedAt` DATETIME(0) NULL,
    `cancelledAt` DATETIME(0) NULL,
    `totalStops` INTEGER NOT NULL DEFAULT 0,
    `completedStops` INTEGER NOT NULL DEFAULT 0,
    `incidentCount` INTEGER NOT NULL DEFAULT 0,
    `totalDistanceM` INTEGER NULL,
    `totalDurationS` INTEGER NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL,

    INDEX `deliveryroute_tenantId_driverProfileId_status_idx`(`tenantId`, `driverProfileId`, `status`),
    INDEX `deliveryroute_tenantId_branchId_status_idx`(`tenantId`, `branchId`, `status`),
    INDEX `deliveryroute_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `orderdelivery` ADD COLUMN `routeId` INTEGER NULL,
    ADD COLUMN `routeOrder` INTEGER NULL,
    ADD INDEX `orderdelivery_routeId_routeOrder_idx`(`routeId`, `routeOrder`);

-- AddForeignKey
ALTER TABLE `deliveryroute` ADD CONSTRAINT `deliveryroute_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deliveryroute` ADD CONSTRAINT `deliveryroute_driverProfileId_fkey` FOREIGN KEY (`driverProfileId`) REFERENCES `driverprofile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deliveryroute` ADD CONSTRAINT `deliveryroute_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orderdelivery` ADD CONSTRAINT `orderdelivery_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `deliveryroute`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
