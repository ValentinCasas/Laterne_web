-- Tabla de remitos/entregas
CREATE TABLE IF NOT EXISTS `orderdelivery` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenantId` INT NOT NULL,
  `orderId` INT NOT NULL,
  `number` VARCHAR(24) NOT NULL,
  `deliveryDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `branchId` INT NULL,
  `customerId` INT NULL,
  `customerName` VARCHAR(160) NOT NULL,
  `deliveryAddress` VARCHAR(500) NULL,
  `deliveryType` VARCHAR(20) NOT NULL DEFAULT 'full',
  `status` VARCHAR(24) NOT NULL DEFAULT 'delivered',
  `notes` TEXT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdById` INT NULL,
  `reversedAt` DATETIME NULL,
  `reversedById` INT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `orderdelivery_tenantId_number_unique` (`tenantId`, `number`),
  INDEX `orderdelivery_tenantId_orderId_createdAt_idx` (`tenantId`, `orderId`, `createdAt`),
  INDEX `orderdelivery_tenantId_customerId_createdAt_idx` (`tenantId`, `customerId`, `createdAt`),
  CONSTRAINT `orderdelivery_tenantId_tenant_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE,
  CONSTRAINT `orderdelivery_orderId_customerorder_id_fk` FOREIGN KEY (`orderId`) REFERENCES `customerorder` (`id`) ON DELETE CASCADE,
  CONSTRAINT `orderdelivery_branchId_branch_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branch` (`id`) ON DELETE SET NULL,
  CONSTRAINT `orderdelivery_customerId_loyaltycustomer_id_fk` FOREIGN KEY (`customerId`) REFERENCES `loyaltycustomer` (`id`) ON DELETE SET NULL,
  CONSTRAINT `orderdelivery_createdById_user_id_fk` FOREIGN KEY (`createdById`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `orderdelivery_reversedById_user_id_fk` FOREIGN KEY (`reversedById`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Tabla de líneas de entrega
CREATE TABLE IF NOT EXISTS `orderdeliveryitem` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `deliveryId` INT NOT NULL,
  `orderItemId` INT NOT NULL,
  `productId` INT NULL,
  `productName` VARCHAR(180) NOT NULL,
  `quantityDelivered` INT NOT NULL,
  `unitPrice` DECIMAL(12,2) NOT NULL,
  `notes` VARCHAR(500) NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `orderdeliveryitem_deliveryId_idx` (`deliveryId`),
  INDEX `orderdeliveryitem_orderItemId_idx` (`orderItemId`),
  CONSTRAINT `orderdeliveryitem_deliveryId_orderdelivery_id_fk` FOREIGN KEY (`deliveryId`) REFERENCES `orderdelivery` (`id`) ON DELETE CASCADE,
  CONSTRAINT `orderdeliveryitem_orderItemId_orderitem_id_fk` FOREIGN KEY (`orderItemId`) REFERENCES `orderitem` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `orderdeliveryitem_productId_product_id_fk` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Tabla de pagos de clientes
CREATE TABLE IF NOT EXISTS `customerpayment` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenantId` INT NOT NULL,
  `customerId` INT NOT NULL,
  `orderId` INT NULL,
  `deliveryId` INT NULL,
  `number` VARCHAR(24) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `method` VARCHAR(40) NOT NULL DEFAULT 'efectivo',
  `paidAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` VARCHAR(240) NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'confirmed',
  `createdById` INT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reversedAt` DATETIME NULL,
  `reversedById` INT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `customerpayment_tenantId_number_unique` (`tenantId`, `number`),
  INDEX `customerpayment_tenantId_customerId_paidAt_idx` (`tenantId`, `customerId`, `paidAt`),
  INDEX `customerpayment_tenantId_orderId_idx` (`tenantId`, `orderId`),
  INDEX `customerpayment_tenantId_deliveryId_idx` (`tenantId`, `deliveryId`),
  CONSTRAINT `customerpayment_tenantId_tenant_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE,
  CONSTRAINT `customerpayment_customerId_loyaltycustomer_id_fk` FOREIGN KEY (`customerId`) REFERENCES `loyaltycustomer` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `customerpayment_orderId_customerorder_id_fk` FOREIGN KEY (`orderId`) REFERENCES `customerorder` (`id`) ON DELETE SET NULL,
  CONSTRAINT `customerpayment_deliveryId_orderdelivery_id_fk` FOREIGN KEY (`deliveryId`) REFERENCES `orderdelivery` (`id`) ON DELETE SET NULL,
  CONSTRAINT `customerpayment_createdById_user_id_fk` FOREIGN KEY (`createdById`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `customerpayment_reversedById_user_id_fk` FOREIGN KEY (`reversedById`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Columnas en orderitem
ALTER TABLE `orderitem` ADD COLUMN IF NOT EXISTS `deliveredQuantity` INT NOT NULL DEFAULT 0;
ALTER TABLE `orderitem` ADD COLUMN IF NOT EXISTS `pendingQuantity` INT NULL;

-- Columnas en loyaltycustomer
ALTER TABLE `loyaltycustomer` ADD COLUMN IF NOT EXISTS `address` VARCHAR(255) NULL;
ALTER TABLE `loyaltycustomer` ADD COLUMN IF NOT EXISTS `paymentTerms` VARCHAR(80) NULL;
ALTER TABLE `loyaltycustomer` ADD COLUMN IF NOT EXISTS `currentBalance` DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE `loyaltycustomer` ADD COLUMN IF NOT EXISTS `currency` VARCHAR(3) NOT NULL DEFAULT 'ARS';

-- Relaciones inversas en tenant
ALTER TABLE `tenant` ADD COLUMN IF NOT EXISTS `orderDeliveries` INT NULL;
ALTER TABLE `tenant` ADD COLUMN IF NOT EXISTS `customerPayments` INT NULL;

-- Nota: las relaciones inversas en Branch, Product, CustomerOrder y User se manejan via índices
-- Prisma 6 con MySQL no necesita columnas físicas para relaciones inversas
