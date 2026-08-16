-- Identificador público inmutable (GUID) de cada negocio para URLs administrativas.
-- Se agrega nullable, se rellena sin perder datos y luego se vuelve NOT NULL + UNIQUE.
ALTER TABLE `tenant`
  ADD COLUMN `publicGuid` VARCHAR(36) NULL AFTER `slug`;

UPDATE `tenant`
SET `publicGuid` = LOWER(UUID())
WHERE `publicGuid` IS NULL OR `publicGuid` = '';

ALTER TABLE `tenant`
  MODIFY `publicGuid` VARCHAR(36) NOT NULL,
  ADD UNIQUE INDEX `tenant_publicGuid_key`(`publicGuid`);

-- Licencias: una sucursal puede tener varias licencias (refuerzos de cupos).
-- Se reemplaza el UNIQUE (tenantId, branchId) por un índice no excluyente y se
-- agregan los cupos de usuarios y el precio por usuario para el modelo comercial.
ALTER TABLE `branchlicense`
  DROP INDEX `branchlicense_tenantId_branchId_key`,
  ADD INDEX `branchlicense_tenantId_branchId_status_idx`(`tenantId`, `branchId`, `status`),
  ADD COLUMN `pricePerUser` DECIMAL(14, 2) NULL,
  ADD COLUMN `usersAllowed` INTEGER NOT NULL DEFAULT 0;