import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { email: { in: [
      "propietario1@gmail.com",
      "administrador1@gmail.com",
      "carta1@gmail.com",
      "moderador1@gmail.com",
      "reservas1@gmail.com",
      "encargado1@gmail.com",
      "analista1@gmail.com",
      "lector1@gmail.com",
      "repartidor1@gmail.com",
      "repartidor2@gmail.com",
    ]}},
    select: { id: true, email: true, name: true, role: true },
  });

  const memberships = await prisma.tenantMembership.findMany({
    where: { userId: { in: users.map((u) => u.id) } },
    include: { role: true, branchAccess: { include: { branch: true } } },
  });

  const drivers = await prisma.driverProfile.findMany({
    where: { userId: { in: users.map((u) => u.id) } },
    include: { branches: { include: { branch: true } } },
  });

  console.log("\n=== USUARIOS DEV ===");
  for (const u of users) {
    const m = memberships.find((m) => m.userId === u.id);
    const d = drivers.find((d) => d.userId === u.id);
    console.log(`${u.email} | rol=${m?.role?.key ?? "?"} | branches=${m?.branchAccess?.map((b) => b.branch.name).join(", ") ?? "?"} | driver=${d ? "Sí (" + d.name + ")" : "No"}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
