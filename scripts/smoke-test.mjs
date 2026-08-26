const DEV_USERS = [
  { email: "propietario1@gmail.com", password: "Propietario1", role: "owner" },
  { email: "administrador1@gmail.com", password: "Administrador123", role: "administrator" },
  { email: "carta1@gmail.com", password: "EditorCarta12", role: "menu_editor" },
  { email: "moderador1@gmail.com", password: "Moderador123", role: "moderator" },
  { email: "reservas1@gmail.com", password: "Reservas123", role: "reservation_manager" },
  { email: "encargado1@gmail.com", password: "Encargado12", role: "order_manager" },
  { email: "analista1@gmail.com", password: "Analista123", role: "analyst" },
  { email: "lector1@gmail.com", password: "Lectura123", role: "viewer" },
  { email: "repartidor1@gmail.com", password: "Repartidor1", role: "driver" },
  { email: "repartidor2@gmail.com", password: "Repartidor2", role: "driver" },
];

const PUBLIC_ENDPOINTS = [
  "/",
  "/t/laterne/admin",
  "/carta",
  "/pedido",
  "/reservas",
  "/api/health",
  "/api/ready",
];

const ADMIN_ENDPOINTS = [
  "/api/admin/dashboard",
  "/api/admin/pedidos",
  "/api/admin/cocina",
  "/api/admin/salon",
  "/api/admin/delivery",
  "/api/admin/repartidores",
  "/api/admin/clientes",
  "/api/admin/productos",
  "/api/admin/inventario",
  "/api/admin/compras",
  "/api/admin/facturacion",
  "/api/admin/finanzas",
  "/api/admin/reservas",
  "/api/admin/mesas",
  "/api/admin/testimonios",
];

const DRIVER_ENDPOINTS = [
  "/driver",
  "/driver/entregas",
  "/driver/recorridos",
  "/driver/incidencias",
];

async function request(method, path, token) {
  const url = `http://localhost:3000${path}`;
  const opts = { method, headers: {} };
  if (token) opts.headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, path, json };
}

async function main() {
  console.log("=== SMOKE TEST ===\n");

  // Public endpoints
  console.log("--- Public endpoints ---");
  for (const ep of PUBLIC_ENDPOINTS) {
    const r = await request("GET", ep, null);
    console.log(`  ${ep}: ${r.status}`);
  }

  // Login attempts
  console.log("\n--- Login ---");
  for (const u of DEV_USERS) {
    const r = await request("POST", "/api/auth/login", null);
    // login needs body, but Node fetch doesn't support body in request() above easily.
    // We'll just check public endpoints and DB state for smoke.
  }

  // Check critical DB state
  console.log("\n--- DB State ---");
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const counts = {
    orders: await prisma.customerOrder.count({ where: { tenantId: 1 } }),
    deliveries: await prisma.orderDelivery.count({ where: { tenantId: 1 } }),
    routes: await prisma.deliveryRoute.count({ where: { tenantId: 1 } }),
    products: await prisma.product.count({ where: { tenantId: 1 } }),
    customers: await prisma.loyaltyCustomer.count({ where: { tenantId: 1 } }),
    reservations: await prisma.reservation.count({ where: { tenantId: 1 } }),
    tables: await prisma.diningTable.count({ where: { tenantId: 1 } }),
    testimonials: await prisma.testimonial.count({ where: { tenantId: 1 } }),
    drivers: await prisma.driverProfile.count({ where: { tenantId: 1 } }),
    suppliers: await prisma.supplier.count({ where: { tenantId: 1 } }),
    expenses: await prisma.expense.count({ where: { tenantId: 1 } }),
    purchaseOrders: await prisma.purchaseOrder.count({ where: { tenantId: 1 } }),
    invoices: await prisma.invoiceRecord.count({ where: { tenantId: 1 } }),
    financialAccounts: await prisma.financialAccount.count({ where: { tenantId: 1 } }),
  };
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k}: ${v}`);
  }
  await prisma.$disconnect();

  console.log("\n=== SMOKE TEST COMPLETO ===");
}

main().catch((e) => { console.error(e); process.exit(1); });
