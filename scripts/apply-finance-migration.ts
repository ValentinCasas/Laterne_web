import { prisma } from "@/lib/prisma";

const MIGRATION_SQL = `
-- OrderItem: snapshot de costo al momento de la venta (permite CMV histórico sin alterar precios).
ALTER TABLE \`orderitem\` ADD COLUMN IF NOT EXISTS \`costSnapshot\` DECIMAL(14, 4) NULL;

-- Tabla: cuenta financiera (caja, banco, billetera, otra). branchId NULL = cuenta del negocio.
CREATE TABLE IF NOT EXISTS \`financialaccount\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`tenantId\` INT NOT NULL,
  \`branchId\` INT NULL,
  \`name\` VARCHAR(160) NOT NULL,
  \`code\` VARCHAR(40) NULL,
  \`type\` VARCHAR(30) NOT NULL DEFAULT 'caja',
  \`currency\` VARCHAR(3) NOT NULL DEFAULT 'ARS',
  \`status\` VARCHAR(20) NOT NULL DEFAULT 'active',
  \`openingBalance\` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  \`openingDate\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`notes\` TEXT NULL,
  \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  INDEX \`financialaccount_tenant_branch_status_idx\` (\`tenantId\`, \`branchId\`, \`status\`),
  CONSTRAINT \`financialaccount_tenantId_tenant_id_fk\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`financialaccount_branchId_branch_id_fk\` FOREIGN KEY (\`branchId\`) REFERENCES \`branch\` (\`id\`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Tabla: transferencia entre cuentas (salida de origen + entrada de destino en la misma transacción).
CREATE TABLE IF NOT EXISTS \`financialtransfer\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`tenantId\` INT NOT NULL,
  \`reference\` VARCHAR(24) NOT NULL,
  \`fromAccountId\` INT NOT NULL,
  \`toAccountId\` INT NOT NULL,
  \`amount\` DECIMAL(14, 2) NOT NULL,
  \`transferDate\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`notes\` VARCHAR(300) NULL,
  \`createdById\` INT NULL,
  \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE INDEX \`financialtransfer_reference_unique\` (\`reference\`),
  INDEX \`ft_tenant_from_date_idx\` (\`tenantId\`, \`fromAccountId\`, \`transferDate\`),
  INDEX \`ft_tenant_to_date_idx\` (\`tenantId\`, \`toAccountId\`, \`transferDate\`),
  CONSTRAINT \`ft_tenantId_tenant_id_fk\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`ft_fromAccountId_financialaccount_id_fk\` FOREIGN KEY (\`fromAccountId\`) REFERENCES \`financialaccount\` (\`id\`) ON DELETE RESTRICT,
  CONSTRAINT \`ft_toAccountId_financialaccount_id_fk\` FOREIGN KEY (\`toAccountId\`) REFERENCES \`financialaccount\` (\`id\`) ON DELETE RESTRICT,
  CONSTRAINT \`ft_createdById_user_id_fk\` FOREIGN KEY (\`createdById\`) REFERENCES \`user\` (\`id\`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Tabla: ledger de movimientos financieros (inmutable, correcciones por reversión).
CREATE TABLE IF NOT EXISTS \`financialmovement\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`tenantId\` INT NOT NULL,
  \`branchId\` INT NULL,
  \`accountId\` INT NOT NULL,
  \`date\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`type\` VARCHAR(30) NOT NULL,
  \`direction\` VARCHAR(4) NOT NULL,
  \`amount\` DECIMAL(14, 2) NOT NULL,
  \`concept\` VARCHAR(220) NOT NULL,
  \`reference\` VARCHAR(80) NULL,
  \`origin\` VARCHAR(40) NOT NULL DEFAULT 'manual',
  \`referenceType\` VARCHAR(40) NULL,
  \`referenceId\` INT NULL,
  \`transferId\` INT NULL,
  \`reversesId\` INT NULL,
  \`createdById\` INT NULL,
  \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  INDEX \`fm_tenant_account_date_idx\` (\`tenantId\`, \`accountId\`, \`date\`),
  INDEX \`fm_tenant_date_idx\` (\`tenantId\`, \`date\`),
  INDEX \`fm_tenant_type_date_idx\` (\`tenantId\`, \`type\`, \`date\`),
  INDEX \`fm_tenant_ref_idx\` (\`tenantId\`, \`referenceType\`, \`referenceId\`),
  INDEX \`fm_transfer_idx\` (\`transferId\`),
  INDEX \`fm_reverses_idx\` (\`reversesId\`),
  CONSTRAINT \`fm_tenantId_tenant_id_fk\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`fm_branchId_branch_id_fk\` FOREIGN KEY (\`branchId\`) REFERENCES \`branch\` (\`id\`) ON DELETE SET NULL,
  CONSTRAINT \`fm_accountId_financialaccount_id_fk\` FOREIGN KEY (\`accountId\`) REFERENCES \`financialaccount\` (\`id\`) ON DELETE RESTRICT,
  CONSTRAINT \`fm_transferId_financialtransfer_id_fk\` FOREIGN KEY (\`transferId\`) REFERENCES \`financialtransfer\` (\`id\`) ON DELETE SET NULL,
  CONSTRAINT \`fm_reversesId_financialmovement_id_fk\` FOREIGN KEY (\`reversesId\`) REFERENCES \`financialmovement\` (\`id\`) ON DELETE SET NULL,
  CONSTRAINT \`fm_createdById_user_id_fk\` FOREIGN KEY (\`createdById\`) REFERENCES \`user\` (\`id\`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Tabla: documento de cuenta a cobrar a un cliente.
CREATE TABLE IF NOT EXISTS \`receivabledocument\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`tenantId\` INT NOT NULL,
  \`branchId\` INT NULL,
  \`customerId\` INT NOT NULL,
  \`orderId\` INT NULL,
  \`number\` VARCHAR(24) NOT NULL,
  \`documentDate\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`dueDate\` DATETIME NOT NULL,
  \`originalAmount\` DECIMAL(14, 2) NOT NULL,
  \`paidAmount\` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  \`status\` VARCHAR(20) NOT NULL DEFAULT 'open',
  \`notes\` VARCHAR(300) NULL,
  \`createdById\` INT NULL,
  \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE INDEX \`receivabledocument_tenant_number_unique\` (\`tenantId\`, \`number\`),
  INDEX \`rd_tenant_customer_status_due_idx\` (\`tenantId\`, \`customerId\`, \`status\`, \`dueDate\`),
  CONSTRAINT \`rd_tenantId_tenant_id_fk\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`rd_branchId_branch_id_fk\` FOREIGN KEY (\`branchId\`) REFERENCES \`branch\` (\`id\`) ON DELETE SET NULL,
  CONSTRAINT \`rd_customerId_loyaltycustomer_id_fk\` FOREIGN KEY (\`customerId\`) REFERENCES \`loyaltycustomer\` (\`id\`) ON DELETE RESTRICT,
  CONSTRAINT \`rd_orderId_customerorder_id_fk\` FOREIGN KEY (\`orderId\`) REFERENCES \`customerorder\` (\`id\`) ON DELETE SET NULL,
  CONSTRAINT \`rd_createdById_user_id_fk\` FOREIGN KEY (\`createdById\`) REFERENCES \`user\` (\`id\`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Tabla: pago de un cliente asignado a documentos de cuenta a cobrar.
CREATE TABLE IF NOT EXISTS \`receivablepayment\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`tenantId\` INT NOT NULL,
  \`branchId\` INT NULL,
  \`customerId\` INT NOT NULL,
  \`number\` VARCHAR(24) NOT NULL,
  \`amount\` DECIMAL(14, 2) NOT NULL,
  \`method\` VARCHAR(40) NOT NULL DEFAULT 'efectivo',
  \`accountId\` INT NULL,
  \`paidAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`notes\` VARCHAR(240) NULL,
  \`status\` VARCHAR(20) NOT NULL DEFAULT 'confirmed',
  \`createdById\` INT NULL,
  \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`reversedAt\` DATETIME NULL,
  \`reversedById\` INT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE INDEX \`receivablepayment_tenant_number_unique\` (\`tenantId\`, \`number\`),
  INDEX \`rp_tenant_customer_paidAt_idx\` (\`tenantId\`, \`customerId\`, \`paidAt\`),
  CONSTRAINT \`rp_tenantId_tenant_id_fk\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`rp_branchId_branch_id_fk\` FOREIGN KEY (\`branchId\`) REFERENCES \`branch\` (\`id\`) ON DELETE SET NULL,
  CONSTRAINT \`rp_customerId_loyaltycustomer_id_fk\` FOREIGN KEY (\`customerId\`) REFERENCES \`loyaltycustomer\` (\`id\`) ON DELETE RESTRICT,
  CONSTRAINT \`rp_accountId_financialaccount_id_fk\` FOREIGN KEY (\`accountId\`) REFERENCES \`financialaccount\` (\`id\`) ON DELETE SET NULL,
  CONSTRAINT \`rp_createdById_user_id_fk\` FOREIGN KEY (\`createdById\`) REFERENCES \`user\` (\`id\`) ON DELETE SET NULL,
  CONSTRAINT \`rp_reversedById_user_id_fk\` FOREIGN KEY (\`reversedById\`) REFERENCES \`user\` (\`id\`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Tabla: asignación de un pago a un documento (permite pagos parciales y múltiples documentos).
CREATE TABLE IF NOT EXISTS \`receivableallocation\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`tenantId\` INT NOT NULL,
  \`paymentId\` INT NOT NULL,
  \`documentId\` INT NOT NULL,
  \`amount\` DECIMAL(14, 2) NOT NULL,
  \`status\` VARCHAR(20) NOT NULL DEFAULT 'active',
  \`reversedAt\` DATETIME NULL,
  \`reversedById\` INT NULL,
  \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  INDEX \`ra_document_idx\` (\`documentId\`),
  INDEX \`ra_payment_idx\` (\`paymentId\`),
  CONSTRAINT \`ra_tenantId_tenant_id_fk\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`ra_paymentId_receivablepayment_id_fk\` FOREIGN KEY (\`paymentId\`) REFERENCES \`receivablepayment\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`ra_documentId_receivabledocument_id_fk\` FOREIGN KEY (\`documentId\`) REFERENCES \`receivabledocument\` (\`id\`) ON DELETE RESTRICT,
  CONSTRAINT \`ra_reversedById_user_id_fk\` FOREIGN KEY (\`reversedById\`) REFERENCES \`user\` (\`id\`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Permisos del módulo Finanzas
INSERT INTO \`permission\` (\`key\`, \`name\`, \`description\`) VALUES
  ('finance.view', 'Ver finanzas', 'Permite consultar cuentas, movimientos y reportes financieros.'),
  ('finance.manage', 'Gestionar finanzas', 'Permite crear y editar cuentas y registrar movimientos manuales.'),
  ('finance.transfer', 'Transferir entre cuentas', 'Permite mover dinero entre cuentas financieras.'),
  ('finance.payment', 'Registrar cobros y pagos', 'Permite registrar cobros a clientes y pagos a proveedores.'),
  ('finance.export', 'Exportar finanzas', 'Permite exportar reportes financieros a CSV.'),
  ('finance.reversal', 'Anular movimientos', 'Permite anular movimientos, cobros y pagos dejando trazabilidad.')
ON DUPLICATE KEY UPDATE \`key\` = \`key\`;

-- owner y administrator: todas las capacidades de Finanzas
INSERT INTO \`rolepermission\` (\`roleId\`, \`permissionId\`)
SELECT r.id, p.id
FROM \`role\` r
CROSS JOIN \`permission\` p
WHERE r.\`key\` IN ('owner', 'administrator')
  AND p.\`key\` IN ('finance.view', 'finance.manage', 'finance.transfer', 'finance.payment', 'finance.export', 'finance.reversal')
  AND NOT EXISTS (
    SELECT 1 FROM \`rolepermission\` existing
    WHERE existing.\`roleId\` = r.id AND existing.\`permissionId\` = p.id
  );

-- analyst: solo consulta y exportación
INSERT INTO \`rolepermission\` (\`roleId\`, \`permissionId\`)
SELECT r.id, p.id
FROM \`role\` r
CROSS JOIN \`permission\` p
WHERE r.\`key\` = 'analyst'
  AND p.\`key\` IN ('finance.view', 'finance.export')
  AND NOT EXISTS (
    SELECT 1 FROM \`rolepermission\` existing
    WHERE existing.\`roleId\` = r.id AND existing.\`permissionId\` = p.id
  );
`;

async function main() {
  const statements = MIGRATION_SQL
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    try {
      await prisma.$executeRawUnsafe(statement);
    } catch (error) {
      console.error("Error executing statement:", error);
      console.error("Statement:", statement.slice(0, 200));
      throw error;
    }
  }

  console.log("Migration applied successfully.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
