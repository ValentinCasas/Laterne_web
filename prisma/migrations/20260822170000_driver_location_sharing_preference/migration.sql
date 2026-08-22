-- Persiste el consentimiento operativo; el watcher GPS sigue siendo responsabilidad del navegador.
ALTER TABLE `driverprofile`
  ADD COLUMN `locationSharingEnabled` BOOLEAN NOT NULL DEFAULT false;
