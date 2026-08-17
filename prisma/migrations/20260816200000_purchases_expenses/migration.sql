-- Compras y gastos: proveedores, pedidos, recepciones, facturas de proveedor,
-- pagos, gastos sin inventario, gastos recurrentes previstos y numeración
-- documental por tenant. El stock solo cambia al confirmar una recepción.

SET @now = NOW(3);

-- 1) Proveedores
CREATE TABLE `supplier` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `taxId` VARCHAR(60) NULL,
  `contactName` VARCHAR(120) NULL,
  `phone` VARCHAR(40) NULL,
  `email` VARCHAR(160) NULL,
  `address` VARCHAR(240) NULL,
  `paymentTerms` VARCHAR(80) NULL,
  `notes` TEXT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `supplier_tenantId_name_key` (`tenantId`, `name`),
  INDEX `supplier_tenantId_active_idx` (`tenantId`, `active`),
  PRIMARY KEY (`id`),
  CONSTRAINT `supplier_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2) Categorías de gastos configurables
CREATE TABLE `expensecategory` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `group` VARCHAR(60) NOT NULL DEFAULT 'Operación',
  `name` VARCHAR(120) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `expensecategory_tenantId_name_key` (`tenantId`, `name`),
  INDEX `expensecategory_tenantId_group_active_idx` (`tenantId`, `group`, `active`),
  PRIMARY KEY (`id`),
  CONSTRAINT `expensecategory_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3) Numeración documental por tenant
CREATE TABLE `documentsequence` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `prefix` VARCHAR(10) NOT NULL,
  `lastValue` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `documentsequence_tenantId_prefix_key` (`tenantId`, `prefix`),
  PRIMARY KEY (`id`),
  CONSTRAINT `documentsequence_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4) Pedidos de compra
CREATE TABLE `purchaseorder` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `branchId` INTEGER NOT NULL,
  `supplierId` INTEGER NOT NULL,
  `number` VARCHAR(24) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'draft',
  `orderDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expectedDate` DATETIME(3) NULL,
  `externalReference` VARCHAR(120) NULL,
  `notes` TEXT NULL,
  `createdById` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `purchaseorder_tenantId_number_key` (`tenantId`, `number`),
  INDEX `purchaseorder_tenantId_status_createdAt_idx` (`tenantId`, `status`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `purchaseorder_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `purchaseorder_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `branch` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `purchaseorder_supplierId_fkey`
    FOREIGN KEY (`supplierId`) REFERENCES `supplier` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `purchaseorder_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 5) Líneas de pedido
