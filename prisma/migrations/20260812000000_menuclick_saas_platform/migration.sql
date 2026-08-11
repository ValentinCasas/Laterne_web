-- Migration: MenuClick SaaS Platform — separación de contextos (platform/admin/tenant).
-- Conserva todos los datos existentes; solo normaliza estados y agrega capacidades.

-- AlterTable: usuarios internos de MenuClick.
ALTER TABLE `user` ADD COLUMN `platformRole` VARCHAR(40) NULL;

-- AlterTable: sesiones con contexto (platform / tenant) y membresía opcional.
ALTER TABLE `authsession` ADD COLUMN `context` VARCHAR(20) NOT NULL DEFAULT 'tenant',
    MODIFY `membershipId` INTEGER NULL;

-- AlterTable: auditoría de plataforma que no siempre afecta a un tenant.
ALTER TABLE `auditlog` MODIFY `tenantId` INTEGER NULL;

-- AlterTable: planes con capacidades comerciales y trial configurable.
ALTER TABLE `plan` ADD COLUMN `capacity` JSON NULL,
    ADD COLUMN `trialDays` INTEGER NOT NULL DEFAULT 7;

-- Backfill de capacidades del catálogo existente (fuente de verdad para límites).
UPDATE `plan` SET `capacity` = JSON_OBJECT('products', 60, 'users', 1, 'branches', 1, 'storageMb', 512, 'tables', 8)
    WHERE `slug` = 'esencial' AND `capacity` IS NULL;
UPDATE `plan` SET `capacity` = JSON_OBJECT('products', 200, 'users', 5, 'branches', 3, 'storageMb', 2048, 'tables', 30)
    WHERE `slug` = 'profesional' AND `capacity` IS NULL;
UPDATE `plan` SET `capacity` = JSON_OBJECT('products', 200, 'users', 3, 'branches', 1, 'storageMb', 4096, 'tables', 20)
    WHERE `slug` = 'experiencia-3d' AND `capacity` IS NULL;
UPDATE `plan` SET `capacity` = JSON_OBJECT()
    WHERE `slug` IN ('a-medida', 'mantenimiento-esencial', 'mantenimiento-profesional', 'mantenimiento-premium') AND `capacity` IS NULL;

-- AlterTable: ciclo de vida comercial de la suscripción.
ALTER TABLE `tenantsubscription` ADD COLUMN `cancelledAt` DATETIME(3) NULL,
    ADD COLUMN `currentPeriodEnd` DATETIME(3) NULL,
    ADD COLUMN `currentPeriodStart` DATETIME(3) NULL,
    ADD COLUMN `gracePeriodEndsAt` DATETIME(3) NULL,
    ADD COLUMN `overrides` JSON NULL,
    ADD COLUMN `planChangedAt` DATETIME(3) NULL,
    ADD COLUMN `suspendedAt` DATETIME(3) NULL,
    ADD COLUMN `trialEndsAt` DATETIME(3) NULL;

-- Backfill de estados existentes hacia el enum comercial normalizado.
UPDATE `tenantsubscription` SET `status` = 'ACTIVE' WHERE `status` IN ('active', 'activa', '1');
UPDATE `tenantsubscription` SET `status` = 'TRIAL' WHERE `status` IN ('trial', 'trialing');
UPDATE `tenantsubscription` SET `status` = 'PAYMENT_PENDING' WHERE `status` IN ('pending', 'payment_pending', 'overdue', 'unpaid', 'pago_pendiente');
UPDATE `tenantsubscription` SET `status` = 'GRACE_PERIOD' WHERE `status` IN ('grace', 'grace_period', 'periodo_gracia');
UPDATE `tenantsubscription` SET `status` = 'SUSPENDED' WHERE `status` IN ('suspended', 'suspendido', 'blocked');
UPDATE `tenantsubscription` SET `status` = 'CANCELLED' WHERE `status` IN ('cancelled', 'canceled', 'cancelado', '0');

-- Backfill del ciclo: el período actual deriva de los valores existentes.
UPDATE `tenantsubscription` SET `currentPeriodStart` = `startsAt` WHERE `currentPeriodStart` IS NULL AND `startsAt` IS NOT NULL;
UPDATE `tenantsubscription` SET `currentPeriodEnd` = `endsAt` WHERE `currentPeriodEnd` IS NULL AND `endsAt` IS NOT NULL;

-- AlterTable: estado comercial tipado.
ALTER TABLE `tenantsubscription`
    MODIFY `status` ENUM('TRIAL', 'ACTIVE', 'PAYMENT_PENDING', 'GRACE_PERIOD', 'SUSPENDED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex: accesos rápidos de plataforma.
CREATE INDEX `authsession_membershipId_context_idx` ON `authsession`(`membershipId`, `context`);
CREATE INDEX `brandsettings_customDomain_idx` ON `brandsettings`(`customDomain`);
CREATE INDEX `tenantsubscription_status_currentPeriodEnd_idx` ON `tenantsubscription`(`status`, `currentPeriodEnd`);
