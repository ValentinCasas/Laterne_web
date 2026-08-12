-- Branch full isolation: agrega branch scoping a las entidades operativas y de
-- contenido del tenant (no destructivo, columnas nullable + backfill a PRIMARY).

-- Columns nuevos (nullable para no romper datos existentes)
ALTER TABLE `category` ADD COLUMN `branchId` INTEGER NULL;
ALTER TABLE `event` ADD COLUMN `branchId` INTEGER NULL;
ALTER TABLE `openinghour` ADD COLUMN `branchId` INTEGER NULL;
ALTER TABLE `testimonial` ADD COLUMN `branchId` INTEGER NULL;
ALTER TABLE `promotion` ADD COLUMN `branchId` INTEGER NULL;
ALTER TABLE `notification` ADD COLUMN `branchId` INTEGER NULL;
ALTER TABLE `analyticsevent` ADD COLUMN `branchId` INTEGER NULL;
ALTER TABLE `auditlog` ADD COLUMN `branchId` INTEGER NULL;
ALTER TABLE `mediaasset` ADD COLUMN `branchId` INTEGER NULL;
ALTER TABLE `authsession` ADD COLUMN `branchId` INTEGER NULL;
ALTER TABLE `branchlicense` ADD COLUMN `planId` INTEGER NULL;
ALTER TABLE `tenantmembership` ADD COLUMN `allBranches` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `branch` ADD COLUMN `inheritBrand` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `landingContent` JSON NULL,
    ADD COLUMN `brandContent` JSON NULL;

-- Índices compuestos tenantId+branchId (reemplazan los índices previos equivalentes).
-- Se crean ANTES de eliminar los antiguos porque el primer segmento `tenantId`
-- sostiene las foreign keys existentes.
CREATE INDEX `category_tenantId_branchId_status_sortOrder_idx` ON `category`(`tenantId`, `branchId`, `status`, `sortOrder`);
CREATE INDEX `event_tenantId_branchId_status_date_idx` ON `event`(`tenantId`, `branchId`, `status`, `date`);
CREATE INDEX `openinghour_tenantId_branchId_idx` ON `openinghour`(`tenantId`, `branchId`);
CREATE INDEX `testimonial_tenantId_branchId_moderationStatus_idx` ON `testimonial`(`tenantId`, `branchId`, `moderationStatus`);
CREATE INDEX `promotion_tenantId_branchId_status_startAt_endAt_idx` ON `promotion`(`tenantId`, `branchId`, `status`, `startAt`, `endAt`);
CREATE INDEX `notification_tenantId_branchId_readAt_createdAt_idx` ON `notification`(`tenantId`, `branchId`, `readAt`, `createdAt`);
CREATE INDEX `analyticsevent_tenantId_branchId_occurredAt_idx` ON `analyticsevent`(`tenantId`, `branchId`, `occurredAt`);
CREATE INDEX `auditlog_tenantId_branchId_createdAt_idx` ON `auditlog`(`tenantId`, `branchId`, `createdAt`);
CREATE INDEX `mediaasset_tenantId_branchId_folder_createdAt_idx` ON `mediaasset`(`tenantId`, `branchId`, `folder`, `createdAt`);
CREATE INDEX `authsession_branchId_idx` ON `authsession`(`branchId`);

DROP INDEX `category_tenantId_status_sortOrder_idx` ON `category`;
DROP INDEX `event_tenantId_status_date_idx` ON `event`;
DROP INDEX `openinghour_tenantId_idx` ON `openinghour`;
DROP INDEX `testimonial_tenantId_moderationStatus_idx` ON `testimonial`;
DROP INDEX `promotion_tenantId_status_startAt_endAt_idx` ON `promotion`;
DROP INDEX `notification_tenantId_readAt_createdAt_idx` ON `notification`;
DROP INDEX `analyticsevent_tenantId_occurredAt_idx` ON `analyticsevent`;
DROP INDEX `auditlog_tenantId_createdAt_idx` ON `auditlog`;
DROP INDEX `mediaasset_tenantId_folder_createdAt_idx` ON `mediaasset`;

