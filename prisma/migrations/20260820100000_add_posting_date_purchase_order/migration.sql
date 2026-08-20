-- Añade postingDate al pedido de compra como fecha de registro contable.
-- defaultValue = now() preserva registros existentes.
ALTER TABLE `purchaseorder`
  ADD COLUMN `postingDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) AFTER `orderDate`;
