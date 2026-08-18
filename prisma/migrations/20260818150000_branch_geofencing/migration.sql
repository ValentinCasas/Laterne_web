-- Incremental: agrega las columnas de geofencing a la tabla `branch`.
-- Idempotente para permitir re-ejecución segura en cualquier entorno.

ALTER TABLE `branch` ADD COLUMN IF NOT EXISTS `geofenceRadius` INT NULL DEFAULT 150;
ALTER TABLE `branch` ADD COLUMN IF NOT EXISTS `geofenceEnabled` BOOLEAN NOT NULL DEFAULT false;