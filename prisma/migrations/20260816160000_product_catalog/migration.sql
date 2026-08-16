-- Catálogo de productos avanzado: subcategorías, costo, favoritos,
-- listas de precios por canal, combos y recetas conectadas al inventario.

ALTER TABLE `category`
  ADD COLUMN `parentId` INTEGER NULL,
  ADD INDEX `category_tenantId_parentId_idx` (`tenantId`, `parentId`),
  ADD CONSTRAINT `category_parentId_fkey`
    FOREIGN KEY (`parentId`) REFERENCES `category` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `product`
  ADD COLUMN `cost` DECIMAL(12, 2) NULL,
  ADD COLUMN `favorite` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `productprice` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `productId` INTEGER NOT NULL,
  `channel` VARCHAR(20) NOT NULL,
  `price` DECIMAL(12, 2) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `validFrom` DATETIME(3) NULL,
  `validUntil` DATETIME(3) NULL,
  `startTime` TIME(0) NULL,
  `endTime` TIME(0) NULL,
  `daysOfWeek` JSON NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `productprice_productId_channel_key` (`productId`, `channel`),
  INDEX `productprice_tenantId_channel_active_idx` (`tenantId`, `channel`, `active`),
  PRIMARY KEY (`id`),
  CONSTRAINT `productprice_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `productprice_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `productcomboitem` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `productId` INTEGER NOT NULL,
  `itemProductId` INTEGER NOT NULL,
  `quantity` DECIMAL(12, 3) NOT NULL DEFAULT 1,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `productcomboitem_productId_itemProductId_key` (`productId`, `itemProductId`),
  INDEX `productcomboitem_itemProductId_idx` (`itemProductId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `productcomboitem_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `productcomboitem_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `productcomboitem_itemProductId_fkey`
    FOREIGN KEY (`itemProductId`) REFERENCES `product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `recipeingredient` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `productId` INTEGER NOT NULL,
  `ingredientProductId` INTEGER NOT NULL,
  `quantity` DECIMAL(12, 3) NOT NULL DEFAULT 1,
  `unit` VARCHAR(40) NOT NULL DEFAULT 'unidad',
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `recipeingredient_productId_ingredientProductId_key` (`productId`, `ingredientProductId`),
  INDEX `recipeingredient_ingredientProductId_idx` (`ingredientProductId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `recipeingredient_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `recipeingredient_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `recipeingredient_ingredientProductId_fkey`
    FOREIGN KEY (`ingredientProductId`) REFERENCES `product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
