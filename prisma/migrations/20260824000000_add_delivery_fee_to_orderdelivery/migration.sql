-- @summary Agrega deliveryFee a orderdelivery. Columna requerida por schema Prisma que no fue incluida en la migración original.
-- Add column
ALTER TABLE `orderdelivery` ADD COLUMN `deliveryFee` DECIMAL(12, 2) NOT NULL DEFAULT 0 AFTER `receiverName`;
