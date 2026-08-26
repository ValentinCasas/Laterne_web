import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tenantId = 1;

  const users = await prisma.user.findMany({
    where: { memberships: { some: { tenantId } } },
    select: { id: true, email: true, name: true, role: true },
  });

  const memberships = await prisma.tenantMembership.findMany({
    where: { tenantId },
    include: { role: true, branchAccess: { include: { branch: { select: { name: true } } } } },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  console.log("\n=== USUARIOS EXISTENTES EN LATERNE ===");
  for (const m of memberships) {
    const u = userMap.get(m.userId);
    if (!u) continue;
    const branches = m.branchAccess.map((b) => b.branch.name).join(", ");
    const isDev = [
      "propietario1@gmail.com", "administrador1@gmail.com", "carta1@gmail.com",
      "moderador1@gmail.com", "reservas1@gmail.com", "encargado1@gmail.com",
      "analista1@gmail.com", "lector1@gmail.com", "repartidor1@gmail.com",
      "repartidor2@gmail.com",
    ].includes(u.email);
    console.log(`${u.email} | ${u.name} | rol=${m.role.key} | branches=${branches} | dev=${isDev ? "SÍ" : "NO"}`);
  }

  const counts = {
    products: await prisma.product.count({ where: { tenantId } }),
    categories: await prisma.category.count({ where: { tenantId } }),
    customers: await prisma.loyaltyCustomer.count({ where: { tenantId } }),
    orders: await prisma.customerOrder.count({ where: { tenantId } }),
    deliveries: await prisma.orderDelivery.count({ where: { tenantId } }),
    routes: await prisma.deliveryRoute.count({ where: { tenantId } }),
    drivers: await prisma.driverProfile.count({ where: { tenantId } }),
    reservations: await prisma.reservation.count({ where: { tenantId } }),
    tables: await prisma.diningTable.count({ where: { tenantId } }),
    testimonials: await prisma.testimonial.count({ where: { tenantId } }),
    ingredients: await prisma.inventoryStock.count({ where: { tenantId } }),
    suppliers: await prisma.supplier.count({ where: { tenantId } }),
    purchaseOrders: await prisma.purchaseOrder.count({ where: { tenantId } }),
    expenses: await prisma.expense.count({ where: { tenantId } }),
    promotions: await prisma.promotion.count({ where: { tenantId } }),
    events: await prisma.event.count({ where: { tenantId } }),
    invoices: await prisma.invoiceRecord.count({ where: { tenantId } }),
    financialAccounts: await prisma.financialAccount.count({ where: { tenantId } }),
  };

  console.log("\n=== CANTIDADES POST-SEED ===");
  for (const [k, v] of Object.entries(counts)) {
    console.log(`${k}: ${v}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
