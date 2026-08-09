-- Crea el primer tenant sin modificar ni eliminar los datos históricos de Laterne.
CREATE TABLE `tenant` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(160) NOT NULL,
  `slug` VARCHAR(120) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `defaultCurrency` VARCHAR(3) NOT NULL DEFAULT 'ARS',
  `locale` VARCHAR(12) NOT NULL DEFAULT 'es-AR',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `tenant_slug_key` (`slug`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `tenant` (`name`, `slug`) VALUES ('Laterne', 'laterne');
SET @laterne_tenant_id = LAST_INSERT_ID();

-- Añade primero columnas compatibles, completa la pertenencia y recién después exige el tenant.
ALTER TABLE `businessinfo` ADD COLUMN `tenantId` INTEGER NULL;
ALTER TABLE `category`
  ADD COLUMN `tenantId` INTEGER NULL,
  ADD COLUMN `slug` VARCHAR(180) NULL,
  ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'published',
  ADD COLUMN `sortOrder` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);
ALTER TABLE `event`
  ADD COLUMN `tenantId` INTEGER NULL,
  ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'published',
  ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);
ALTER TABLE `openinghour` ADD COLUMN `tenantId` INTEGER NULL;
ALTER TABLE `product`
  ADD COLUMN `tenantId` INTEGER NULL,
  ADD COLUMN `slug` VARCHAR(180) NULL,
  ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'published',
  ADD COLUMN `featured` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `isNew` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `recommended` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `vegetarian` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `vegan` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `glutenFree` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `alcoholFree` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `spiceLevel` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `preparationMinutes` INTEGER NULL,
  ADD COLUMN `promotionalPrice` DECIMAL(10, 0) NULL,
  ADD COLUMN `previousPrice` DECIMAL(10, 0) NULL,
  ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);
ALTER TABLE `productcategory` ADD COLUMN `tenantId` INTEGER NULL;
ALTER TABLE `testimonial` ADD COLUMN `tenantId` INTEGER NULL;
ALTER TABLE `user`
  ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

UPDATE `businessinfo` SET `tenantId` = @laterne_tenant_id;
UPDATE `category`
SET `tenantId` = @laterne_tenant_id,
    `slug` = CONCAT('categoria-', `id`);
UPDATE `event` SET `tenantId` = @laterne_tenant_id;
UPDATE `openinghour` SET `tenantId` = @laterne_tenant_id;
UPDATE `product`
SET `tenantId` = @laterne_tenant_id,
    `slug` = CONCAT('producto-', `id`);
UPDATE `productcategory` SET `tenantId` = @laterne_tenant_id;
UPDATE `testimonial` SET `tenantId` = @laterne_tenant_id;

ALTER TABLE `businessinfo` MODIFY `tenantId` INTEGER NOT NULL;
ALTER TABLE `category`
  MODIFY `tenantId` INTEGER NOT NULL,
  MODIFY `slug` VARCHAR(180) NOT NULL;
ALTER TABLE `event` MODIFY `tenantId` INTEGER NOT NULL;
ALTER TABLE `openinghour` MODIFY `tenantId` INTEGER NOT NULL;
ALTER TABLE `product`
  MODIFY `tenantId` INTEGER NOT NULL,
  MODIFY `slug` VARCHAR(180) NOT NULL;
ALTER TABLE `productcategory` MODIFY `tenantId` INTEGER NOT NULL;
ALTER TABLE `testimonial` MODIFY `tenantId` INTEGER NOT NULL;

