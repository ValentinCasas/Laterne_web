CREATE TABLE `platformsettings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `name` VARCHAR(120) NOT NULL DEFAULT 'MenuClick',
    `logoUrl` VARCHAR(500) NULL,
    `isotypeUrl` VARCHAR(500) NULL,
    `faviconUrl` VARCHAR(500) NULL,
    `activePaletteId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `platformpalette` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `settingsId` INTEGER NOT NULL DEFAULT 1,
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
    UNIQUE INDEX `platformpalette_settingsId_presetKey_key`(`settingsId`, `presetKey`),
    INDEX `platformpalette_settingsId_isSystem_name_idx`(`settingsId`, `isSystem`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `platformpalette` ADD CONSTRAINT `platformpalette_settingsId_fkey` FOREIGN KEY (`settingsId`) REFERENCES `platformsettings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `platformsettings` ADD CONSTRAINT `platformsettings_activePaletteId_fkey` FOREIGN KEY (`activePaletteId`) REFERENCES `platformpalette`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO `platformsettings` (`id`, `name`, `updatedAt`) VALUES (1, 'MenuClick', CURRENT_TIMESTAMP(3));
INSERT INTO `platformpalette` (`settingsId`, `name`, `isSystem`, `presetKey`, `baseMode`, `primary`, `secondary`, `accent`, `background`, `surface`, `surfaceElevated`, `text`, `textMuted`, `border`, `success`, `warning`, `danger`, `updatedAt`)
VALUES (1, 'MenuClick Original', true, 'original', 'dark', '#e8ff6a', '#67e8f9', '#f0abfc', '#0b0d12', '#151a24', '#202735', '#f8fafc', '#94a3b8', '#334155', '#86efac', '#facc15', '#fb7185', CURRENT_TIMESTAMP(3));
UPDATE `platformsettings` SET `activePaletteId` = LAST_INSERT_ID();
