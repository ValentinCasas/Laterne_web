-- AlterTable: agrega el tipo de negocio del cliente (Ej. Hamburguesería).
ALTER TABLE `tenant` ADD COLUMN `businessType` VARCHAR(80) NULL;

-- Backfill conservando los datos actuales: Laterne es una hamburguesería.
UPDATE `tenant` SET `businessType` = 'Hamburguesería' WHERE `slug` = 'laterne' AND `businessType` IS NULL;

-- CreateTable: historial de pagos manuales registrados desde MenuClick Platform.
CREATE TABLE `platformpayment` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `tenantId` INT NOT NULL,
    `period` VARCHAR(7) NOT NULL,
    `paidAt` DATETIME(3) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'ARS',
    `method` VARCHAR(40) NOT NULL,
    `reference` VARCHAR(120) NULL,
    `note` TEXT NULL,
    `createdById` INT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `platformpayment`
    ADD CONSTRAINT `platformpayment_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `platformpayment`
    ADD CONSTRAINT `platformpayment_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `user`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddIndex
CREATE INDEX `platformpayment_tenantId_paidAt_idx` ON `platformpayment`(`tenantId`, `paidAt`);
CREATE INDEX `platformpayment_tenantId_period_idx` ON `platformpayment`(`tenantId`, `period`);
CREATE INDEX `platformpayment_createdById_idx` ON `platformpayment`(`createdById`);
