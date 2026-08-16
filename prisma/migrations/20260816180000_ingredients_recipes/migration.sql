-- Módulo de ingredientes y recetas: unidad de costo por producto,
-- rendimiento por línea de receta, snapshot de costo en movimientos,
-- conversiones de unidades por negocio e historial de costos.

ALTER TABLE `product`
  ADD COLUMN `costUnit` VARCHAR(40) NOT NULL DEFAULT 'unidad';

ALTER TABLE `recipeingredient`
  ADD COLUMN `yieldPercent` DECIMAL(6, 3) NOT NULL DEFAULT 100;

ALTER TABLE `stockmovement`
  ADD COLUMN `unitCost` DECIMAL(14, 4) NULL;

CREATE TABLE `unitconversion` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `fromUnit` VARCHAR(40) NOT NULL,
  `toUnit` VARCHAR(40) NOT NULL,
  `factor` DECIMAL(18, 9) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `unitconversion_tenantId_fromUnit_toUnit_key` (`tenantId`, `fromUnit`, `toUnit`),
  INDEX `unitconversion_tenantId_idx` (`tenantId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `unitconversion_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ingredientcosthistory` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `productId` INTEGER NOT NULL,
  `cost` DECIMAL(12, 4) NOT NULL,
  `unit` VARCHAR(40) NOT NULL,
  `changedById` INTEGER NULL,
  `reason` VARCHAR(300) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ingredientcosthistory_tenantId_productId_createdAt_idx` (`tenantId`, `productId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ingredientcosthistory_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ingredientcosthistory_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
