CREATE TABLE `themepalette` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenantId` INTEGER NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `presetKey` VARCHAR(50) NULL,
    `baseMode` VARCHAR(10) NOT NULL DEFAULT 'dark',
    `primary` VARCHAR(7) NOT NULL,
    `secondary` VARCHAR(7) NOT NULL,
    `accent` VARCHAR(7) NOT NULL,
    `background` VARCHAR(7) NOT NULL,
    `surface` VARCHAR(7) NOT NULL,
    `surfaceElevated` VARCHAR(7) NOT NULL,
    `text` VARCHAR(7) NOT NULL,
    `textMuted` VARCHAR(7) NOT NULL,
    `border` VARCHAR(7) NOT NULL,
    `success` VARCHAR(7) NOT NULL,
    `warning` VARCHAR(7) NOT NULL,
    `danger` VARCHAR(7) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `themepalette_tenantId_presetKey_key`(`tenantId`, `presetKey`),
    INDEX `themepalette_tenantId_isSystem_name_idx`(`tenantId`, `isSystem`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `tenant` ADD COLUMN `activePaletteId` INTEGER NULL;
ALTER TABLE `themepalette` ADD CONSTRAINT `themepalette_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `tenant` ADD CONSTRAINT `tenant_activePaletteId_fkey` FOREIGN KEY (`activePaletteId`) REFERENCES `themepalette`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO `themepalette` (`tenantId`, `name`, `isSystem`, `baseMode`, `primary`, `secondary`, `accent`, `background`, `surface`, `surfaceElevated`, `text`, `textMuted`, `border`, `success`, `warning`, `danger`, `createdAt`, `updatedAt`)
SELECT `tenantId`, 'Original', false, 'dark', `primaryColor`, `secondaryColor`, `primaryColor`, `backgroundColor`, '#18181b', '#27272a', '#fafafa', '#a1a1aa', '#3f3f46', '#34d399', '#fbbf24', '#f87171', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `brandsettings`;

UPDATE `tenant` AS `t`
INNER JOIN `themepalette` AS `p` ON `p`.`tenantId` = `t`.`id` AND `p`.`name` = 'Original'
SET `t`.`activePaletteId` = `p`.`id`;
