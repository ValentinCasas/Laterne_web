-- Módulo Mesas/Salón: sectores configurables, sesiones de mesa, timeline y plano del salón.
CREATE TABLE `tablesector` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `branchId` INTEGER NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `tablesector_tenantId_branchId_name_key` (`tenantId`, `branchId`, `name`),
  INDEX `tablesector_tenantId_branchId_active_sortOrder_idx` (`tenantId`, `branchId`, `active`, `sortOrder`),
  PRIMARY KEY (`id`),
  CONSTRAINT `tablesector_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `tablesector_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `branch` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tablesession` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `branchId` INTEGER NOT NULL,
  `tableId` INTEGER NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'occupied',
  `customerName` VARCHAR(160) NULL,
  `phone` VARCHAR(60) NULL,
  `partySize` INTEGER NOT NULL DEFAULT 1,
  `notes` TEXT NULL,
  `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `closedAt` DATETIME(3) NULL,
  `closedByUserId` INTEGER NULL,
  `waiterUserId` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `tablesession_tenantId_branchId_closedAt_tableId_idx` (`tenantId`, `branchId`, `closedAt`, `tableId`),
  INDEX `tablesession_tenantId_tableId_closedAt_idx` (`tenantId`, `tableId`, `closedAt`),
  INDEX `tablesession_tenantId_openedAt_idx` (`tenantId`, `openedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `tablesession_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `tablesession_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `branch` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `tablesession_tableId_fkey`
    FOREIGN KEY (`tableId`) REFERENCES `diningtable` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `tablesession_waiterUserId_fkey`
    FOREIGN KEY (`waiterUserId`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `tablesession_closedByUserId_fkey`
    FOREIGN KEY (`closedByUserId`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tablesessionevent` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `branchId` INTEGER NOT NULL,
  `sessionId` INTEGER NOT NULL,
  `eventType` VARCHAR(40) NOT NULL,
  `note` VARCHAR(500) NULL,
  `metadata` JSON NULL,
  `userId` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `tablesessionevent_tenantId_branchId_sessionId_createdAt_idx` (`tenantId`, `branchId`, `sessionId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `tablesessionevent_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `tablesessionevent_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `branch` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `tablesessionevent_sessionId_fkey`
    FOREIGN KEY (`sessionId`) REFERENCES `tablesession` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `tablesessionevent_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `diningtable`
  ADD COLUMN `sectorId` INTEGER NULL,
  ADD COLUMN `positionX` INTEGER NULL,
  ADD COLUMN `positionY` INTEGER NULL,
  ADD INDEX `diningtable_tenantId_sectorId_idx` (`tenantId`, `sectorId`),
  ADD CONSTRAINT `diningtable_sectorId_fkey`
    FOREIGN KEY (`sectorId`) REFERENCES `tablesector` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `customerorder`
  ADD COLUMN `tableSessionId` INTEGER NULL,
  ADD INDEX `customerorder_tenantId_tableSessionId_createdAt_idx` (`tenantId`, `tableSessionId`, `createdAt`),
  ADD CONSTRAINT `customerorder_tableSessionId_fkey`
    FOREIGN KEY (`tableSessionId`) REFERENCES `tablesession` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
