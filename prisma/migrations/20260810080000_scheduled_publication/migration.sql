ALTER TABLE `category` ADD COLUMN `publishAt` DATETIME(3) NULL;
ALTER TABLE `event` ADD COLUMN `publishAt` DATETIME(3) NULL;
ALTER TABLE `product` ADD COLUMN `publishAt` DATETIME(3) NULL;
ALTER TABLE `promotion` ADD COLUMN `publishAt` DATETIME(3) NULL;

CREATE INDEX `category_tenantId_status_publishAt_idx` ON `category` (`tenantId`, `status`, `publishAt`);
CREATE INDEX `event_tenantId_status_publishAt_idx` ON `event` (`tenantId`, `status`, `publishAt`);
CREATE INDEX `product_tenantId_status_publishAt_idx` ON `product` (`tenantId`, `status`, `publishAt`);
CREATE INDEX `promotion_tenantId_status_publishAt_idx` ON `promotion` (`tenantId`, `status`, `publishAt`);