CREATE TABLE `purchaseorderitem` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `orderId` INTEGER NOT NULL,
  `productId` INTEGER NOT NULL,
  `quantity` DECIMAL(12, 3) NOT NULL,
  `unit` VARCHAR(40) NOT NULL DEFAULT 'unidad',
  `unitCost` DECIMAL(14, 4) NOT NULL,
  `discountPercent` DECIMAL(6, 2) NOT NULL DEFAULT 0,
  `taxPercent` DECIMAL(6, 2) NOT NULL DEFAULT 0,
  `receivedQuantity` DECIMAL(12, 3) NOT NULL DEFAULT 0,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `purchaseorderitem_orderId_productId_key` (`orderId`, `productId`),
  INDEX `purchaseorderitem_productId_idx` (`productId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `purchaseorderitem_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `purchaseorder` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `purchaseorderitem_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 6) Recepciones físicas
CREATE TABLE `purchasereceipt` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `branchId` INTEGER NOT NULL,
  `supplierId` INTEGER NOT NULL,
  `orderId` INTEGER NULL,
  `number` VARCHAR(24) NOT NULL,
  `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `notes` TEXT NULL,
  `createdById` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `purchasereceipt_tenantId_number_key` (`tenantId`, `number`),
  INDEX `purchasereceipt_tenantId_branchId_receivedAt_idx` (`tenantId`, `branchId`, `receivedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `purchasereceipt_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `purchasereceipt_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `branch` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `purchasereceipt_supplierId_fkey`
    FOREIGN KEY (`supplierId`) REFERENCES `supplier` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `purchasereceipt_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `purchaseorder` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `purchasereceipt_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 7) Líneas de recepción
CREATE TABLE `purchasereceiptitem` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `receiptId` INTEGER NOT NULL,
  `orderItemId` INTEGER NULL,
  `productId` INTEGER NOT NULL,
  `quantity` DECIMAL(12, 3) NOT NULL,
  `unit` VARCHAR(40) NOT NULL DEFAULT 'unidad',
  `unitCost` DECIMAL(14, 4) NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `purchasereceiptitem_receiptId_productId_key` (`receiptId`, `productId`),
  INDEX `purchasereceiptitem_productId_idx` (`productId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `purchasereceiptitem_receiptId_fkey`
    FOREIGN KEY (`receiptId`) REFERENCES `purchasereceipt` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `purchasereceiptitem_orderItemId_fkey`
    FOREIGN KEY (`orderItemId`) REFERENCES `purchaseorderitem` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `purchasereceiptitem_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 8) Facturas de compra / gastos del proveedor
CREATE TABLE `purchaseinvoice` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `branchId` INTEGER NULL,
  `supplierId` INTEGER NOT NULL,
  `orderId` INTEGER NULL,
  `number` VARCHAR(24) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'draft',
  `documentDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `dueDate` DATETIME(3) NULL,
  `externalNumber` VARCHAR(120) NULL,
  `financialCategory` VARCHAR(80) NOT NULL DEFAULT 'insumos',
  `currency` VARCHAR(3) NOT NULL DEFAULT 'ARS',
  `subtotal` DECIMAL(12, 2) NOT NULL,
  `taxAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `total` DECIMAL(12, 2) NOT NULL,
  `paidAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `notes` TEXT NULL,
  `attachmentId` INTEGER NULL,
  `createdById` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `purchaseinvoice_tenantId_number_key` (`tenantId`, `number`),
  INDEX `purchaseinvoice_tenantId_status_dueDate_idx` (`tenantId`, `status`, `dueDate`),
  PRIMARY KEY (`id`),
  CONSTRAINT `purchaseinvoice_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `purchaseinvoice_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `branch` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `purchaseinvoice_supplierId_fkey`
    FOREIGN KEY (`supplierId`) REFERENCES `supplier` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `purchaseinvoice_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `purchaseorder` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `purchaseinvoice_attachmentId_fkey`
    FOREIGN KEY (`attachmentId`) REFERENCES `mediaasset` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `purchaseinvoice_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 9) Líneas de factura
CREATE TABLE `purchaseinvoiceitem` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `invoiceId` INTEGER NOT NULL,
  `productId` INTEGER NULL,
  `description` VARCHAR(200) NOT NULL,
  `quantity` DECIMAL(12, 3) NOT NULL DEFAULT 1,
  `unit` VARCHAR(40) NOT NULL DEFAULT 'unidad',
  `unitCost` DECIMAL(14, 4) NOT NULL,
  `discountPercent` DECIMAL(6, 2) NOT NULL DEFAULT 0,
  `taxPercent` DECIMAL(6, 2) NOT NULL DEFAULT 0,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `purchaseinvoiceitem_productId_idx` (`productId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `purchaseinvoiceitem_invoiceId_fkey`
    FOREIGN KEY (`invoiceId`) REFERENCES `purchaseinvoice` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `purchaseinvoiceitem_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `product` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 10) Vínculo factura ↔ recepciones
CREATE TABLE `purchaseinvoicereceipt` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `invoiceId` INTEGER NOT NULL,
  `receiptId` INTEGER NOT NULL,
  UNIQUE INDEX `purchaseinvoicereceipt_invoiceId_receiptId_key` (`invoiceId`, `receiptId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `purchaseinvoicereceipt_invoiceId_fkey`
    FOREIGN KEY (`invoiceId`) REFERENCES `purchaseinvoice` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `purchaseinvoicereceipt_receiptId_fkey`
    FOREIGN KEY (`receiptId`) REFERENCES `purchasereceipt` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 11) Gastos recurrentes previstos (referenciados por los gastos)
CREATE TABLE `recurringexpense` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `categoryId` INTEGER NULL,
  `name` VARCHAR(160) NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `periodicity` VARCHAR(20) NOT NULL DEFAULT 'monthly',
  `dayOfMonth` INTEGER NULL,
  `dayOfWeek` INTEGER NULL,
  `nextDueDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `active` BOOLEAN NOT NULL DEFAULT true,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `recurringexpense_tenantId_active_nextDueDate_idx` (`tenantId`, `active`, `nextDueDate`),
  PRIMARY KEY (`id`),
  CONSTRAINT `recurringexpense_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `recurringexpense_categoryId_fkey`
    FOREIGN KEY (`categoryId`) REFERENCES `expensecategory` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 12) Gastos que no afectan inventario
CREATE TABLE `expense` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `branchId` INTEGER NULL,
  `supplierId` INTEGER NULL,
  `categoryId` INTEGER NOT NULL,
  `recurringId` INTEGER NULL,
  `number` VARCHAR(24) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'draft',
  `expenseDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `dueDate` DATETIME(3) NULL,
  `amountNet` DECIMAL(12, 2) NOT NULL,
  `taxAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `total` DECIMAL(12, 2) NOT NULL,
  `paidAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `paymentMethod` VARCHAR(40) NULL,
  `financialCategory` VARCHAR(80) NULL,
  `notes` TEXT NULL,
  `attachmentId` INTEGER NULL,
  `createdById` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `expense_tenantId_number_key` (`tenantId`, `number`),
  INDEX `expense_tenantId_status_dueDate_idx` (`tenantId`, `status`, `dueDate`),
  PRIMARY KEY (`id`),
  CONSTRAINT `expense_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `expense_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `branch` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `expense_supplierId_fkey`
    FOREIGN KEY (`supplierId`) REFERENCES `supplier` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `expense_categoryId_fkey`
    FOREIGN KEY (`categoryId`) REFERENCES `expensecategory` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `expense_recurringId_fkey`
    FOREIGN KEY (`recurringId`) REFERENCES `recurringexpense` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `expense_attachmentId_fkey`
    FOREIGN KEY (`attachmentId`) REFERENCES `mediaasset` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `expense_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 13) Pagos (factura o gasto)
CREATE TABLE `purchasepayment` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tenantId` INTEGER NOT NULL,
  `invoiceId` INTEGER NULL,
  `expenseId` INTEGER NULL,
  `number` VARCHAR(24) NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `method` VARCHAR(40) NOT NULL DEFAULT 'transferencia',
  `paidAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `notes` VARCHAR(240) NULL,
  `createdById` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `purchasepayment_tenantId_invoiceId_idx` (`tenantId`, `invoiceId`),
  INDEX `purchasepayment_tenantId_expenseId_idx` (`tenantId`, `expenseId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `purchasepayment_tenantId_fkey`
    FOREIGN KEY (`tenantId`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `purchasepayment_invoiceId_fkey`
    FOREIGN KEY (`invoiceId`) REFERENCES `purchaseinvoice` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `purchasepayment_expenseId_fkey`
    FOREIGN KEY (`expenseId`) REFERENCES `expense` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `purchasepayment_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 13) Política de costo al facturar compras
ALTER TABLE `inventorysettings`
  ADD COLUMN `costPolicy` VARCHAR(20) NOT NULL DEFAULT 'product';

-- 14) Permiso de compras y gastos + concesión a roles de sistema
INSERT INTO `permission` (`key`, `name`, `description`)
SELECT 'purchase.manage', 'Gestionar compras y gastos', 'Permite administrar pedidos de compra, recepciones, facturas de proveedores y gastos.'
WHERE NOT EXISTS (SELECT 1 FROM `permission` WHERE `key` = 'purchase.manage');

INSERT INTO `rolepermission` (`roleId`, `permissionId`)
SELECT r.id, p.id
FROM `role` r
CROSS JOIN `permission` p
WHERE r.`key` IN ('owner', 'administrator', 'menu_editor')
  AND p.`key` = 'purchase.manage'
  AND NOT EXISTS (
    SELECT 1 FROM `rolepermission` existing
    WHERE existing.`roleId` = r.id AND existing.`permissionId` = p.id
  );

-- 15) Categorías de gasto iniciales para cada tenant existente
INSERT INTO `expensecategory` (`tenantId`, `group`, `name`, `active`, `sortOrder`, `createdAt`, `updatedAt`)
SELECT t.id, d.`group`, d.`name`, true, d.`sortOrder`, @now, @now
FROM `tenant` t
CROSS JOIN (
  SELECT 'Operación' AS `group`, 'Alquiler' AS `name`, 1 AS `sortOrder`
  UNION ALL SELECT 'Operación', 'Servicios (luz, gas, internet)', 2
  UNION ALL SELECT 'Operación', 'Limpieza', 3
  UNION ALL SELECT 'Operación', 'Mantenimiento', 4
  UNION ALL SELECT 'Personal', 'Uniformes', 5
  UNION ALL SELECT 'Personal', 'Capacitación', 6
  UNION ALL SELECT 'Marketing', 'Publicidad', 7
  UNION ALL SELECT 'Marketing', 'Redes sociales', 8
  UNION ALL SELECT 'Administración', 'Contador', 9
  UNION ALL SELECT 'Administración', 'Software', 10
) AS d
WHERE NOT EXISTS (
  SELECT 1 FROM `expensecategory` existing
  WHERE existing.`tenantId` = t.id AND existing.`name` = d.`name`
);