CREATE UNIQUE INDEX `businessinfo_tenantId_key` ON `businessinfo` (`tenantId`);
CREATE INDEX `category_tenantId_status_sortOrder_idx` ON `category` (`tenantId`, `status`, `sortOrder`);
CREATE UNIQUE INDEX `category_tenantId_slug_key` ON `category` (`tenantId`, `slug`);
CREATE INDEX `event_tenantId_status_date_idx` ON `event` (`tenantId`, `status`, `date`);
CREATE INDEX `openinghour_tenantId_idx` ON `openinghour` (`tenantId`);
CREATE INDEX `product_tenantId_status_featured_idx` ON `product` (`tenantId`, `status`, `featured`);
CREATE UNIQUE INDEX `product_tenantId_slug_key` ON `product` (`tenantId`, `slug`);
CREATE INDEX `productcategory_tenantId_idx` ON `productcategory` (`tenantId`);
CREATE UNIQUE INDEX `productcategory_productId_categoryId_key` ON `productcategory` (`productId`, `categoryId`);
CREATE INDEX `testimonial_tenantId_moderationStatus_idx` ON `testimonial` (`tenantId`, `moderationStatus`);
CREATE UNIQUE INDEX `user_email_key` ON `user` (`email`);

ALTER TABLE `businessinfo` ADD CONSTRAINT `businessinfo_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `category` ADD CONSTRAINT `category_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `event` ADD CONSTRAINT `event_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `openinghour` ADD CONSTRAINT `openinghour_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `product` ADD CONSTRAINT `product_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `productcategory` ADD CONSTRAINT `productcategory_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `testimonial` ADD CONSTRAINT `testimonial_tenantId_fkey`
  FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Define membresías, permisos, sesiones revocables y auditoría.
