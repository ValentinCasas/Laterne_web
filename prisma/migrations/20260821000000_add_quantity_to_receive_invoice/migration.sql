-- AlterTable
ALTER TABLE `purchaseorderitem` ADD COLUMN `quantityToReceive` DECIMAL(12, 3) NULL,
    ADD COLUMN `quantityToInvoice` DECIMAL(12, 3) NULL;
