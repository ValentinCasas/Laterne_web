CREATE TABLE `authhandoff` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tokenHash` VARCHAR(64) NOT NULL,
    `userId` INTEGER NOT NULL,
    `membershipId` INTEGER NOT NULL,
    `branchId` INTEGER NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `authhandoff_tokenHash_key`(`tokenHash`),
    INDEX `authhandoff_expiresAt_usedAt_idx`(`expiresAt`, `usedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `authhandoff` ADD CONSTRAINT `authhandoff_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `authhandoff` ADD CONSTRAINT `authhandoff_membershipId_fkey` FOREIGN KEY (`membershipId`) REFERENCES `tenantmembership`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
