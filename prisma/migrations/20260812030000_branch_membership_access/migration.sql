CREATE TABLE `branchmembership` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `membershipId` INTEGER NOT NULL,
    `branchId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `branchmembership_membershipId_branchId_key`(`membershipId`, `branchId`),
    INDEX `branchmembership_branchId_idx`(`branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `branchmembership`
    ADD CONSTRAINT `branchmembership_membershipId_fkey`
    FOREIGN KEY (`membershipId`) REFERENCES `tenantmembership`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `branchmembership`
    ADD CONSTRAINT `branchmembership_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO `branchmembership` (`membershipId`, `branchId`)
SELECT `tm`.`id`, `b`.`id`
FROM `tenantmembership` AS `tm`
INNER JOIN `branch` AS `b` ON `b`.`tenantId` = `tm`.`tenantId`
WHERE NOT EXISTS (
    SELECT 1 FROM `branchmembership` AS `existing`
    WHERE `existing`.`membershipId` = `tm`.`id` AND `existing`.`branchId` = `b`.`id`
);
