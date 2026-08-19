-- CreateTable
CREATE TABLE `receptionknowledge` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `businessName` VARCHAR(160) NULL,
    `address` TEXT NULL,
    `phone` VARCHAR(60) NULL,
    `email` VARCHAR(190) NULL,
    `website` VARCHAR(300) NULL,
    `timezone` VARCHAR(80) NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    `openingHoursText` TEXT NULL,
    `reservationPolicy` TEXT NULL,
    `faqs` JSON NULL,
    `locationInfo` JSON NULL,
    `assistantConfig` JSON NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `receptionknowledge_tenantId_key`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversationsession` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `branchId` INTEGER NULL,
    `externalId` VARCHAR(128) NOT NULL,
    `channel` VARCHAR(30) NOT NULL DEFAULT 'web',
    `customerName` VARCHAR(160) NULL,
    `status` VARCHAR(24) NOT NULL DEFAULT 'active',
    `lastActivityAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `handoffPending` BOOLEAN NOT NULL DEFAULT false,
    `handoffReason` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `conversationsession_tenantId_externalId_key`(`tenantId`, `externalId`),
    INDEX `conversationsession_tenantId_channel_status_idx`(`tenantId`, `channel`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversationmessage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sessionId` INTEGER NOT NULL,
    `role` VARCHAR(20) NOT NULL,
    `content` TEXT NOT NULL,
    `intent` VARCHAR(60) NULL,
    `actionType` VARCHAR(60) NULL,
    `reservationId` INTEGER NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `conversationmessage_sessionId_createdAt_idx`(`sessionId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `receptionknowledge` ADD CONSTRAINT `receptionknowledge_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversationsession` ADD CONSTRAINT `conversationsession_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversationsession` ADD CONSTRAINT `conversationsession_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversationmessage` ADD CONSTRAINT `conversationmessage_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `conversationsession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
