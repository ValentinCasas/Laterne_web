-- @summary Agrega `plannedOrder` a OrderDelivery para conservar el orden planificado original
-- independientemente del orden real ejecutado. Permite distinguir el plan del recorrido real.

ALTER TABLE `orderdelivery`
  ADD COLUMN `plannedOrder` INT NULL AFTER `routeOrder`;

CREATE INDEX `orderdelivery_routeId_plannedOrder_idx` ON `orderdelivery` (`routeId`, `plannedOrder`);
