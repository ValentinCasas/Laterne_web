CREATE TABLE `promotion` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `slug` VARCHAR(180) NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `description` VARCHAR(700) NOT NULL,
  `imageUrl` VARCHAR(255) NULL,
  `type` VARCHAR(30) NOT NULL,
  `discountValue` DECIMAL(12, 2) NULL,
  `buyQuantity` INTEGER NULL,
  `receiveQuantity` INTEGER NULL,
  `startAt` DATETIME(3) NULL,
  `endAt` DATETIME(3) NULL,
  `startTime` TIME(0) NULL,
  `endTime` TIME(0) NULL,
  `daysOfWeek` JSON NULL,
  `conditions` TEXT NULL,
  `code` VARCHAR(80) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'published',
  `priority` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `promotion_tenantId_slug_key` (`tenantId`, `slug`),
  INDEX `promotion_tenantId_status_startAt_endAt_idx` (`tenantId`, `status`, `startAt`, `endAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `promotion_tenant_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `promotionproduct` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `promotionId` INTEGER NOT NULL,
  `productId` INTEGER NOT NULL,
  UNIQUE INDEX `promotionproduct_promotionId_productId_key` (`promotionId`, `productId`),
  INDEX `promotionproduct_tenantId_productId_idx` (`tenantId`, `productId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `promotionproduct_tenant_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `promotionproduct_promotion_fkey` FOREIGN KEY (`promotionId`) REFERENCES `promotion` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `promotionproduct_product_fkey` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `promotioncategory` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `promotionId` INTEGER NOT NULL,
  `categoryId` INTEGER NOT NULL,
  UNIQUE INDEX `promotioncategory_promotionId_categoryId_key` (`promotionId`, `categoryId`),
  INDEX `promotioncategory_tenantId_categoryId_idx` (`tenantId`, `categoryId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `promotioncategory_tenant_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `promotioncategory_promotion_fkey` FOREIGN KEY (`promotionId`) REFERENCES `promotion` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `promotioncategory_category_fkey` FOREIGN KEY (`categoryId`) REFERENCES `category` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `reservationsettings` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT TRUE,
  `capacityPerSlot` INTEGER NOT NULL DEFAULT 30,
  `slotInterval` INTEGER NOT NULL DEFAULT 30,
  `minimumLeadHours` INTEGER NOT NULL DEFAULT 2,
  `maximumAdvanceDays` INTEGER NOT NULL DEFAULT 60,
  `maximumPartySize` INTEGER NOT NULL DEFAULT 20,
  `defaultDuration` INTEGER NOT NULL DEFAULT 120,
  `sectors` JSON NULL,
  `policy` TEXT NULL,
  `confirmationMode` VARCHAR(20) NOT NULL DEFAULT 'manual',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `reservationsettings_tenantId_key` (`tenantId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `reservationsettings_tenant_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `reservationblock` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `startDate` DATE NOT NULL,
  `endDate` DATE NOT NULL,
  `startTime` TIME(0) NULL,
  `endTime` TIME(0) NULL,
  `reason` VARCHAR(255) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `reservationblock_tenantId_startDate_endDate_idx` (`tenantId`, `startDate`, `endDate`),
  PRIMARY KEY (`id`),
  CONSTRAINT `reservationblock_tenant_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `reservation` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `reference` VARCHAR(24) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'pending',
  `reservationDate` DATE NOT NULL,
  `reservationTime` TIME(0) NOT NULL,
  `partySize` INTEGER NOT NULL,
  `sector` VARCHAR(100) NULL,
  `customerName` VARCHAR(160) NOT NULL,
  `phone` VARCHAR(60) NOT NULL,
  `email` VARCHAR(190) NOT NULL,
  `notes` TEXT NULL,
  `reason` VARCHAR(160) NULL,
  `acceptedPolicy` BOOLEAN NOT NULL DEFAULT FALSE,
  `source` VARCHAR(60) NOT NULL DEFAULT 'website',
  `ipHash` VARCHAR(64) NULL,
  `estimatedDuration` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `reservation_reference_key` (`reference`),
  INDEX `reservation_tenantId_reservationDate_reservationTime_idx` (`tenantId`, `reservationDate`, `reservationTime`),
  INDEX `reservation_tenantId_status_createdAt_idx` (`tenantId`, `status`, `createdAt`),
  INDEX `reservation_ipHash_createdAt_idx` (`ipHash`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `reservation_tenant_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `reservationstatushistory` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `reservationId` INTEGER NOT NULL,
  `userId` INTEGER NULL,
  `fromStatus` VARCHAR(24) NULL,
  `toStatus` VARCHAR(24) NOT NULL,
  `note` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `reservationstatushistory_reservationId_createdAt_idx` (`reservationId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `reservationhistory_reservation_fkey` FOREIGN KEY (`reservationId`) REFERENCES `reservation` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `notification` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `type` VARCHAR(60) NOT NULL,
  `title` VARCHAR(180) NOT NULL,
  `message` VARCHAR(700) NOT NULL,
  `link` VARCHAR(500) NULL,
  `readAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `notification_tenantId_readAt_createdAt_idx` (`tenantId`, `readAt`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `notification_tenant_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `permission` (`key`, `name`, `description`) VALUES
  ('promotion.manage', 'Gestionar promociones', 'Permite crear y publicar beneficios comerciales.'),
  ('reservation.manage', 'Gestionar reservas', 'Permite confirmar, rechazar y organizar reservas.'),
  ('order.manage', 'Gestionar pedidos', 'Permite administrar pedidos y sus estados.'),
  ('table.manage', 'Gestionar mesas', 'Permite configurar mesas y códigos QR.'),
  ('analytics.read', 'Consultar estadísticas', 'Permite analizar actividad y conversiones.'),
  ('customer.manage', 'Gestionar clientes', 'Permite administrar fidelización y datos de clientes.'),
  ('notification.manage', 'Gestionar notificaciones', 'Permite consultar y configurar avisos.'),
  ('brand.manage', 'Personalizar marca', 'Permite cambiar la identidad visual del negocio.'),
  ('content.manage', 'Gestionar contenido institucional', 'Permite editar páginas legales y de ayuda.'),
  ('tenant.manage', 'Gestionar empresas', 'Permite administrar clientes de la plataforma.'),
  ('media.manage', 'Gestionar multimedia', 'Permite organizar imágenes y modelos 3D.'),
  ('support.manage', 'Gestionar soporte', 'Permite responder consultas de soporte.')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `description` = VALUES(`description`);

INSERT IGNORE INTO `rolepermission` (`roleId`, `permissionId`)
SELECT `role`.`id`, `permission`.`id`
FROM `role` CROSS JOIN `permission`
WHERE `role`.`key` IN ('owner', 'administrator')
  AND `permission`.`key` IN (
    'promotion.manage', 'reservation.manage', 'order.manage', 'table.manage', 'analytics.read',
    'customer.manage', 'notification.manage', 'brand.manage', 'content.manage', 'tenant.manage',
    'media.manage', 'support.manage'
  );

INSERT IGNORE INTO `rolepermission` (`roleId`, `permissionId`)
SELECT `role`.`id`, `permission`.`id`
FROM `role` CROSS JOIN `permission`
WHERE (`role`.`key` = 'menu_editor' AND `permission`.`key` = 'promotion.manage')
   OR (`role`.`key` = 'reservation_manager' AND `permission`.`key` IN ('admin.access', 'reservation.manage'))
   OR (`role`.`key` = 'order_manager' AND `permission`.`key` IN ('admin.access', 'order.manage', 'table.manage'))
   OR (`role`.`key` = 'analyst' AND `permission`.`key` IN ('admin.access', 'analytics.read'));

INSERT IGNORE INTO `reservationsettings`
  (`tenantId`, `sectors`, `policy`)
SELECT
  `id`,
  JSON_ARRAY('Salón', 'Exterior', 'Sin preferencia'),
  'La reserva queda pendiente hasta recibir confirmación del negocio.'
FROM `tenant`;
