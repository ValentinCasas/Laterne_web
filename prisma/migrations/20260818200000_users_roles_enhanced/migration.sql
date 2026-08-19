-- =============================================================
-- 20260818200000_users_roles_enhanced
-- Usuarios/Roles mejorados: PIN hash, nuevos permisos, presets
-- =============================================================

-- 1) Campo PIN hash en User (bcrypt, 6 dígitos, nullable)
ALTER TABLE `user` ADD COLUMN `pinHash` VARCHAR(255) NULL;

-- 2) Nuevos permisos para módulos gastronómicos que faltaban
INSERT IGNORE INTO `permission` (`key`, `name`, `description`) VALUES
  ('kitchen.manage', 'Gestionar cocina', 'Permite operar el KDS, gestionar estaciones y comandas.'),
  ('inventory.manage', 'Gestionar inventario', 'Permite realizar conteos, movimientos y ajustes de stock.');

-- 3) Asignar nuevos permisos a owner y administrator
INSERT INTO `rolepermission` (`roleId`, `permissionId`)
SELECT r.id, p.id
FROM `role` r
CROSS JOIN `permission` p
WHERE r.`system` = true
  AND p.`key` IN ('kitchen.manage', 'inventory.manage')
  AND r.`key` IN ('owner', 'administrator')
  AND NOT EXISTS (
    SELECT 1 FROM `rolepermission` rp
    WHERE rp.`roleId` = r.id AND rp.`permissionId` = p.id
  );

-- 4) order_manager: agregar kitchen.manage
INSERT INTO `rolepermission` (`roleId`, `permissionId`)
SELECT r.id, p.id
FROM `role` r
CROSS JOIN `permission` p
WHERE r.`system` = true
  AND p.`key` = 'kitchen.manage'
  AND r.`key` = 'order_manager'
  AND NOT EXISTS (
    SELECT 1 FROM `rolepermission` rp
    WHERE rp.`roleId` = r.id AND rp.`permissionId` = p.id
  );

-- 5) menu_editor: agregar inventory.manage (gestiona ingredientes y stock)
INSERT INTO `rolepermission` (`roleId`, `permissionId`)
SELECT r.id, p.id
FROM `role` r
CROSS JOIN `permission` p
WHERE r.`system` = true
  AND p.`key` = 'inventory.manage'
  AND r.`key` = 'menu_editor'
  AND NOT EXISTS (
    SELECT 1 FROM `rolepermission` rp
    WHERE rp.`roleId` = r.id AND rp.`permissionId` = p.id
  );
