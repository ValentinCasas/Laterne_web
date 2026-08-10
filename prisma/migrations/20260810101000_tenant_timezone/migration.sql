-- Define una zona horaria por negocio para evaluar disponibilidad y reportes independientemente del servidor.
ALTER TABLE `tenant`
  ADD COLUMN `timeZone` VARCHAR(80) NOT NULL DEFAULT 'America/Argentina/Buenos_Aires';
