ALTER TABLE `reservation`
  ADD COLUMN `deletedAt` DATETIME(3) NULL;

CREATE INDEX `reservation_tenantId_deletedAt_idx`
  ON `reservation`(`tenantId`, `deletedAt`);
