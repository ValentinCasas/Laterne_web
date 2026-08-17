-- Módulo Repartidores: perfiles, sucursales habilitadas, incidencias, historial de estados y permisos.
-- Idempotente: solo crea lo que falta, no toca datos existentes.

-- Tabla: perfil operativo del repartidor (puede existir sin usuario de login)
CREATE TABLE IF NOT EXISTS `driverprofile` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenantId` INT NOT NULL,
  `userId` INT NULL,
  `name` VARCHAR(160) NOT NULL,
  `phone` VARCHAR(60) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'AVAILABLE',
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `vehicleType` VARCHAR(80) NULL,
  `plate` VARCHAR(20) NULL,
  `color` VARCHAR(60) NULL,
  `capacity` INT NULL,
  `notes` TEXT NULL,
  `deactivatedAt` DATETIME NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `driverprofile_tenant_user_idx` (`tenantId`, `userId`),
  INDEX `driverprofile_tenant_active_status_idx` (`tenantId`, `active`, `status`),
  CONSTRAINT `driverprofile_tenantId_tenant_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE,
  CONSTRAINT `driverprofile_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Tabla: sucursales habilitadas por repartidor
CREATE TABLE IF NOT EXISTS `driverbranch` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenantId` INT NOT NULL,
  `driverId` INT NOT NULL,
  `branchId` INT NOT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `driverbranch_tenant_driver_branch_unique` (`tenantId`, `driverId`, `branchId`),
  INDEX `driverbranch_tenant_branch_idx` (`tenantId`, `branchId`),
  CONSTRAINT `driverbranch_tenantId_tenant_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE,
  CONSTRAINT `driverbranch_driverId_driverprofile_id_fk` FOREIGN KEY (`driverId`) REFERENCES `driverprofile` (`id`) ON DELETE CASCADE,
  CONSTRAINT `driverbranch_branchId_branch_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branch` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Tabla: incidencias reportadas durante una entrega
CREATE TABLE IF NOT EXISTS `driverincident` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenantId` INT NOT NULL,
  `driverId` INT NOT NULL,
  `deliveryId` INT NULL,
  `type` VARCHAR(80) NOT NULL,
  `description` TEXT NOT NULL,
  `reportedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reportedById` INT NULL,
  `resolved` BOOLEAN NOT NULL DEFAULT FALSE,
  `resolvedAt` DATETIME NULL,
  `resolution` TEXT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `driverincident_tenant_driver_reportedAt_idx` (`tenantId`, `driverId`, `reportedAt`),
  INDEX `driverincident_tenant_delivery_idx` (`tenantId`, `deliveryId`),
  INDEX `driverincident_tenant_resolved_reportedAt_idx` (`tenantId`, `resolved`, `reportedAt`),
  CONSTRAINT `driverincident_tenantId_tenant_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE,
  CONSTRAINT `driverincident_driverId_driverprofile_id_fk` FOREIGN KEY (`driverId`) REFERENCES `driverprofile` (`id`) ON DELETE CASCADE,
  CONSTRAINT `driverincident_deliveryId_orderdelivery_id_fk` FOREIGN KEY (`deliveryId`) REFERENCES `orderdelivery` (`id`) ON DELETE SET NULL,
  CONSTRAINT `driverincident_reportedById_user_id_fk` FOREIGN KEY (`reportedById`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- OrderDelivery: vinculo al perfil de repartidor (maestro), además del driverId legado (User).
ALTER TABLE `orderdelivery` ADD COLUMN IF NOT EXISTS `driverProfileId` INT NULL;
ALTER TABLE `orderdelivery` ADD INDEX IF NOT EXISTS `orderdelivery_tenant_driverProfile_status_idx` (`tenantId`, `driverProfileId`, `status`);
ALTER TABLE `orderdelivery` ADD CONSTRAINT `orderdelivery_driverProfileId_driverprofile_id_fk`
  FOREIGN KEY (`driverProfileId`) REFERENCES `driverprofile` (`id`) ON DELETE SET NULL;

-- Tabla: historial de estados de entrega (asignación, reasignación, retiro, camino, entrega, incidencia).
CREATE TABLE IF NOT EXISTS `orderdeliverystatuslog` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenantId` INT NOT NULL,
  `deliveryId` INT NOT NULL,
  `driverProfileId` INT NULL,
  `status` VARCHAR(24) NOT NULL,
  `previousStatus` VARCHAR(24) NULL,
  `reason` VARCHAR(500) NULL,
  `changedById` INT NULL,
  `changedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `odslog_tenant_delivery_changedAt_idx` (`tenantId`, `deliveryId`, `changedAt`),
  INDEX `odslog_tenant_driver_status_changedAt_idx` (`tenantId`, `driverProfileId`, `status`, `changedAt`),
  CONSTRAINT `odslog_tenantId_tenant_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE,
  CONSTRAINT `odslog_deliveryId_orderdelivery_id_fk` FOREIGN KEY (`deliveryId`) REFERENCES `orderdelivery` (`id`) ON DELETE CASCADE,
  CONSTRAINT `odslog_driverProfileId_driverprofile_id_fk` FOREIGN KEY (`driverProfileId`) REFERENCES `driverprofile` (`id`) ON DELETE SET NULL,
  CONSTRAINT `odslog_changedById_user_id_fk` FOREIGN KEY (`changedById`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Permisos del módulo
INSERT INTO `permission` (`key`, `name`, `description`) VALUES
  ('driver.view', 'Consultar repartidores', 'Permite ver el maestro de repartidores y sus entregas.'),
  ('driver.manage', 'Gestionar repartidores', 'Permite crear, editar, eliminar y asignar entregas a repartidores.'),
  ('driver.self', 'Vista personal de repartidor', 'Permite al repartidor ver y operar solo sus propias entregas.'),
  ('incident.view', 'Consultar incidencias', 'Permite ver incidencias de entregas.'),
  ('incident.manage', 'Gestionar incidencias', 'Permite resolver y administrar incidencias de entregas.')
ON DUPLICATE KEY UPDATE `key` = `key`;

-- Rol de sistema "driver" (Repartidor) por tenant: solo su vista personal.
INSERT INTO `role` (`tenantId`, `key`, `name`, `description`, `system`, `createdAt`, `updatedAt`)
SELECT t.id, 'driver', 'Repartidor', 'Accede a sus entregas y reporta incidencias.', TRUE, NOW(3), NOW(3)
FROM `tenant` t
WHERE NOT EXISTS (
  SELECT 1 FROM `role` existing
  WHERE existing.`tenantId` = t.id AND existing.`key` = 'driver'
);

-- driver.self para el rol Repartidor
INSERT INTO `rolepermission` (`roleId`, `permissionId`)
SELECT r.id, p.id
FROM `role` r
CROSS JOIN `permission` p
WHERE r.`key` = 'driver'
  AND p.`key` IN ('driver.self', 'admin.access')
  AND NOT EXISTS (
    SELECT 1 FROM `rolepermission` existing
    WHERE existing.`roleId` = r.id AND existing.`permissionId` = p.id
  );

-- owner y administrator: ven y gestionan repartidores e incidencias
INSERT INTO `rolepermission` (`roleId`, `permissionId`)
SELECT r.id, p.id
FROM `role` r
CROSS JOIN `permission` p
WHERE r.`key` IN ('owner', 'administrator')
  AND p.`key` IN ('driver.view', 'driver.manage', 'incident.view', 'incident.manage')
  AND NOT EXISTS (
    SELECT 1 FROM `rolepermission` existing
    WHERE existing.`roleId` = r.id AND existing.`permissionId` = p.id
  );