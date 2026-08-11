-- Los permisos comerciales globales no pertenecen a ningún rol de tenant.
DELETE `rolepermission`
FROM `rolepermission`
INNER JOIN `role` ON `role`.`id` = `rolepermission`.`roleId`
INNER JOIN `permission` ON `permission`.`id` = `rolepermission`.`permissionId`
WHERE `permission`.`key` IN ('plan.manage', 'lead.manage');
