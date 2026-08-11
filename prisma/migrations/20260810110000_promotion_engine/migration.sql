-- Motor de promociones: compra mínima en promoción y trazabilidad del descuento aplicado.
ALTER TABLE `promotion` ADD COLUMN `minimumPurchase` DECIMAL(12, 2) NULL;

ALTER TABLE `customerorder` ADD COLUMN `promotionId` INT NULL;
ALTER TABLE `customerorder` ADD COLUMN `promotionCode` VARCHAR(80) NULL;
ALTER TABLE `customerorder` ADD COLUMN `promotionLabel` VARCHAR(200) NULL;

CREATE INDEX `customerorder_promotionId_idx` ON `customerorder`(`promotionId`);
ALTER TABLE `customerorder` ADD CONSTRAINT `customerorder_promotionId_fkey`
  FOREIGN KEY (`promotionId`) REFERENCES `promotion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
