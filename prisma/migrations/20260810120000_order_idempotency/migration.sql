-- CreateTable
CREATE TABLE `orderidempotency` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `orderId` INTEGER NOT NULL,
    `key` VARCHAR(120) NOT NULL,
    `reference` VARCHAR(24) NOT NULL,
    `token` VARCHAR(120) NOT NULL,
    `total` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `orderidempotency_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `orderidempotency_tenantId_key_key`(`tenantId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `orderidempotency` ADD CONSTRAINT `orderidempotency_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orderidempotency` ADD CONSTRAINT `orderidempotency_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `customerorder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
