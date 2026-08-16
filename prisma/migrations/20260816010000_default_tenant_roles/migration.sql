-- Backfill de los roles de sistema para tenants existentes que solo tienen "owner".
-- Nueva implementación: idempotente para cualquier tenant (solo inserta lo faltante).

SET @now = NOW(3);

INSERT INTO `role` (`tenantId`, `key`, `name`, `description`, `system`, `createdAt`, `updatedAt`)
SELECT t.id, d.`key`, d.`name`, d.`description`, d.`system`, @now, @now
FROM `tenant` t
CROSS JOIN (
  SELECT 'owner' AS `key`, 'Propietario' AS `name`, 'Control total del negocio.' AS `description`, true AS `system`
  UNION ALL SELECT 'administrator', 'Administrador', 'Administra contenido, usuarios y configuración.', true
  UNION ALL SELECT 'menu_editor', 'Editor de carta', 'Gestiona carta, eventos, horarios y promociones.', true
  UNION ALL SELECT 'moderator', 'Moderador', 'Gestiona opiniones de la comunidad.', true
  UNION ALL SELECT 'reservation_manager', 'Responsable de reservas', 'Administra reservas.', true
  UNION ALL SELECT 'order_manager', 'Responsable de pedidos', 'Administra pedidos y mesas.', true
  UNION ALL SELECT 'analyst', 'Analista', 'Consulta información y estadísticas.', true
  UNION ALL SELECT 'viewer', 'Solo lectura', 'Consulta contenido sin modificarlo.', true
) AS d
WHERE NOT EXISTS (
  SELECT 1 FROM `role` existing
  WHERE existing.`tenantId` = t.id AND existing.`key` = d.`key`
);

-- owner y administrator reciben todos los permisos excepto los exclusivos de Platform.
INSERT INTO `rolepermission` (`roleId`, `permissionId`)
SELECT r.id, p.id
FROM `role` r
CROSS JOIN `permission` p
WHERE r.`key` IN ('owner', 'administrator')
  AND p.`key` NOT IN ('plan.manage', 'lead.manage')
  AND NOT EXISTS (
    SELECT 1 FROM `rolepermission` existing
    WHERE existing.`roleId` = r.id AND existing.`permissionId` = p.id
  );

-- El resto de los roles con su matriz operativa específica.
INSERT INTO `rolepermission` (`roleId`, `permissionId`)
SELECT r.id, p.id
FROM `role` r
CROSS JOIN `permission` p
WHERE (
    (r.`key` = 'menu_editor' AND p.`key` IN ('admin.access', 'product.manage', 'category.manage', 'event.manage', 'hours.manage', 'promotion.manage'))
 OR (r.`key` = 'moderator' AND p.`key` IN ('admin.access', 'testimonial.moderate'))
 OR (r.`key` = 'reservation_manager' AND p.`key` IN ('admin.access', 'reservation.manage'))
 OR (r.`key` = 'order_manager' AND p.`key` IN ('admin.access', 'order.manage', 'table.manage'))
 OR (r.`key` = 'analyst' AND p.`key` IN ('admin.access', 'analytics.read'))
 OR (r.`key` = 'viewer' AND p.`key` = 'admin.access')
)
AND NOT EXISTS (
  SELECT 1 FROM `rolepermission` existing
  WHERE existing.`roleId` = r.id AND existing.`permissionId` = p.id
);