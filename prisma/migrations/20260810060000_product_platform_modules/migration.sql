ALTER TABLE `user` ADD COLUMN `isSuperAdmin` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `brandsettings` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `logoUrl` VARCHAR(500) NULL,
  `isotypeUrl` VARCHAR(500) NULL,
  `faviconUrl` VARCHAR(500) NULL,
  `primaryColor` VARCHAR(20) NOT NULL DEFAULT '#ec4899',
  `secondaryColor` VARCHAR(20) NOT NULL DEFAULT '#f5c542',
  `backgroundColor` VARCHAR(20) NOT NULL DEFAULT '#09090b',
  `fontFamily` VARCHAR(100) NOT NULL DEFAULT 'Inter',
  `buttonStyle` VARCHAR(30) NOT NULL DEFAULT 'rounded',
  `cardStyle` VARCHAR(30) NOT NULL DEFAULT 'soft',
  `heroTitle` VARCHAR(220) NULL,
  `heroSubtitle` VARCHAR(500) NULL,
  `tone` VARCHAR(120) NULL,
  `socialLinks` JSON NULL,
  `customDomain` VARCHAR(255) NULL,
  `analyticsId` VARCHAR(100) NULL,
  `metaPixelId` VARCHAR(100) NULL,
  `searchConsoleId` VARCHAR(255) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `brandsettings_tenantId_key` (`tenantId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `brandsettings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tenantsubscription` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `planId` INTEGER NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'active',
  `startsAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `endsAt` DATETIME(3) NULL,
  `renewalAmount` DECIMAL(14, 2) NULL,
  `limits` JSON NULL,
  `enabled` JSON NULL,
  `notes` TEXT NULL,
  `lastPaymentAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `tenantsubscription_tenantId_key` (`tenantId`),
  INDEX `tenantsubscription_status_endsAt_idx` (`status`, `endsAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `tenantsubscription_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `tenantsubscription_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `plan` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `onboardingprogress` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `completedSteps` JSON NULL,
  `currentStep` INTEGER NOT NULL DEFAULT 1,
  `percentage` INTEGER NOT NULL DEFAULT 0,
  `publishedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `onboardingprogress_tenantId_key` (`tenantId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `onboardingprogress_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `notificationsettings` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `panel` BOOLEAN NOT NULL DEFAULT true,
  `email` BOOLEAN NOT NULL DEFAULT false,
  `whatsapp` BOOLEAN NOT NULL DEFAULT false,
  `webPush` BOOLEAN NOT NULL DEFAULT false,
  `events` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `notificationsettings_tenantId_key` (`tenantId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `notificationsettings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `legalpage` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `slug` VARCHAR(100) NOT NULL,
  `title` VARCHAR(180) NOT NULL,
  `content` LONGTEXT NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'published',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `legalpage_tenantId_slug_key` (`tenantId`, `slug`),
  INDEX `legalpage_tenantId_status_idx` (`tenantId`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `legalpage_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `helparticle` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `slug` VARCHAR(140) NOT NULL,
  `title` VARCHAR(220) NOT NULL,
  `summary` VARCHAR(500) NOT NULL,
  `content` LONGTEXT NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `audience` VARCHAR(30) NOT NULL DEFAULT 'public',
  `status` VARCHAR(20) NOT NULL DEFAULT 'published',
  `displayOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `helparticle_tenantId_slug_key` (`tenantId`, `slug`),
  INDEX `helparticle_tenantId_audience_status_displayOrder_idx` (`tenantId`, `audience`, `status`, `displayOrder`),
  PRIMARY KEY (`id`),
  CONSTRAINT `helparticle_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `supportticket` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `reference` VARCHAR(24) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'open',
  `category` VARCHAR(100) NOT NULL,
  `customerName` VARCHAR(160) NOT NULL,
  `email` VARCHAR(190) NOT NULL,
  `phone` VARCHAR(60) NULL,
  `subject` VARCHAR(220) NOT NULL,
  `message` TEXT NOT NULL,
  `adminNotes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `supportticket_reference_key` (`reference`),
  INDEX `supportticket_tenantId_status_createdAt_idx` (`tenantId`, `status`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `supportticket_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `mediaasset` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `userId` INTEGER NULL,
  `folder` VARCHAR(100) NOT NULL,
  `filename` VARCHAR(255) NOT NULL,
  `url` VARCHAR(500) NOT NULL,
  `mimeType` VARCHAR(120) NOT NULL,
  `sizeBytes` BIGINT NOT NULL,
  `altText` VARCHAR(300) NULL,
  `checksum` VARCHAR(64) NOT NULL,
  `width` INTEGER NULL,
  `height` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `mediaasset_tenantId_checksum_folder_key` (`tenantId`, `checksum`, `folder`),
  INDEX `mediaasset_tenantId_folder_createdAt_idx` (`tenantId`, `folder`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `mediaasset_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `mediaasset_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `loyaltycustomer` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `publicTokenHash` VARCHAR(64) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `email` VARCHAR(190) NULL,
  `phone` VARCHAR(60) NULL,
  `birthday` DATE NULL,
  `points` INTEGER NOT NULL DEFAULT 0,
  `tier` VARCHAR(40) NOT NULL DEFAULT 'inicial',
  `consentAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `loyaltycustomer_publicTokenHash_key` (`publicTokenHash`),
  UNIQUE INDEX `loyaltycustomer_tenantId_email_key` (`tenantId`, `email`),
  UNIQUE INDEX `loyaltycustomer_tenantId_phone_key` (`tenantId`, `phone`),
  INDEX `loyaltycustomer_tenantId_tier_points_idx` (`tenantId`, `tier`, `points`),
  PRIMARY KEY (`id`),
  CONSTRAINT `loyaltycustomer_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `loyaltytransaction` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `customerId` INTEGER NOT NULL,
  `points` INTEGER NOT NULL,
  `reason` VARCHAR(220) NOT NULL,
  `reference` VARCHAR(80) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `loyaltytransaction_customerId_createdAt_idx` (`customerId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `loyaltytransaction_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `loyaltycustomer` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `customerorder`
  ADD COLUMN `customerId` INTEGER NULL AFTER `tableId`,
  ADD INDEX `customerorder_tenantId_customerId_createdAt_idx` (`tenantId`, `customerId`, `createdAt`),
  ADD CONSTRAINT `customerorder_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `loyaltycustomer` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO `brandsettings` (`tenantId`, `updatedAt`)
SELECT `id`, CURRENT_TIMESTAMP(3) FROM `tenant`;

INSERT INTO `notificationsettings` (`tenantId`, `updatedAt`)
SELECT `id`, CURRENT_TIMESTAMP(3) FROM `tenant`;

INSERT INTO `onboardingprogress` (`tenantId`, `completedSteps`, `percentage`, `updatedAt`)
SELECT `id`, JSON_ARRAY(), 0, CURRENT_TIMESTAMP(3) FROM `tenant`;

INSERT INTO `tenantsubscription` (`tenantId`, `status`, `updatedAt`)
SELECT `id`, 'active', CURRENT_TIMESTAMP(3) FROM `tenant`;

UPDATE `user`
SET `isSuperAdmin` = true
WHERE `id` = (
  SELECT `id` FROM (
    SELECT `id` FROM `user` WHERE `role` = 1 ORDER BY `id` ASC LIMIT 1
  ) AS `first_admin`
);
