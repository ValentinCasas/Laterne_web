CREATE TABLE `productvariant` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `productId` INTEGER NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `priceAdjustment` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `productvariant_tenantId_productId_active_sortOrder_idx` (`tenantId`, `productId`, `active`, `sortOrder`),
  PRIMARY KEY (`id`),
  CONSTRAINT `productvariant_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `productvariant_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `productextra` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `productId` INTEGER NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `price` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `productextra_tenantId_productId_active_sortOrder_idx` (`tenantId`, `productId`, `active`, `sortOrder`),
  PRIMARY KEY (`id`),
  CONSTRAINT `productextra_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `productextra_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `diningtable` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `code` VARCHAR(40) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `sector` VARCHAR(100) NULL,
  `capacity` INTEGER NOT NULL DEFAULT 4,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `diningtable_tenantId_code_key` (`tenantId`, `code`),
  INDEX `diningtable_tenantId_active_name_idx` (`tenantId`, `active`, `name`),
  PRIMARY KEY (`id`),
  CONSTRAINT `diningtable_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `customerorder` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `tableId` INTEGER NULL,
  `reference` VARCHAR(24) NOT NULL,
  `publicTokenHash` VARCHAR(64) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'received',
  `orderType` VARCHAR(24) NOT NULL DEFAULT 'takeaway',
  `customerName` VARCHAR(160) NOT NULL,
  `phone` VARCHAR(60) NOT NULL,
  `email` VARCHAR(190) NULL,
  `notes` TEXT NULL,
  `subtotal` DECIMAL(12, 2) NOT NULL,
  `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `total` DECIMAL(12, 2) NOT NULL,
  `currency` VARCHAR(3) NOT NULL DEFAULT 'ARS',
  `source` VARCHAR(60) NOT NULL DEFAULT 'website',
  `ipHash` VARCHAR(64) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `customerorder_reference_key` (`reference`),
  INDEX `customerorder_tenantId_status_createdAt_idx` (`tenantId`, `status`, `createdAt`),
  INDEX `customerorder_tenantId_tableId_createdAt_idx` (`tenantId`, `tableId`, `createdAt`),
  INDEX `customerorder_publicTokenHash_idx` (`publicTokenHash`),
  PRIMARY KEY (`id`),
  CONSTRAINT `customerorder_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `customerorder_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `diningtable` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `orderitem` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `orderId` INTEGER NOT NULL,
  `productId` INTEGER NULL,
  `productName` VARCHAR(180) NOT NULL,
  `quantity` INTEGER NOT NULL,
  `unitPrice` DECIMAL(12, 2) NOT NULL,
  `variantName` VARCHAR(120) NULL,
  `variantPrice` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `extras` JSON NULL,
  `extrasTotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `notes` VARCHAR(500) NULL,
  `lineTotal` DECIMAL(12, 2) NOT NULL,
  INDEX `orderitem_orderId_idx` (`orderId`),
  INDEX `orderitem_productId_idx` (`productId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `orderitem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `customerorder` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `orderitem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `orderstatushistory` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `orderId` INTEGER NOT NULL,
  `userId` INTEGER NULL,
  `fromStatus` VARCHAR(24) NULL,
  `toStatus` VARCHAR(24) NOT NULL,
  `note` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `orderstatushistory_orderId_createdAt_idx` (`orderId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `orderstatushistory_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `customerorder` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `analyticsevent` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `eventType` VARCHAR(80) NOT NULL,
  `sessionHash` VARCHAR(64) NULL,
  `ipHash` VARCHAR(64) NULL,
  `path` VARCHAR(300) NULL,
  `entityType` VARCHAR(60) NULL,
  `entityId` INTEGER NULL,
  `metadata` JSON NULL,
  `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `analyticsevent_tenantId_eventType_occurredAt_idx` (`tenantId`, `eventType`, `occurredAt`),
  INDEX `analyticsevent_tenantId_occurredAt_idx` (`tenantId`, `occurredAt`),
  INDEX `analyticsevent_sessionHash_occurredAt_idx` (`sessionHash`, `occurredAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `analyticsevent_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
