-- Expande la operación por sucursal sin modificar ni descartar registros históricos.
ALTER TABLE `product`
  ADD COLUMN `availableDays` JSON NULL,
  ADD COLUMN `availableStartTime` TIME(0) NULL,
  ADD COLUMN `availableEndTime` TIME(0) NULL;

ALTER TABLE `mediaasset`
  ADD COLUMN `thumbnailUrl` VARCHAR(500) NULL;

CREATE TABLE `branch` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `slug` VARCHAR(120) NOT NULL,
  `address` VARCHAR(300) NOT NULL,
  `city` VARCHAR(120) NULL,
  `province` VARCHAR(120) NULL,
  `phone` VARCHAR(60) NULL,
  `whatsapp` VARCHAR(60) NULL,
  `latitude` DECIMAL(10, 7) NULL,
  `longitude` DECIMAL(10, 7) NULL,
  `deliveryFee` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `minimumOrder` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `orderPrefix` VARCHAR(12) NOT NULL DEFAULT 'PED',
  `isPrimary` BOOLEAN NOT NULL DEFAULT false,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `branch_tenantId_active_isPrimary_idx` (`tenantId`, `active`, `isPrimary`),
  UNIQUE INDEX `branch_tenantId_slug_key` (`tenantId`, `slug`),
  PRIMARY KEY (`id`),
  CONSTRAINT `branch_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `branch` (
  `tenantId`, `name`, `slug`, `address`, `phone`, `latitude`, `longitude`, `isPrimary`, `active`
)
SELECT
  `tenant`.`id`,
  CONCAT(`tenant`.`name`, ' · Principal'),
  'principal',
  COALESCE(`businessinfo`.`address`, 'Dirección a configurar'),
  CAST(`businessinfo`.`phoneNumber` AS CHAR),
  NULLIF(`businessinfo`.`latitude`, ''),
  NULLIF(`businessinfo`.`longitude`, ''),
  true,
  true
FROM `tenant`
LEFT JOIN `businessinfo` ON `businessinfo`.`tenantId` = `tenant`.`id`;

ALTER TABLE `diningtable`
  ADD COLUMN `branchId` INTEGER NULL,
  ADD INDEX `diningtable_tenantId_branchId_idx` (`tenantId`, `branchId`),
  ADD CONSTRAINT `diningtable_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `branch` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE `diningtable`
JOIN `branch` ON `branch`.`tenantId` = `diningtable`.`tenantId` AND `branch`.`isPrimary` = true
SET `diningtable`.`branchId` = `branch`.`id`;

