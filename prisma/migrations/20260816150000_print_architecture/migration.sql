-- Arquitectura de impresión/comandas (preparación, no operativa todavía).
-- Áreas de impresión por sucursal, asociaciones con productos/categorías,
-- destinos opcionales y cola de comandas conceptual (pending → printed/failed).

CREATE TABLE `printarea` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `branchId` INTEGER NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `printarea_tenantId_branchId_name_key` (`tenantId`, `branchId`, `name`),
  INDEX `printarea_tenantId_branchId_active_sortOrder_idx` (`tenantId`, `branchId`, `active`, `sortOrder`),
  PRIMARY KEY (`id`),
  CONSTRAINT `printarea_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `printarea_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `branch` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `printareaproduct` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `areaId` INTEGER NOT NULL,
  `productId` INTEGER NOT NULL,
  UNIQUE INDEX `printareaproduct_areaId_productId_key` (`areaId`, `productId`),
  INDEX `printareaproduct_productId_idx` (`productId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `printareaproduct_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `printareaproduct_areaId_fkey`
    FOREIGN KEY (`areaId`) REFERENCES `printarea` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `printareaproduct_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `printareacategory` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `areaId` INTEGER NOT NULL,
  `categoryId` INTEGER NOT NULL,
  UNIQUE INDEX `printareacategory_areaId_categoryId_key` (`areaId`, `categoryId`),
  INDEX `printareacategory_categoryId_idx` (`categoryId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `printareacategory_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `printareacategory_areaId_fkey`
    FOREIGN KEY (`areaId`) REFERENCES `printarea` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `printareacategory_categoryId_fkey`
    FOREIGN KEY (`categoryId`) REFERENCES `category` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `printdestination` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `branchId` INTEGER NOT NULL,
  `areaId` INTEGER NULL,
  `name` VARCHAR(120) NOT NULL,
  `type` VARCHAR(30) NOT NULL DEFAULT 'ETHERNET',
  `connection` TEXT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'unknown',
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `printdestination_tenantId_branchId_active_idx` (`tenantId`, `branchId`, `active`),
  PRIMARY KEY (`id`),
  CONSTRAINT `printdestination_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `printdestination_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `branch` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `printdestination_areaId_fkey`
    FOREIGN KEY (`areaId`) REFERENCES `printarea` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `printjob` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `branchId` INTEGER NOT NULL,
  `orderId` INTEGER NOT NULL,
  `areaId` INTEGER NULL,
  `destinationId` INTEGER NULL,
  `kind` VARCHAR(30) NOT NULL DEFAULT 'comanda',
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `payload` JSON NOT NULL,
  `error` VARCHAR(500) NULL,
  `printedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `printjob_tenantId_branchId_status_createdAt_idx` (`tenantId`, `branchId`, `status`, `createdAt`),
  INDEX `printjob_orderId_idx` (`orderId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `printjob_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `printjob_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `branch` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `printjob_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `customerorder` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `printjob_areaId_fkey`
    FOREIGN KEY (`areaId`) REFERENCES `printarea` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `printjob_destinationId_fkey`
    FOREIGN KEY (`destinationId`) REFERENCES `printdestination` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
