-- Inventario completo: stock reservado, referencia y transferencias en los
-- movimientos existentes, política de venta sin stock, transferencias entre
-- sucursales y sesiones de conteo físico.

ALTER TABLE `inventorystock`
  ADD COLUMN `reserved` DECIMAL(12, 3) NOT NULL DEFAULT 0;

CREATE TABLE `inventorysettings` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `stockPolicy` VARCHAR(20) NOT NULL DEFAULT 'strict',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `inventorysettings_tenantId_key` (`tenantId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `inventorysettings_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `stocktransfer` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `reference` VARCHAR(24) NOT NULL,
  `fromBranchId` INTEGER NOT NULL,
  `toBranchId` INTEGER NOT NULL,
  `productId` INTEGER NOT NULL,
  `quantity` DECIMAL(12, 3) NOT NULL,
  `unit` VARCHAR(40) NOT NULL DEFAULT 'unidad',
  `status` VARCHAR(20) NOT NULL DEFAULT 'completed',
  `note` VARCHAR(300) NULL,
  `createdById` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `stocktransfer_tenantId_reference_key` (`tenantId`, `reference`),
  INDEX `stocktransfer_tenantId_fromBranchId_createdAt_idx` (`tenantId`, `fromBranchId`, `createdAt`),
  INDEX `stocktransfer_tenantId_toBranchId_createdAt_idx` (`tenantId`, `toBranchId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `stocktransfer_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `stocktransfer_fromBranchId_fkey`
    FOREIGN KEY (`fromBranchId`) REFERENCES `branch` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `stocktransfer_toBranchId_fkey`
    FOREIGN KEY (`toBranchId`) REFERENCES `branch` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `stocktransfer_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `stocktransfer_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `stockmovement`
  ADD COLUMN `userId` INTEGER NULL,
  ADD COLUMN `transferId` INTEGER NULL,
  ADD COLUMN `reservedAfter` DECIMAL(12, 3) NULL,
  ADD COLUMN `reference` VARCHAR(80) NULL,
  ADD INDEX `stockmovement_userId_idx` (`userId`),
  ADD INDEX `stockmovement_transferId_idx` (`transferId`),
  ADD INDEX `stockmovement_tenantId_type_createdAt_idx` (`tenantId`, `type`, `createdAt`),
  ADD CONSTRAINT `stockmovement_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `stockmovement_transferId_fkey`
    FOREIGN KEY (`transferId`) REFERENCES `stocktransfer` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `inventorycountsession` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `branchId` INTEGER NOT NULL,
  `reference` VARCHAR(24) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'open',
  `note` VARCHAR(300) NULL,
  `startedById` INTEGER NULL,
  `completedById` INTEGER NULL,
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `inventorycountsession_tenantId_reference_key` (`tenantId`, `reference`),
  INDEX `inventorycountsession_tenantId_branchId_status_startedAt_idx` (`tenantId`, `branchId`, `status`, `startedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `inventorycountsession_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `inventorycountsession_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `branch` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `inventorycountsession_startedById_fkey`
    FOREIGN KEY (`startedById`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventorycountsession_completedById_fkey`
    FOREIGN KEY (`completedById`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventorycountitem` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `sessionId` INTEGER NOT NULL,
  `stockId` INTEGER NULL,
  `productId` INTEGER NOT NULL,
  `systemQuantity` DECIMAL(12, 3) NOT NULL,
  `countedQuantity` DECIMAL(12, 3) NOT NULL,
  `difference` DECIMAL(12, 3) NOT NULL DEFAULT 0,
  `adjusted` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `inventorycountitem_sessionId_productId_key` (`sessionId`, `productId`),
  INDEX `inventorycountitem_sessionId_idx` (`sessionId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `inventorycountitem_sessionId_fkey`
    FOREIGN KEY (`sessionId`) REFERENCES `inventorycountsession` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `inventorycountitem_stockId_fkey`
    FOREIGN KEY (`stockId`) REFERENCES `inventorystock` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventorycountitem_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