ALTER TABLE `customerorder`
  ADD COLUMN `branchId` INTEGER NULL,
  ADD COLUMN `deliveryAddress` VARCHAR(500) NULL,
  ADD COLUMN `deliveryFee` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `paymentMethod` VARCHAR(30) NOT NULL DEFAULT 'on_delivery',
  ADD COLUMN `paymentStatus` VARCHAR(24) NOT NULL DEFAULT 'pending',
  ADD COLUMN `requestedAt` DATETIME(3) NULL,
  ADD COLUMN `tip` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD INDEX `customerorder_tenantId_branchId_createdAt_idx` (`tenantId`, `branchId`, `createdAt`),
  ADD CONSTRAINT `customerorder_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `branch` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE `customerorder`
LEFT JOIN `diningtable` ON `diningtable`.`id` = `customerorder`.`tableId`
JOIN `branch` AS `primaryBranch`
  ON `primaryBranch`.`tenantId` = `customerorder`.`tenantId` AND `primaryBranch`.`isPrimary` = true
SET `customerorder`.`branchId` = COALESCE(`diningtable`.`branchId`, `primaryBranch`.`id`);

CREATE TABLE `inventorystock` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `branchId` INTEGER NOT NULL,
  `productId` INTEGER NOT NULL,
  `tracked` BOOLEAN NOT NULL DEFAULT false,
  `current` DECIMAL(12, 3) NOT NULL DEFAULT 0,
  `minimum` DECIMAL(12, 3) NOT NULL DEFAULT 0,
  `unit` VARCHAR(40) NOT NULL DEFAULT 'unidad',
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `inventorystock_tenantId_tracked_current_idx` (`tenantId`, `tracked`, `current`),
  UNIQUE INDEX `inventorystock_branchId_productId_key` (`branchId`, `productId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `inventorystock_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `inventorystock_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `branch` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `inventorystock_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `stockmovement` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `stockId` INTEGER NOT NULL,
  `orderId` INTEGER NULL,
  `userId` INTEGER NULL,
  `type` VARCHAR(30) NOT NULL,
  `quantity` DECIMAL(12, 3) NOT NULL,
  `balanceAfter` DECIMAL(12, 3) NOT NULL,
  `reason` VARCHAR(300) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `stockmovement_tenantId_createdAt_idx` (`tenantId`, `createdAt`),
  INDEX `stockmovement_stockId_createdAt_idx` (`stockId`, `createdAt`),
  INDEX `stockmovement_orderId_idx` (`orderId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `stockmovement_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `stockmovement_stockId_fkey`
    FOREIGN KEY (`stockId`) REFERENCES `inventorystock` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `stockmovement_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `customerorder` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `invoicerecord` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `branchId` INTEGER NULL,
  `orderId` INTEGER NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'draft',
  `documentType` VARCHAR(40) NOT NULL DEFAULT 'internal_receipt',
  `number` VARCHAR(80) NULL,
  `customerName` VARCHAR(180) NOT NULL,
  `customerTaxId` VARCHAR(40) NULL,
  `subtotal` DECIMAL(12, 2) NOT NULL,
  `tax` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `total` DECIMAL(12, 2) NOT NULL,
  `currency` VARCHAR(3) NOT NULL DEFAULT 'ARS',
  `externalId` VARCHAR(180) NULL,
  `notes` TEXT NULL,
  `issuedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `invoicerecord_orderId_key` (`orderId`),
  INDEX `invoicerecord_tenantId_status_createdAt_idx` (`tenantId`, `status`, `createdAt`),
  INDEX `invoicerecord_tenantId_number_idx` (`tenantId`, `number`),
  PRIMARY KEY (`id`),
  CONSTRAINT `invoicerecord_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `invoicerecord_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `branch` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `invoicerecord_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `customerorder` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `integrationsettings` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `provider` VARCHAR(60) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT false,
  `mode` VARCHAR(20) NOT NULL DEFAULT 'disabled',
  `publicConfig` JSON NULL,
  `secretConfigured` BOOLEAN NOT NULL DEFAULT false,
  `status` VARCHAR(30) NOT NULL DEFAULT 'not_configured',
  `lastCheckAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `integrationsettings_tenantId_enabled_status_idx` (`tenantId`, `enabled`, `status`),
  UNIQUE INDEX `integrationsettings_tenantId_provider_key` (`tenantId`, `provider`),
  PRIMARY KEY (`id`),
  CONSTRAINT `integrationsettings_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `seopage` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `path` VARCHAR(220) NOT NULL,
  `title` VARCHAR(180) NOT NULL,
  `description` VARCHAR(500) NOT NULL,
  `canonical` VARCHAR(500) NULL,
  `ogImageUrl` VARCHAR(500) NULL,
  `noIndex` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `seopage_tenantId_path_key` (`tenantId`, `path`),
  PRIMARY KEY (`id`),
  CONSTRAINT `seopage_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `redirectrule` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `sourcePath` VARCHAR(300) NOT NULL,
  `targetPath` VARCHAR(500) NOT NULL,
  `permanent` BOOLEAN NOT NULL DEFAULT true,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `redirectrule_tenantId_active_idx` (`tenantId`, `active`),
  UNIQUE INDEX `redirectrule_tenantId_sourcePath_key` (`tenantId`, `sourcePath`),
  PRIMARY KEY (`id`),
  CONSTRAINT `redirectrule_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `errorlog` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NULL,
  `level` VARCHAR(20) NOT NULL DEFAULT 'error',
  `source` VARCHAR(80) NOT NULL,
  `message` VARCHAR(1000) NOT NULL,
  `path` VARCHAR(500) NULL,
  `fingerprint` VARCHAR(64) NULL,
  `context` JSON NULL,
  `resolvedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `errorlog_tenantId_resolvedAt_createdAt_idx` (`tenantId`, `resolvedAt`, `createdAt`),
  INDEX `errorlog_fingerprint_createdAt_idx` (`fingerprint`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `errorlog_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `passwordresetrequest` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NULL,
  `userId` INTEGER NULL,
  `emailHash` VARCHAR(64) NOT NULL,
  `tokenHash` VARCHAR(64) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'requested',
  `requestedIp` VARCHAR(64) NULL,
  `expiresAt` DATETIME(3) NULL,
  `usedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `passwordresetrequest_emailHash_createdAt_idx` (`emailHash`, `createdAt`),
  INDEX `passwordresetrequest_tokenHash_idx` (`tokenHash`),
  PRIMARY KEY (`id`),
  CONSTRAINT `passwordresetrequest_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