CREATE TABLE `role` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `key` VARCHAR(60) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) NULL,
  `system` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `role_tenantId_key_key` (`tenantId`, `key`),
  PRIMARY KEY (`id`),
  CONSTRAINT `role_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `permission` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(100) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `description` VARCHAR(255) NULL,
  UNIQUE INDEX `permission_key_key` (`key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `rolepermission` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `roleId` INTEGER NOT NULL,
  `permissionId` INTEGER NOT NULL,
  UNIQUE INDEX `rolepermission_roleId_permissionId_key` (`roleId`, `permissionId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `rolepermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `role` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `rolepermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permission` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tenantmembership` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `userId` INTEGER NOT NULL,
  `roleId` INTEGER NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `tenantmembership_userId_status_idx` (`userId`, `status`),
  UNIQUE INDEX `tenantmembership_tenantId_userId_key` (`tenantId`, `userId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `tenantmembership_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `tenantmembership_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `tenantmembership_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `role` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `authsession` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `membershipId` INTEGER NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `revokedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `authsession_userId_expiresAt_idx` (`userId`, `expiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `authsession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `authsession_membershipId_fkey` FOREIGN KEY (`membershipId`) REFERENCES `tenantmembership` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `auditlog` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `userId` INTEGER NULL,
  `action` VARCHAR(80) NOT NULL,
  `entityType` VARCHAR(80) NOT NULL,
  `entityId` VARCHAR(80) NULL,
  `oldValues` JSON NULL,
  `newValues` JSON NULL,
  `ipAddress` VARCHAR(64) NULL,
  `result` VARCHAR(20) NOT NULL DEFAULT 'success',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `auditlog_tenantId_createdAt_idx` (`tenantId`, `createdAt`),
  INDEX `auditlog_entityType_entityId_idx` (`entityType`, `entityId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `auditlog_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `auditlog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `permission` (`key`, `name`, `description`) VALUES
  ('admin.access', 'Acceder al panel', 'Permite ingresar al espacio administrativo.'),
  ('product.manage', 'Gestionar productos', 'Permite crear, editar y eliminar productos.'),
  ('category.manage', 'Gestionar categorías', 'Permite organizar las categorías de la carta.'),
  ('event.manage', 'Gestionar eventos', 'Permite publicar y modificar eventos.'),
  ('hours.manage', 'Gestionar horarios', 'Permite modificar los horarios del negocio.'),
  ('testimonial.moderate', 'Moderar testimonios', 'Permite aprobar, rechazar y editar opiniones.'),
  ('business.manage', 'Gestionar negocio', 'Permite cambiar contacto, ubicación y configuración.'),
  ('user.manage', 'Gestionar usuarios', 'Permite administrar miembros y permisos.'),
  ('plan.manage', 'Gestionar planes', 'Permite modificar planes y precios comerciales.'),
  ('lead.manage', 'Gestionar oportunidades', 'Permite trabajar solicitudes de demostración.'),
  ('audit.read', 'Consultar auditoría', 'Permite revisar el historial de acciones sensibles.');

INSERT INTO `role` (`tenantId`, `key`, `name`, `description`, `system`) VALUES
  (@laterne_tenant_id, 'owner', 'Propietario', 'Control total del negocio.', true),
  (@laterne_tenant_id, 'administrator', 'Administrador', 'Administra contenido, usuarios y configuración.', true),
  (@laterne_tenant_id, 'menu_editor', 'Editor de carta', 'Gestiona carta, eventos y horarios.', true),
  (@laterne_tenant_id, 'moderator', 'Moderador', 'Gestiona opiniones de la comunidad.', true),
  (@laterne_tenant_id, 'reservation_manager', 'Responsable de reservas', 'Preparado para administrar reservas.', true),
  (@laterne_tenant_id, 'order_manager', 'Responsable de pedidos', 'Preparado para administrar pedidos.', true),
  (@laterne_tenant_id, 'analyst', 'Analista', 'Consulta información y estadísticas.', true),
  (@laterne_tenant_id, 'viewer', 'Solo lectura', 'Consulta contenido sin modificarlo.', true);

INSERT INTO `rolepermission` (`roleId`, `permissionId`)
SELECT `role`.`id`, `permission`.`id`
FROM `role` CROSS JOIN `permission`
WHERE `role`.`tenantId` = @laterne_tenant_id
  AND `role`.`key` IN ('owner', 'administrator');

INSERT INTO `rolepermission` (`roleId`, `permissionId`)
SELECT `role`.`id`, `permission`.`id`
FROM `role` CROSS JOIN `permission`
WHERE `role`.`tenantId` = @laterne_tenant_id
  AND `role`.`key` = 'menu_editor'
  AND `permission`.`key` IN ('admin.access', 'product.manage', 'category.manage', 'event.manage', 'hours.manage');

INSERT INTO `rolepermission` (`roleId`, `permissionId`)
SELECT `role`.`id`, `permission`.`id`
FROM `role` CROSS JOIN `permission`
WHERE `role`.`tenantId` = @laterne_tenant_id
  AND `role`.`key` = 'moderator'
  AND `permission`.`key` IN ('admin.access', 'testimonial.moderate');

INSERT INTO `rolepermission` (`roleId`, `permissionId`)
SELECT `role`.`id`, `permission`.`id`
FROM `role` CROSS JOIN `permission`
WHERE `role`.`tenantId` = @laterne_tenant_id
  AND `role`.`key` IN ('analyst', 'viewer')
  AND `permission`.`key` = 'admin.access';

INSERT INTO `tenantmembership` (`tenantId`, `userId`, `roleId`)
SELECT @laterne_tenant_id, `user`.`id`, `role`.`id`
FROM `user`
JOIN `role`
  ON `role`.`tenantId` = @laterne_tenant_id
 AND `role`.`key` = CASE WHEN `user`.`role` = 1 THEN 'owner' ELSE 'menu_editor' END;

-- Crea el catálogo comercial solicitado; los componentes solamente consultarán estos datos.
CREATE TABLE `plan` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(100) NOT NULL,
  `name` VARCHAR(140) NOT NULL,
  `summary` VARCHAR(500) NOT NULL,
  `audience` VARCHAR(255) NULL,
  `type` VARCHAR(30) NOT NULL DEFAULT 'implementation',
  `billingMode` VARCHAR(30) NOT NULL DEFAULT 'one_time',
  `badge` VARCHAR(80) NULL,
  `highlighted` BOOLEAN NOT NULL DEFAULT false,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `displayOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `plan_slug_key` (`slug`),
  INDEX `plan_active_type_displayOrder_idx` (`active`, `type`, `displayOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `planprice` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `planId` INTEGER NOT NULL,
  `currency` VARCHAR(3) NOT NULL DEFAULT 'ARS',
  `amount` DECIMAL(14, 0) NULL,
  `billingPeriod` VARCHAR(20) NOT NULL DEFAULT 'once',
  `active` BOOLEAN NOT NULL DEFAULT true,
  `validFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `validUntil` DATETIME(3) NULL,
  INDEX `planprice_planId_active_validFrom_idx` (`planId`, `active`, `validFrom`),
  PRIMARY KEY (`id`),
  CONSTRAINT `planprice_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `plan` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `feature` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(100) NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `description` VARCHAR(500) NULL,
  `category` VARCHAR(80) NOT NULL DEFAULT 'general',
  `displayOrder` INTEGER NOT NULL DEFAULT 0,
  `active` BOOLEAN NOT NULL DEFAULT true,
  UNIQUE INDEX `feature_key_key` (`key`),
  INDEX `feature_category_displayOrder_idx` (`category`, `displayOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `planfeature` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `planId` INTEGER NOT NULL,
  `featureId` INTEGER NOT NULL,
  `included` BOOLEAN NOT NULL DEFAULT true,
  `detail` VARCHAR(255) NULL,
  `displayOrder` INTEGER NOT NULL DEFAULT 0,
  INDEX `planfeature_planId_displayOrder_idx` (`planId`, `displayOrder`),
  UNIQUE INDEX `planfeature_planId_featureId_key` (`planId`, `featureId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `planfeature_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `plan` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `planfeature_featureId_fkey` FOREIGN KEY (`featureId`) REFERENCES `feature` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `plan` (`slug`, `name`, `summary`, `audience`, `type`, `billingMode`, `badge`, `highlighted`, `displayOrder`) VALUES
  ('esencial', 'Plan Esencial', 'La presencia digital completa para empezar a vender mejor desde el celular.', 'Negocios que necesitan reemplazar su carta PDF y ordenar su información.', 'implementation', 'one_time', NULL, false, 10),
  ('profesional', 'Plan Profesional', 'Más herramientas comerciales, promociones, reservas y personalización.', 'Negocios en crecimiento que quieren convertir más visitas en clientes.', 'implementation', 'one_time', 'Más elegido', true, 20),
  ('experiencia-3d', 'Plan Experiencia 3D', 'Una experiencia gastronómica premium con productos 3D y realidad aumentada.', 'Marcas que buscan una experiencia diferencial y medible.', 'implementation', 'one_time', 'Experiencia premium', false, 30),
  ('a-medida', 'Plan A Medida', 'Arquitectura, integraciones y funciones diseñadas para una operación particular.', 'Grupos gastronómicos, múltiples sucursales o integraciones complejas.', 'implementation', 'quote', NULL, false, 40),
  ('mantenimiento-esencial', 'Mantenimiento Esencial', 'Mantenimiento preventivo, actualizaciones y asistencia básica.', NULL, 'maintenance', 'monthly', NULL, false, 10),
  ('mantenimiento-profesional', 'Mantenimiento Profesional', 'Seguimiento continuo, mejoras menores y soporte con mayor prioridad.', NULL, 'maintenance', 'monthly', 'Recomendado', true, 20),
  ('mantenimiento-premium', 'Mantenimiento Premium', 'Acompañamiento prioritario para operaciones críticas y evolución continua.', NULL, 'maintenance', 'monthly', NULL, false, 30);

INSERT INTO `planprice` (`planId`, `currency`, `amount`, `billingPeriod`)
SELECT `id`, 'ARS',
  CASE `slug`
    WHEN 'esencial' THEN 690000
    WHEN 'profesional' THEN 1290000
    WHEN 'experiencia-3d' THEN 2490000
    WHEN 'mantenimiento-esencial' THEN 49000
    WHEN 'mantenimiento-profesional' THEN 89000
    WHEN 'mantenimiento-premium' THEN 149000
    ELSE NULL
  END,
  CASE WHEN `type` = 'maintenance' THEN 'month' ELSE 'once' END
FROM `plan`;

INSERT INTO `feature` (`key`, `name`, `category`, `displayOrder`) VALUES
  ('landing', 'Landing institucional', 'Presencia digital', 10),
  ('digital-menu', 'Carta digital con código QR', 'Carta', 20),
  ('unlimited-catalog', 'Productos y categorías ilimitados', 'Carta', 30),
  ('admin-panel', 'Panel administrativo', 'Gestión', 40),
  ('business-info', 'Horarios e información del negocio', 'Gestión', 50),
  ('whatsapp', 'Integración con WhatsApp', 'Pedidos', 60),
  ('responsive', 'Diseño responsive', 'Presencia digital', 70),
  ('media-manager', 'Gestor de imágenes', 'Gestión', 80),
  ('domain-setup', 'Dominio y configuración inicial', 'Implementación', 90),
  ('launch-support', 'Soporte de puesta en marcha', 'Implementación', 100),
  ('advanced-whatsapp', 'Pedidos avanzados por WhatsApp', 'Pedidos', 110),
  ('events', 'Eventos y promociones', 'Marketing', 120),
  ('testimonials', 'Testimonios moderados', 'Marketing', 130),
  ('featured-products', 'Productos destacados', 'Carta', 140),
  ('dietary-info', 'Alérgenos y preferencias alimentarias', 'Carta', 150),
  ('coupons', 'Cupones y promociones', 'Marketing', 160),
  ('reservations', 'Reservas', 'Operación', 170),
  ('basic-analytics', 'Estadísticas básicas', 'Analítica', 180),
  ('advanced-brand', 'Personalización avanzada de marca', 'Presencia digital', 190),
  ('social-integration', 'Integración con redes sociales', 'Marketing', 200),
  ('local-seo', 'Optimización SEO local', 'Presencia digital', 210),
  ('maps-business', 'Google Maps y Business Profile', 'Presencia digital', 220),
  ('product-3d', 'Visualización 3D de productos', 'Experiencia 3D', 230),
  ('augmented-reality', 'Realidad aumentada sobre la mesa', 'Experiencia 3D', 240),
  ('model-management', 'Gestión de modelos 3D', 'Experiencia 3D', 250),
  ('stored-orders', 'Pedidos almacenados', 'Pedidos', 260),
  ('table-management', 'Gestión inicial de mesas', 'Operación', 270),
  ('advanced-analytics', 'Panel de estadísticas avanzado', 'Analítica', 280),
  ('multiple-permissions', 'Múltiples usuarios y permisos', 'Gestión', 290),
  ('training', 'Capacitación personalizada', 'Implementación', 300),
  ('priority-support', 'Soporte prioritario', 'Implementación', 310),
  ('multiple-branches', 'Múltiples sucursales', 'A medida', 320),
  ('payments', 'Mercado Pago', 'A medida', 330),
  ('billing', 'Facturación', 'A medida', 340),
  ('stock', 'Gestión de stock', 'A medida', 350),
  ('external-integrations', 'ERP, CRM e integraciones externas', 'A medida', 360),
  ('installable-app', 'Aplicación instalable', 'A medida', 370),
  ('custom-development', 'Funciones específicas', 'A medida', 380),
  ('preventive-maintenance', 'Mantenimiento preventivo', 'Mantenimiento', 390),
  ('updates', 'Actualizaciones técnicas', 'Mantenimiento', 400),
  ('minor-improvements', 'Mejoras menores continuas', 'Mantenimiento', 410),
  ('monitoring', 'Monitoreo y respuesta prioritaria', 'Mantenimiento', 420);

INSERT INTO `planfeature` (`planId`, `featureId`, `displayOrder`)
SELECT `plan`.`id`, `feature`.`id`, `feature`.`displayOrder`
FROM `plan` JOIN `feature`
WHERE `plan`.`slug` = 'esencial'
  AND `feature`.`key` IN ('landing', 'digital-menu', 'unlimited-catalog', 'admin-panel', 'business-info', 'whatsapp', 'responsive', 'media-manager', 'domain-setup', 'launch-support');

INSERT INTO `planfeature` (`planId`, `featureId`, `displayOrder`)
SELECT `plan`.`id`, `feature`.`id`, `feature`.`displayOrder`
FROM `plan` JOIN `feature`
WHERE `plan`.`slug` = 'profesional'
  AND `feature`.`key` IN ('landing', 'digital-menu', 'unlimited-catalog', 'admin-panel', 'business-info', 'whatsapp', 'responsive', 'media-manager', 'domain-setup', 'launch-support', 'advanced-whatsapp', 'events', 'testimonials', 'featured-products', 'dietary-info', 'coupons', 'reservations', 'basic-analytics', 'advanced-brand', 'social-integration', 'local-seo', 'maps-business');

INSERT INTO `planfeature` (`planId`, `featureId`, `displayOrder`)
SELECT `plan`.`id`, `feature`.`id`, `feature`.`displayOrder`
FROM `plan` JOIN `feature`
WHERE `plan`.`slug` = 'experiencia-3d'
  AND `feature`.`key` IN ('landing', 'digital-menu', 'unlimited-catalog', 'admin-panel', 'business-info', 'whatsapp', 'responsive', 'media-manager', 'domain-setup', 'launch-support', 'advanced-whatsapp', 'events', 'testimonials', 'featured-products', 'dietary-info', 'coupons', 'reservations', 'basic-analytics', 'advanced-brand', 'social-integration', 'local-seo', 'maps-business', 'product-3d', 'augmented-reality', 'model-management', 'stored-orders', 'table-management', 'advanced-analytics', 'multiple-permissions', 'training', 'priority-support');

INSERT INTO `planfeature` (`planId`, `featureId`, `displayOrder`)
SELECT `plan`.`id`, `feature`.`id`, `feature`.`displayOrder`
FROM `plan` JOIN `feature`
WHERE `plan`.`slug` = 'a-medida'
  AND `feature`.`key` IN ('multiple-branches', 'payments', 'billing', 'stock', 'external-integrations', 'installable-app', 'custom-development');

INSERT INTO `planfeature` (`planId`, `featureId`, `displayOrder`)
SELECT `plan`.`id`, `feature`.`id`, `feature`.`displayOrder`
FROM `plan` JOIN `feature`
WHERE `plan`.`slug` = 'mantenimiento-esencial'
  AND `feature`.`key` IN ('preventive-maintenance', 'updates');

INSERT INTO `planfeature` (`planId`, `featureId`, `displayOrder`)
SELECT `plan`.`id`, `feature`.`id`, `feature`.`displayOrder`
FROM `plan` JOIN `feature`
WHERE `plan`.`slug` = 'mantenimiento-profesional'
  AND `feature`.`key` IN ('preventive-maintenance', 'updates', 'minor-improvements');

INSERT INTO `planfeature` (`planId`, `featureId`, `displayOrder`)
SELECT `plan`.`id`, `feature`.`id`, `feature`.`displayOrder`
FROM `plan` JOIN `feature`
WHERE `plan`.`slug` = 'mantenimiento-premium'
  AND `feature`.`key` IN ('preventive-maintenance', 'updates', 'minor-improvements', 'monitoring', 'priority-support');

-- Registra oportunidades comerciales y su historial de estados.
CREATE TABLE `saleslead` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `status` VARCHAR(30) NOT NULL DEFAULT 'new',
  `fullName` VARCHAR(160) NOT NULL,
  `businessName` VARCHAR(180) NOT NULL,
  `businessType` VARCHAR(80) NOT NULL,
  `city` VARCHAR(100) NOT NULL,
  `province` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(60) NOT NULL,
  `email` VARCHAR(190) NOT NULL,
  `approximateProducts` INTEGER NULL,
  `branches` INTEGER NOT NULL DEFAULT 1,
  `planId` INTEGER NULL,
  `requiredFeatures` JSON NULL,
  `approximateBudget` VARCHAR(100) NULL,
  `message` TEXT NULL,
  `consent` BOOLEAN NOT NULL DEFAULT false,
  `source` VARCHAR(100) NOT NULL DEFAULT 'direct',
  `ipHash` VARCHAR(64) NULL,
  `assignedToId` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `saleslead_status_createdAt_idx` (`status`, `createdAt`),
  INDEX `saleslead_email_createdAt_idx` (`email`, `createdAt`),
  INDEX `saleslead_ipHash_createdAt_idx` (`ipHash`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `saleslead_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `plan` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `saleslead_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `leadstatushistory` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `leadId` INTEGER NOT NULL,
  `userId` INTEGER NULL,
  `fromStatus` VARCHAR(30) NULL,
  `toStatus` VARCHAR(30) NOT NULL,
  `note` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `leadstatushistory_leadId_createdAt_idx` (`leadId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `leadstatushistory_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `saleslead` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Prepara filtros alimentarios y relaciones entre productos.
CREATE TABLE `allergen` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NOT NULL,
  UNIQUE INDEX `allergen_tenantId_slug_key` (`tenantId`, `slug`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `productallergen` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `productId` INTEGER NOT NULL,
  `allergenId` INTEGER NOT NULL,
  UNIQUE INDEX `productallergen_productId_allergenId_key` (`productId`, `allergenId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `productallergen_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `productallergen_allergenId_fkey` FOREIGN KEY (`allergenId`) REFERENCES `allergen` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `productrelation` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `productId` INTEGER NOT NULL,
  `relatedProductId` INTEGER NOT NULL,
  `relationType` VARCHAR(30) NOT NULL DEFAULT 'recommended',
  UNIQUE INDEX `productrelation_productId_relatedProductId_relationType_key` (`productId`, `relatedProductId`, `relationType`),
  PRIMARY KEY (`id`),
  CONSTRAINT `productrelation_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `productrelation_relatedProductId_fkey` FOREIGN KEY (`relatedProductId`) REFERENCES `product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `commercialfaq` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `audience` VARCHAR(40) NOT NULL DEFAULT 'plans',
  `question` VARCHAR(255) NOT NULL,
  `answer` TEXT NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `displayOrder` INTEGER NOT NULL DEFAULT 0,
  INDEX `commercialfaq_audience_active_displayOrder_idx` (`audience`, `active`, `displayOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `commercialfaq` (`audience`, `question`, `answer`, `displayOrder`) VALUES
  ('plans', '¿Los precios son definitivos?', 'Son valores iniciales orientativos. El alcance final se confirma después de conocer el negocio, sus contenidos y las integraciones necesarias.', 10),
  ('plans', '¿Qué incluye la implementación?', 'Incluye relevamiento, configuración inicial, diseño, carga o migración acordada, publicación y acompañamiento de puesta en marcha según el plan.', 20),
  ('plans', '¿Dominio y hosting están incluidos?', 'La configuración inicial está contemplada en los planes indicados. La renovación del dominio, el hosting y los servicios externos se detallan por separado en la propuesta.', 30),
  ('plans', '¿Puedo comenzar con un plan y ampliarlo?', 'Sí. La arquitectura está preparada para habilitar nuevas funciones sin reconstruir la carta ni perder la información existente.', 40),
  ('business', '¿Por qué es mejor que una carta PDF?', 'La carta se adapta al celular, se puede buscar, filtrar y actualizar al instante sin volver a enviar o imprimir archivos.', 10),
  ('business', '¿Cuánto demora la puesta en marcha?', 'Depende del contenido y del plan. Después del relevamiento se entrega un cronograma con etapas, responsables y fecha estimada de publicación.', 20);
