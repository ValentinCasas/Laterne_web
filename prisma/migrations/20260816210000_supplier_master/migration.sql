SET @now = NOW(3);

-- 1) Ampliar tabla supplier con campos de maestro y cuenta corriente
ALTER TABLE `supplier`
  ADD COLUMN `code` VARCHAR(40) NULL AFTER `id`,
  ADD COLUMN `currency` VARCHAR(3) NOT NULL DEFAULT 'ARS' AFTER `paymentTerms`,
  ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'active' AFTER `currency`,
  ADD COLUMN `category` VARCHAR(80) NULL AFTER `status`,
  ADD COLUMN `creditLimit` DECIMAL(14,2) NULL AFTER `category`,
  ADD COLUMN `currentBalance` DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER `creditLimit`,
  ADD COLUMN `blockedAt` DATETIME(3) NULL AFTER `currentBalance`,
  ADD COLUMN `blockedReason` VARCHAR(300) NULL AFTER `blockedAt`,
  ADD UNIQUE INDEX `supplier_tenantId_code_key` (`tenantId`, `code`),
  ADD INDEX `supplier_tenantId_status_idx` (`tenantId`, `status`),
  ADD INDEX `supplier_tenantId_category_idx` (`tenantId`, `category`);

-- 2) Sucursales habilitadas por proveedor (N:M)
CREATE TABLE `supplierbranch` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `supplierId` INTEGER NOT NULL,
  `branchId` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `supplierbranch_supplierId_branchId_key` (`supplierId`, `branchId`),
  INDEX `supplierbranch_tenantId_branchId_idx` (`tenantId`, `branchId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `supplierbranch_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `supplierbranch_supplierId_fkey`
    FOREIGN KEY (`supplierId`) REFERENCES `supplier` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `supplierbranch_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `branch` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3) Ledger inmutable de proveedor
CREATE TABLE `supplierledgerentry` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `supplierId` INTEGER NOT NULL,
  `branchId` INTEGER NULL,
  `type` VARCHAR(30) NOT NULL,
  `referenceType` VARCHAR(40) NULL,
  `referenceId` INTEGER NULL,
  `documentNumber` VARCHAR(24) NULL,
  `originalAmount` DECIMAL(14,2) NOT NULL,
  `appliedAmount` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `remainingAmount` DECIMAL(14,2) NOT NULL,
  `currency` VARCHAR(3) NOT NULL DEFAULT 'ARS',
  `dueDate` DATETIME(3) NULL,
  `paidAt` DATETIME(3) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'open',
  `notes` VARCHAR(300) NULL,
  `createdById` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `supplierledgerentry_tenantId_supplierId_status_dueDate_idx` (`tenantId`, `supplierId`, `status`, `dueDate`),
  INDEX `supplierledgerentry_tenantId_supplierId_createdAt_idx` (`tenantId`, `supplierId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `supplierledgerentry_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `supplierledgerentry_supplierId_fkey`
    FOREIGN KEY (`supplierId`) REFERENCES `supplier` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `supplierledgerentry_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4) Backfill: generar código único para proveedores existentes
SET @seq = 0;
UPDATE `supplier`
  SET `code` = CONCAT('PRV-', LPAD((@seq := @seq + 1), 6, '0'))
  WHERE `code` IS NULL
  ORDER BY `id` ASC;
