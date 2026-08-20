-- Alinea campos relacionales ya presentes en el schema y agrega preferencias por usuario.
-- Todos los cambios son incrementales y preservan los datos existentes.

ALTER TABLE `driverposition`
  ADD COLUMN IF NOT EXISTS `driverProfileId` INT NULL AFTER `driverId`,
  ADD INDEX IF NOT EXISTS `driverposition_driverProfileId_driverprofile_id_fk` (`driverProfileId`);

ALTER TABLE `driverposition`
  ADD CONSTRAINT `driverposition_driverProfileId_driverprofile_id_fk`
  FOREIGN KEY (`driverProfileId`) REFERENCES `driverprofile` (`id`) ON DELETE SET NULL;

ALTER TABLE `stocktransfer`
  ADD COLUMN IF NOT EXISTS `reversedById` INT NULL AFTER `note`,
  ADD INDEX IF NOT EXISTS `stocktransfer_reversedById_user_id_fk` (`reversedById`);

ALTER TABLE `stocktransfer`
  ADD CONSTRAINT `stocktransfer_reversedById_user_id_fk`
  FOREIGN KEY (`reversedById`) REFERENCES `user` (`id`) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS `userpreference` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `tenantId` INT NOT NULL,
  `key` VARCHAR(120) NOT NULL,
  `value` VARCHAR(255) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `userpreference_userId_key_key` (`userId`, `key`),
  INDEX `userpreference_tenantId_userId_idx` (`tenantId`, `userId`),
  CONSTRAINT `userpreference_userId_user_id_fk`
    FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `userpreference_tenantId_tenant_id_fk`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
