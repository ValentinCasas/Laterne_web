import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const columns = await prisma.$queryRawUnsafe<{ Field: string; Type: string }[]>(
    "SHOW COLUMNS FROM orderdelivery"
  );
  console.log("Columns in orderdelivery:", columns.map((c) => c.Field).join(", "));

  const hasDeliveryFee = columns.some((c) => c.Field === "deliveryFee");
  if (!hasDeliveryFee) {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE orderdelivery ADD COLUMN deliveryFee DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER receiverName"
    );
    console.log("Added deliveryFee column");
  } else {
    console.log("deliveryFee already exists");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