-- Foreign keys hacia branch (SET NULL: nunca borra datos al eliminar sucursal)
ALTER TABLE `category` ADD CONSTRAINT `category_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `event` ADD CONSTRAINT `event_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `openinghour` ADD CONSTRAINT `openinghour_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `testimonial` ADD CONSTRAINT `testimonial_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `promotion` ADD CONSTRAINT `promotion_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `notification` ADD CONSTRAINT `notification_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `analyticsevent` ADD CONSTRAINT `analyticsevent_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `auditlog` ADD CONSTRAINT `auditlog_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `mediaasset` ADD CONSTRAINT `mediaasset_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `authsession` ADD CONSTRAINT `authsession_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `branchlicense` ADD CONSTRAINT `branchlicense_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `plan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Tabla de vínculo cliente↔sucursal (identidad compartida dentro del tenant)
CREATE TABLE `loyaltybranchlink` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `branchId` INTEGER NOT NULL,
    `customerId` INTEGER NOT NULL,
    `lastActivityAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `loyaltybranchlink_tenantId_customerId_idx`(`tenantId`, `customerId`),
    UNIQUE INDEX `loyaltybranchlink_branchId_customerId_key`(`branchId`, `customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `loyaltybranchlink` ADD CONSTRAINT `loyaltybranchlink_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `loyaltybranchlink` ADD CONSTRAINT `loyaltybranchlink_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `loyaltybranchlink` ADD CONSTRAINT `loyaltybranchlink_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `loyaltycustomer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: registros históricos sin sucursal → sucursal PRINCIPAL del tenant
-- (misma estrategia segura y verificable ya usada para pedidos/reservas).
UPDATE `category` AS `c` INNER JOIN `branch` AS `b` ON `b`.`tenantId` = `c`.`tenantId` AND `b`.`isPrimary` = true SET `c`.`branchId` = `b`.`id` WHERE `c`.`branchId` IS NULL;
UPDATE `event` AS `e` INNER JOIN `branch` AS `b` ON `b`.`tenantId` = `e`.`tenantId` AND `b`.`isPrimary` = true SET `e`.`branchId` = `b`.`id` WHERE `e`.`branchId` IS NULL;
UPDATE `openinghour` AS `h` INNER JOIN `branch` AS `b` ON `b`.`tenantId` = `h`.`tenantId` AND `b`.`isPrimary` = true SET `h`.`branchId` = `b`.`id` WHERE `h`.`branchId` IS NULL;
UPDATE `testimonial` AS `t` INNER JOIN `branch` AS `b` ON `b`.`tenantId` = `t`.`tenantId` AND `b`.`isPrimary` = true SET `t`.`branchId` = `b`.`id` WHERE `t`.`branchId` IS NULL;
UPDATE `promotion` AS `p` INNER JOIN `branch` AS `b` ON `b`.`tenantId` = `p`.`tenantId` AND `b`.`isPrimary` = true SET `p`.`branchId` = `b`.`id` WHERE `p`.`branchId` IS NULL;
UPDATE `notification` AS `n` INNER JOIN `branch` AS `b` ON `b`.`tenantId` = `n`.`tenantId` AND `b`.`isPrimary` = true SET `n`.`branchId` = `b`.`id` WHERE `n`.`branchId` IS NULL;
UPDATE `analyticsevent` AS `a` INNER JOIN `branch` AS `b` ON `b`.`tenantId` = `a`.`tenantId` AND `b`.`isPrimary` = true SET `a`.`branchId` = `b`.`id` WHERE `a`.`branchId` IS NULL;
UPDATE `auditlog` AS `l` INNER JOIN `branch` AS `b` ON `b`.`tenantId` = `l`.`tenantId` AND `b`.`isPrimary` = true SET `l`.`branchId` = `b`.`id` WHERE `l`.`branchId` IS NULL;
UPDATE `mediaasset` AS `m` INNER JOIN `branch` AS `b` ON `b`.`tenantId` = `m`.`tenantId` AND `b`.`isPrimary` = true SET `m`.`branchId` = `b`.`id` WHERE `m`.`branchId` IS NULL;

-- Backfill allBranches: membresías con acceso a TODAS las sucursales del tenant.
-- Regla determinista y verificable; no asume rol owner sin evidencia.
UPDATE `tenantmembership` AS `tm`
SET `tm`.`allBranches` = true
WHERE (
    SELECT COUNT(*) FROM `branchmembership` AS `bm` WHERE `bm`.`membershipId` = `tm`.`id`
) = (
    SELECT COUNT(*) FROM `branch` AS `b` WHERE `b`.`tenantId` = `tm`.`tenantId`
);

-- Backfill licencias: plan del tenant como entitlements por licencia de sucursal.
UPDATE `branchlicense` AS `bl`
INNER JOIN `tenantsubscription` AS `ts` ON `ts`.`tenantId` = `bl`.`tenantId`
SET `bl`.`planId` = `ts`.`planId`
WHERE `bl`.`planId` IS NULL;