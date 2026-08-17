import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const collationRow = await prisma.$queryRawUnsafe<{ collation: string }[]>("SHOW VARIABLES LIKE 'collation_database'");
  const dbCollation = collationRow[0]?.collation ?? "utf8mb4_general_ci";
  console.log("Database collation:", dbCollation);

  const statements = [
    `ALTER TABLE customerorder ADD COLUMN channel VARCHAR(24) NOT NULL DEFAULT 'DELIVERY'`,
    `ALTER TABLE customerorder ADD COLUMN source VARCHAR(60) NOT NULL DEFAULT 'website'`,
    `ALTER TABLE orderdelivery ADD COLUMN provider VARCHAR(24) NOT NULL DEFAULT 'MENUCLICK'`,
    `ALTER TABLE orderdelivery ADD COLUMN externalOrderId VARCHAR(120) NULL`,
    `ALTER TABLE orderdelivery ADD COLUMN externalReference VARCHAR(200) NULL`,
    `ALTER TABLE orderdelivery ADD COLUMN driverId INT NULL`,
    `ALTER TABLE orderdelivery ADD COLUMN assignedAt DATETIME NULL`,
    `ALTER TABLE orderdelivery ADD COLUMN pickedUpAt DATETIME NULL`,
    `ALTER TABLE orderdelivery ADD COLUMN deliveredAt DATETIME NULL`,
    `ALTER TABLE orderdelivery ADD COLUMN latitude VARCHAR(32) NULL`,
    `ALTER TABLE orderdelivery ADD COLUMN longitude VARCHAR(32) NULL`,
    `ALTER TABLE orderdelivery ADD COLUMN addressSnapshot VARCHAR(500) NULL`,
    `ALTER TABLE orderdelivery ADD COLUMN contactPhone VARCHAR(60) NULL`,
    `ALTER TABLE orderdelivery ADD COLUMN contactName VARCHAR(160) NULL`,
    `ALTER TABLE orderdelivery ADD COLUMN instructions TEXT NULL`,
    `ALTER TABLE orderdelivery ADD COLUMN receiverName VARCHAR(160) NULL`,
    `CREATE TABLE externalorder (id INT NOT NULL AUTO_INCREMENT, tenantId INT NOT NULL, orderId INT NOT NULL, provider VARCHAR(24) NOT NULL, externalOrderId VARCHAR(120) NOT NULL, externalStoreId VARCHAR(120) NULL, externalReference VARCHAR(200) NULL, metadata JSON NULL, receivedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id), UNIQUE INDEX externalorder_tenant_provider_externalOrderId_unique (tenantId, provider, externalOrderId), INDEX externalorder_tenant_orderId_idx (tenantId, orderId), INDEX externalorder_tenant_receivedAt_idx (tenantId, receivedAt), CONSTRAINT externalorder_tenantId_tenant_id_fk FOREIGN KEY (tenantId) REFERENCES tenant (id) ON DELETE CASCADE, CONSTRAINT externalorder_orderId_customerorder_id_fk FOREIGN KEY (orderId) REFERENCES customerorder (id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=${dbCollation}`,
    `CREATE TABLE externalevent (id INT NOT NULL AUTO_INCREMENT, tenantId INT NOT NULL, externalOrderId VARCHAR(120) NULL, provider VARCHAR(24) NOT NULL, eventId VARCHAR(120) NOT NULL, eventType VARCHAR(24) NOT NULL, payload JSON NOT NULL, processed BOOLEAN NOT NULL DEFAULT FALSE, processedAt DATETIME NULL, error TEXT NULL, occurredAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id), UNIQUE INDEX externalevent_tenant_provider_eventId_unique (tenantId, provider, eventId), INDEX externalevent_tenant_processed_occurredAt_idx (tenantId, processed, occurredAt), INDEX externalevent_externalOrderId_idx (externalOrderId), CONSTRAINT externalevent_tenantId_tenant_id_fk FOREIGN KEY (tenantId) REFERENCES tenant (id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=${dbCollation}`,
    `CREATE TABLE driverposition (id INT NOT NULL AUTO_INCREMENT, tenantId INT NOT NULL, branchId INT NULL, deliveryId INT NULL, driverId INT NOT NULL, latitude VARCHAR(32) NOT NULL, longitude VARCHAR(32) NOT NULL, accuracy VARCHAR(32) NULL, recordedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id), INDEX driverposition_tenant_driver_recordedAt_idx (tenantId, driverId, recordedAt), INDEX driverposition_tenant_branch_recordedAt_idx (tenantId, branchId, recordedAt), INDEX driverposition_deliveryId_idx (deliveryId), CONSTRAINT driverposition_tenantId_tenant_id_fk FOREIGN KEY (tenantId) REFERENCES tenant (id) ON DELETE CASCADE, CONSTRAINT driverposition_branchId_branch_id_fk FOREIGN KEY (branchId) REFERENCES branch (id) ON DELETE SET NULL, CONSTRAINT driverposition_deliveryId_orderdelivery_id_fk FOREIGN KEY (deliveryId) REFERENCES orderdelivery (id) ON DELETE SET NULL, CONSTRAINT driverposition_driverId_user_id_fk FOREIGN KEY (driverId) REFERENCES user (id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=${dbCollation}`,
    `CREATE TABLE deliveryproviderconfig (id INT NOT NULL AUTO_INCREMENT, tenantId INT NOT NULL, provider VARCHAR(60) NOT NULL, enabled BOOLEAN NOT NULL DEFAULT FALSE, apiKey VARCHAR(255) NULL, publicConfig JSON NULL, secretConfigured BOOLEAN NOT NULL DEFAULT FALSE, status VARCHAR(30) NOT NULL DEFAULT 'not_configured', lastCheckAt DATETIME NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (id), UNIQUE INDEX deliveryproviderconfig_tenant_provider_unique (tenantId, provider), INDEX deliveryproviderconfig_tenant_enabled_status_idx (tenantId, enabled, status), CONSTRAINT deliveryproviderconfig_tenantId_tenant_id_fk FOREIGN KEY (tenantId) REFERENCES tenant (id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=${dbCollation}`,
    `ALTER TABLE orderdelivery ADD INDEX IF NOT EXISTS orderdelivery_tenant_branch_status_createdAt_idx (tenantId, branchId, status, createdAt)`,
    `ALTER TABLE orderdelivery ADD INDEX IF NOT EXISTS orderdelivery_tenant_driver_status_idx (tenantId, driverId, status)`,
    `ALTER TABLE orderdelivery ADD INDEX IF NOT EXISTS orderdelivery_tenant_provider_externalOrderId_idx (tenantId, provider, externalOrderId)`,
  ];

  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log("OK:", sql.substring(0, 70));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Duplicate column name") || message.includes("already exists")) {
        console.log("SKIP (exists):", sql.substring(0, 70));
      } else {
        console.error("FAIL:", sql.substring(0, 70), message);
        throw error;
      }
    }
  }

  console.log("Migration applied successfully");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
