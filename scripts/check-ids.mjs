import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.$queryRaw`SELECT id, slug, name FROM tenant WHERE slug = 'laterne'`;
  console.log("TENANT:", JSON.stringify(tenant));

  const branches = await prisma.$queryRaw`
    SELECT id, tenantId, name, slug, isPrimary FROM branch WHERE tenantId = 1 AND (slug = 'principal' OR name LIKE '%Principal%' OR isPrimary = 1)
  `;
  console.log("BRANCHES:", JSON.stringify(branches));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
