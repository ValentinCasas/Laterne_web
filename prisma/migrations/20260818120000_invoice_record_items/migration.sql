-- Modelo documental: líneas de factura con snapshots históricos e inmutables.
-- Idempotente: solo crea lo que falta y hace backfill de facturas existentes sin borrar datos.

-- Vínculo opcional factura -> remito (Pedido -> Entrega/Remito -> Factura).
ALTER TABLE `invoicerecord`
  ADD COLUMN IF NOT EXISTS `deliveryId` INT NULL,
  ADD INDEX IF NOT EXISTS `invoicerecord_deliveryId_idx` (`tenantId`, `deliveryId`);

SET @fk_name := 'invoicerecord_deliveryId_orderdelivery_id_fk';
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME = @fk_name
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE `invoicerecord` ADD CONSTRAINT `invoicerecord_deliveryId_orderdelivery_id_fk` FOREIGN KEY (`deliveryId`) REFERENCES `orderdelivery` (`id`) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Tabla: línea de factura/recibo con snapshot histórico.
CREATE TABLE IF NOT EXISTS `invoicerecorditem` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `invoiceId` INT NOT NULL,
  `deliveryItemId` INT NULL,
  `orderItemId` INT NULL,
  `productId` INT NULL,
  `productName` VARCHAR(180) NOT NULL,
  `descriptionSnapshot` VARCHAR(500) NULL,
  `quantity` INT NOT NULL,
  `unitPrice` DECIMAL(12, 2) NOT NULL,
  `variantName` VARCHAR(120) NULL,
  `variantPrice` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `extras` JSON NULL,
  `extrasTotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `notes` VARCHAR(500) NULL,
  `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `tax` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `lineTotal` DECIMAL(12, 2) NOT NULL,
  `costSnapshot` DECIMAL(14, 4) NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `invoicerecorditem_invoiceId_idx` (`invoiceId`),
  INDEX `invoicerecorditem_orderItemId_idx` (`orderItemId`),
  INDEX `invoicerecorditem_deliveryItemId_idx` (`deliveryItemId`),
  INDEX `invoicerecorditem_productId_idx` (`productId`),
  CONSTRAINT `invoicerecorditem_invoiceId_invoicerecord_id_fk` FOREIGN KEY (`invoiceId`) REFERENCES `invoicerecord` (`id`) ON DELETE CASCADE,
  CONSTRAINT `invoicerecorditem_orderItemId_orderitem_id_fk` FOREIGN KEY (`orderItemId`) REFERENCES `orderitem` (`id`) ON DELETE SET NULL,
  CONSTRAINT `invoicerecorditem_deliveryItemId_orderdeliveryitem_id_fk` FOREIGN KEY (`deliveryItemId`) REFERENCES `orderdeliveryitem` (`id`) ON DELETE SET NULL,
  CONSTRAINT `invoicerecorditem_productId_product_id_fk` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Backfill: facturas existentes quedan con sus líneas snapshot desde el pedido original.
INSERT INTO `invoicerecorditem` (
  `invoiceId`, `orderItemId`, `productId`, `productName`, `quantity`, `unitPrice`,
  `variantName`, `variantPrice`, `extras`, `extrasTotal`, `notes`, `lineTotal`,
  `costSnapshot`, `createdAt`
)
SELECT
  ir.`id`,
  oi.`id`,
  oi.`productId`,
  oi.`productName`,
  oi.`quantity`,
  oi.`unitPrice`,
  oi.`variantName`,
  oi.`variantPrice`,
  oi.`extras`,
  oi.`extrasTotal`,
  oi.`notes`,
  oi.`lineTotal`,
  oi.`costSnapshot`,
  ir.`createdAt`
FROM `invoicerecord` ir
INNER JOIN `orderitem` oi ON oi.`orderId` = ir.`orderId`
WHERE NOT EXISTS (
  SELECT 1 FROM `invoicerecorditem` existing
  WHERE existing.`invoiceId` = ir.`id`
);