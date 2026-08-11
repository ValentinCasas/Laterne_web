-- Impide que dos tenants reclamen el mismo dominio incluso bajo concurrencia.
DROP INDEX `brandsettings_customDomain_idx` ON `brandsettings`;
CREATE UNIQUE INDEX `brandsettings_customDomain_key` ON `brandsettings`(`customDomain`);
