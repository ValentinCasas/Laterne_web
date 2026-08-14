-- Reservations use minute-level lead time while preserving the legacy hour field.
ALTER TABLE `reservationsettings`
  ADD COLUMN `minimumLeadMinutes` INTEGER NOT NULL DEFAULT 120 AFTER `slotInterval`;

UPDATE `reservationsettings`
SET `minimumLeadMinutes` = GREATEST(0, `minimumLeadHours` * 60);

-- Immutable Word templates per tenant and visual document type.
CREATE TABLE `documenttemplate` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `documentType` VARCHAR(40) NOT NULL DEFAULT 'internal_receipt',
  `name` VARCHAR(160) NOT NULL,
  `originalFilename` VARCHAR(255) NOT NULL,
  `mimeType` VARCHAR(120) NOT NULL,
  `sizeBytes` INTEGER NOT NULL,
  `checksum` CHAR(64) NOT NULL,
  `content` LONGBLOB NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `active` BOOLEAN NOT NULL DEFAULT false,
  `isDefault` BOOLEAN NOT NULL DEFAULT false,
  `deletedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `documenttemplate_tenantId_documentType_version_key`(`tenantId`, `documentType`, `version`),
  UNIQUE INDEX `documenttemplate_tenantId_documentType_checksum_key`(`tenantId`, `documentType`, `checksum`),
  INDEX `documenttemplate_tenantId_documentType_active_deletedAt_idx`(`tenantId`, `documentType`, `active`, `deletedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `invoicedocumentartifact` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `invoiceId` INTEGER NOT NULL,
  `templateId` INTEGER NULL,
  `templateVersion` INTEGER NULL,
  `docx` LONGBLOB NOT NULL,
  `pdf` LONGBLOB NULL,
  `pdfStatus` VARCHAR(24) NOT NULL DEFAULT 'unavailable',
  `converter` VARCHAR(80) NULL,
  `conversionMessage` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `invoicedocumentartifact_invoiceId_key`(`invoiceId`),
  INDEX `invoicedocumentartifact_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
  INDEX `invoicedocumentartifact_templateId_idx`(`templateId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `documenttemplate`
  ADD CONSTRAINT `documenttemplate_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `invoicedocumentartifact`
  ADD CONSTRAINT `invoicedocumentartifact_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `invoicedocumentartifact_invoiceId_fkey`
  FOREIGN KEY (`invoiceId`) REFERENCES `invoicerecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `invoicedocumentartifact_templateId_fkey`
  FOREIGN KEY (`templateId`) REFERENCES `documenttemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
