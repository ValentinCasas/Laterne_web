import { prisma } from "@/lib/prisma";

async function main() {
  const t = await prisma.tenant.findFirst({
    select: { id: true, slug: true, name: true },
  });
  console.log(JSON.stringify(t));
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
