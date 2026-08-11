CREATE TABLE `productoptiongroup` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `kind` VARCHAR(20) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `required` BOOLEAN NOT NULL DEFAULT false,
    `minSelections` INTEGER NOT NULL DEFAULT 0,
    `maxSelections` INTEGER NOT NULL DEFAULT 1,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `productoptiongroup_tenantId_productId_kind_sortOrder_idx`(`tenantId`, `productId`, `kind`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `productoptiongroup` ADD CONSTRAINT `productoptiongroup_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `productoptiongroup` ADD CONSTRAINT `productoptiongroup_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `productvariant` ADD COLUMN `groupId` INTEGER NULL;
ALTER TABLE `productextra` ADD COLUMN `groupId` INTEGER NULL;
ALTER TABLE `productvariant` ADD INDEX `productvariant_groupId_idx`(`groupId`);
ALTER TABLE `productextra` ADD INDEX `productextra_groupId_idx`(`groupId`);
ALTER TABLE `productvariant` ADD CONSTRAINT `productvariant_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `productoptiongroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `productextra` ADD CONSTRAINT `productextra_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `productoptiongroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
