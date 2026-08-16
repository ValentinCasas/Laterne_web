-- Módulo Cocina/KDS: estaciones de preparación (cocina, barra, cafetería) y ruteo de productos.
CREATE TABLE `kitchenstation` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `branchId` INTEGER NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `type` VARCHAR(20) NOT NULL DEFAULT 'KITCHEN',
  `active` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `kitchenstation_tenantId_branchId_name_key` (`tenantId`, `branchId`, `name`),
  INDEX `kitchenstation_tenantId_branchId_active_sortOrder_idx` (`tenantId`, `branchId`, `active`, `sortOrder`),
  PRIMARY KEY (`id`),
  CONSTRAINT `kitchenstation_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `kitchenstation_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `branch` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `product`
  ADD COLUMN `stationId` INTEGER NULL,
  ADD INDEX `product_stationId_idx` (`stationId`),
  ADD CONSTRAINT `product_stationId_fkey`
    FOREIGN KEY (`stationId`) REFERENCES `kitchenstation` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
