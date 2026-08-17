/**
 * Verifica en navegador el módulo completo de Compras y Gastos:
 * integración al menú (Carta → Costos), alta de proveedor, pedido con wizard,
 * envío, recepción parcial (dos tandas), historial, factura vinculada a
 * recepciones, pagos parciales y totales, gasto sin inventario y CSV.
 * Crea un usuario administrativo temporal y datos de prueba, y los elimina al
 * terminar (incluidos movimientos y stock creados).
 */
import { config as loadEnv } from "dotenv";
loadEnv();

import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

const prisma = new PrismaClient();
const password = `compras-${Date.now()}`;
const email = `compras-check-${Date.now()}@example.com`;

let tenantSlug = "";
let branchSlugs: string[] = [];
let productId = 0;
let productName = "";
let supplierId = 0;
const uiSupplierNames: string[] = [];
const stockSnapshots = new Map<string, { current: unknown; existed: boolean }>();

/** @summary Hash privado idéntico al que usa el login para limpiar sus intentos. */
function privateHash(value: string) {
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? "development-only-change-me"}:${value}`)
    .digest("hex");
}

/** @summary Crea el usuario administrativo temporal con acceso a todas las sucursales. */
async function createTempAdmin() {
  const tenant = await prisma.tenant.findFirst({ where: { status: "active" } });
  if (!tenant) throw new Error("No hay tenant activo para la verificación");
  tenantSlug = tenant.slug;

  const branches = await prisma.branch.findMany({
    where: { tenantId: tenant.id, active: true },
    select: { id: true, slug: true },
  });
  branchSlugs = branches.map((branch) => branch.slug);

  const role = await prisma.role.findFirst({
    where: { tenantId: tenant.id, permissions: { some: { permission: { key: "purchase.manage" } } } },
  });
  if (!role) throw new Error("No existe un rol con purchase.manage para el tenant");

  const product = await prisma.product.findFirst({
    where: { tenantId: tenant.id, status: { not: "archived" } },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });
  if (!product) throw new Error("No hay productos para probar compras");
  productId = product.id;
  productName = product.name;

  const user = await prisma.user.create({
    data: {
      name: "Verificación compras",
      email,
      password: await bcrypt.hash(password, 10),
      role: 1,
      imageUrl: "",
    },
  });
  await prisma.tenantMembership.create({
    data: {
      tenantId: tenant.id,
      userId: user.id,
      roleId: role.id,
      status: "active",
      allBranches: true,
      branchAccess: { create: branches.map((branch) => ({ branchId: branch.id })) },
    },
  });
}

/** @summary Inicia sesión en el navegador y deja la cookie de sesión disponible. */
async function login(page: Page) {
  const response = await page.request.post(`/api/t/${tenantSlug}/auth/login`, {
    data: { email, password, tenantSlug, context: "tenant", branchId: 0 },
  });
  expect(response.ok()).toBeTruthy();
  const setCookie = response.headers()["set-cookie"];
  expect(setCookie).toBeTruthy();
  const [name, value] = setCookie.split(";")[0].split("=");
  await page.context().addCookies([
    { name, value, url: "http://localhost:3000", httpOnly: true, sameSite: "Strict" },
  ]);
}

test.beforeAll(async () => {
  await createTempAdmin();
  const tenant = await prisma.tenant.findFirst({ where: { status: "active" } });
  const supplier = await prisma.supplier.create({
    data: {
      tenantId: tenant!.id,
      name: `Distribuidora Verificación ${Date.now()}`,
      paymentTerms: "contado",
      active: true,
    },
  });
  supplierId = supplier.id;
});

test.afterAll(async () => {
  // Proveedores creados por UI en el flujo (sin id capturado: se buscan por nombre).
  const uiSuppliers = await prisma.supplier.findMany({
    where: { name: { in: uiSupplierNames } },
    select: { id: true },
  });
  const allSupplierIds = [...new Set([supplierId, ...uiSuppliers.map((item) => item.id)])];

  // Pagos de facturas de los proveedores temporales.
  const payments = await prisma.purchasePayment.findMany({
    where: { OR: allSupplierIds.map((id) => ({ invoice: { supplierId: id }, expense: { supplierId: id } })) },
    select: { id: true },
  });
  if (payments.length) await prisma.purchasePayment.deleteMany({ where: { id: { in: payments.map((item) => item.id) } } });

  // Movimientos de stock de las recepciones del flujo (reference = "RC-… · OC-…").
  const receiptRows = await prisma.purchaseReceipt.findMany({
    where: { supplierId: { in: allSupplierIds } },
    select: { number: true },
  });
  const receiptNumbers = receiptRows.map((row) => row.number);
  if (receiptNumbers.length) {
    const movementIds = (
      await prisma.stockMovement.findMany({
        where: { OR: receiptNumbers.map((number) => ({ reference: { startsWith: number } })) },
        select: { id: true },
      })
    ).map((row) => row.id);
    if (movementIds.length) await prisma.stockMovement.deleteMany({ where: { id: { in: movementIds } } });
  }

  // Recepciones antes que pedidos (FK).
  const receipts = await prisma.purchaseReceipt.findMany({ where: { supplierId: { in: allSupplierIds } }, select: { id: true } });
  const receiptIds = receipts.map((receipt) => receipt.id);
  if (receiptIds.length) {
    await prisma.purchaseReceiptItem.deleteMany({ where: { receiptId: { in: receiptIds } } });
    await prisma.purchaseReceipt.deleteMany({ where: { id: { in: receiptIds } } });
  }

  const orders = await prisma.purchaseOrder.findMany({
    where: { supplierId: { in: allSupplierIds } },
    select: { id: true },
  });
  const orderIds = orders.map((order) => order.id);
  if (orderIds.length) {
    await prisma.purchaseOrderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.purchaseOrder.deleteMany({ where: { id: { in: orderIds } } });
  }
  const invoices = await prisma.purchaseInvoice.findMany({ where: { supplierId: { in: allSupplierIds } }, select: { id: true } });
  const invoiceIds = invoices.map((invoice) => invoice.id);
  if (invoiceIds.length) {
    await prisma.purchaseInvoiceReceipt.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await prisma.purchaseInvoiceItem.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await prisma.purchaseInvoice.deleteMany({ where: { id: { in: invoiceIds } } });
  }
  // Gastos creados por la verificación (sin proveedor, marcados por nota).
  const expenses = await prisma.expense.findMany({ where: { notes: { startsWith: "Verificación navegador" } }, select: { id: true } });
  const expenseIds = expenses.map((expense) => expense.id);
  if (expenseIds.length) {
    await prisma.purchasePayment.deleteMany({ where: { expenseId: { in: expenseIds } } });
    await prisma.expense.deleteMany({ where: { id: { in: expenseIds } } });
  }

  await prisma.supplier.deleteMany({ where: { id: { in: allSupplierIds } } });

  // Restaurar el stock que las recepciones del flujo incrementaron.
  for (const [key, snapshot] of stockSnapshots) {
    const [branchId, productIdNum] = key.split(":").map(Number);
    const stock = await prisma.inventoryStock.findUnique({
      where: { branchId_productId: { branchId, productId: productIdNum } },
    });
    if (!stock) continue;
    if (!snapshot.existed) {
      await prisma.inventoryStock.delete({ where: { id: stock.id } });
    } else {
      await prisma.inventoryStock.update({ where: { id: stock.id }, data: { current: snapshot.current as never } });
    }
  }

  if (email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) await prisma.user.delete({ where: { id: user.id } });
    await prisma.loginAttempt.deleteMany({ where: { emailHash: privateHash(email) } });
  }
  await prisma.$disconnect();
});

test.beforeEach(async ({ page }) => {
  await login(page);
});

// El mega-menú de escritorio no aplica al proyecto mobile (drawer).
test.skip(({ isMobile }) => isMobile, "El mega-menú es de escritorio");

test("Carta → Costos → Compras y Gastos aparecen en el menú y abren sus módulos", async ({ page }) => {
  await page.goto(`/t/${tenantSlug}/admin`);
  await page.getByRole("button", { name: "Carta" }).click();

  const comprasLink = page.getByRole("link", { name: "Compras" });
  await expect(comprasLink).toBeVisible();
  const comprasHref = await comprasLink.getAttribute("href");
  expect(comprasHref).toMatch(/\/admin\/compras$/);
  await comprasLink.click();
  await expect(page).toHaveURL(/\/admin\/compras$/);
  await expect(page.getByRole("heading", { name: "Compras", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pedidos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Recepciones" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Facturas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Proveedores" })).toBeVisible();

  await page.goto(`/t/${tenantSlug}/admin`);
  await page.getByRole("button", { name: "Carta" }).click();
  const gastosLink = page.getByRole("link", { name: "Gastos" });
  await expect(gastosLink).toBeVisible();
  await gastosLink.click();
  await expect(page).toHaveURL(/\/admin\/gastos$/);
  await expect(page.getByRole("heading", { name: "Gastos", exact: true })).toBeVisible();
  await expect(page.getByText("Pendiente este mes")).toBeVisible();
});

test("flujo completo: proveedor por UI, pedido wizard, envío y recepción parcial en dos tandas", async ({ page }) => {
  // La recepción exige sucursal activa: se usa la ruta scoped de la primera sucursal.
  expect(branchSlugs.length).toBeGreaterThan(0);
  const tenant = await prisma.tenant.findFirst({ where: { status: "active" } });
  const branch = await prisma.branch.findFirst({ where: { tenantId: tenant!.id, active: true, slug: branchSlugs[0] } });
  const preStock = await prisma.inventoryStock.findUnique({
    where: { branchId_productId: { branchId: branch!.id, productId } },
  });
  stockSnapshots.set(`${branch!.id}:${productId}`, { current: preStock?.current ?? 0, existed: Boolean(preStock) });
  await page.goto(`/t/${tenantSlug}/admin/s/${branchSlugs[0]}/compras`);

  // Alta de proveedor por la pestaña Proveedores.
  await page.getByRole("button", { name: "Proveedores" }).click();
  await page.getByRole("button", { name: "+ Nuevo proveedor" }).click();
  const supplierName = `Distribuidora UI ${Date.now()}`;
  await page.getByPlaceholder("Ej. Distribuidora Alimentos S.A.").fill(supplierName);
  await page.getByRole("button", { name: "Crear proveedor" }).click();
  await expect(page.getByText("Proveedor creado")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(supplierName)).toBeVisible({ timeout: 10000 });
  uiSupplierNames.push(supplierName);

  // Nueva compra (wizard en 3 pasos).
  await page.getByRole("button", { name: "Pedidos" }).click();
  await page.getByRole("button", { name: "+ Nueva compra" }).click();
  await expect(page.getByText("Paso 1 de 3")).toBeVisible();
  await page.getByLabel(/Proveedor/).first().selectOption({ label: supplierName });
  // Primera sucursal: coincide con la ruta scoped usada para recibir.
  const firstBranchLabel = await prisma.branch.findFirst({ where: { slug: branchSlugs[0] }, select: { name: true } });
  await page.getByLabel(/Sucursal donde llega/).selectOption({ label: firstBranchLabel!.name });
  await page.getByRole("button", { name: "Siguiente →" }).click();

  await expect(page.getByText("Paso 2 de 3")).toBeVisible();
  await page.getByLabel("Buscar producto para el pedido").fill(productName.slice(0, 20));
  await page.getByRole("button", { name: new RegExp(productName.slice(0, 12)) }).first().click();
  // Ajustar cantidad a 100.
  const qtyInput = page.getByLabel(new RegExp(`Cantidad de .*`)).first();
  await qtyInput.fill("100");
  await page.getByRole("button", { name: "Siguiente →" }).click();

  await expect(page.getByText("Paso 3 de 3")).toBeVisible();
  await expect(page.getByText("Total estimado")).toBeVisible();
  await page.getByRole("button", { name: "Guardar pedido" }).click();
  await expect(page.getByText("Pedido creado")).toBeVisible({ timeout: 8000 });

  // Enviar el pedido.
  const row = page.locator("tr").filter({ hasText: supplierName }).first();
  await row.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("Enviar pedido", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Confirmar" }).click();

  // Abrir detalle y recibir 40.
  await row.getByRole("button", { name: "Ver" }).click();
  await expect(page.getByText("Historial de recepciones")).toBeVisible();
  await page.getByRole("button", { name: "Recibir" }).click();
  const qtyReceive = page.getByLabel("Cantidad a recibir");
  await qtyReceive.fill("40");
  await page.getByRole("button", { name: "Confirmar recepción" }).click();
  await expect(page.getByText("Recepción RC-")).toBeVisible({ timeout: 8000 });
  await expect(page.locator("span").filter({ hasText: /^Recibido parcial$/ }).first()).toBeVisible();

  // Segunda tanda: 35.
  await page.getByRole("button", { name: "Recibir" }).click();
  await qtyReceive.fill("35");
  await page.getByRole("button", { name: "Confirmar recepción" }).click();
  await expect(page.getByText("Recepción RC-")).toBeVisible({ timeout: 8000 });
  // La tabla refleja 75 recibidos y 25 pendientes.
  await expect(page.getByRole("cell", { name: "75" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "25" })).toBeVisible();

  // Historial: dos recepciones listadas en el detalle.
  const receiptHistory = page.getByText("Historial de recepciones");
  await expect(receiptHistory).toBeVisible();
  await expect(page.locator("div").filter({ hasText: /^RC-\d+ .*por/ }).first()).toBeVisible();
  await expect(page.locator("div").filter({ hasText: /^RC-\d+ .*por/ }).nth(1)).toBeVisible();
  await page.getByRole("button", { name: "✕ Cerrar" }).click();
});

test("factura vinculada a recepción con pago parcial y total", async ({ page }) => {
  // Crear pedido + recepción total por API ANTES de cargar la página: el modal
  // de factura precarga solo las recepciones del payload inicial y la sucursal
  // de la URL debe coincidir para que el listado las incluya.
  const tenant = await prisma.tenant.findFirst({ where: { status: "active" } });
  const branch = await prisma.branch.findFirst({ where: { tenantId: tenant!.id, active: true, slug: branchSlugs[0] }, orderBy: { id: "asc" } });
  const branchForUrl = branchSlugs[0] ?? branch!.slug;
  const order = await prisma.purchaseOrder.create({
    data: {
      tenantId: tenant!.id,
      branchId: branch!.id,
      supplierId,
      number: `OC-TEST-${Date.now()}`,
      status: "received",
      orderDate: new Date(),
      notes: "Verificación navegador",
      items: {
        create: [{ productId, quantity: 10, unit: "unidad", unitCost: 800, sortOrder: 0 }],
      },
    },
    include: { items: true },
  });
  const receipt = await prisma.purchaseReceipt.create({
    data: {
      tenantId: tenant!.id,
      branchId: branch!.id,
      supplierId,
      orderId: order.id,
      number: `RC-TEST-${Date.now()}`,
      receivedAt: new Date(),
      notes: "Verificación navegador",
      items: {
        create: [{ orderItemId: order.items[0].id, productId, quantity: 10, unit: "unidad", unitCost: 800, sortOrder: 0 }],
      },
    },
  });

  await page.goto(`/t/${tenantSlug}/admin/s/${branchForUrl}/compras`);
  await page.getByRole("button", { name: "Facturas" }).click();
  await page.getByRole("button", { name: "+ Nueva factura" }).click();
  await expect(page.getByText("Nueva factura de proveedor")).toBeVisible();
  await page.getByLabel(/Proveedor/).first().selectOption({ label: (await prisma.supplier.findUnique({ where: { id: supplierId } }))!.name });
  await page.getByPlaceholder("N° de factura del proveedor").fill("FC-NAV-001");

  // Vincular la recepción creada.
  const receiptLabel = page.locator("label").filter({ hasText: receipt.number }).first();
  await expect(receiptLabel).toBeVisible({ timeout: 8000 });
  await receiptLabel.click();
  await expect(page.getByText(productName, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Crear factura" }).click();
  await expect(page.getByText("Factura creada")).toBeVisible({ timeout: 8000 });

  // Abrir la factura y pagar 6000 (parcial) — el total es 10 × 800 = 8000.
  const invoiceRow = page.locator("tr").filter({ hasText: /GC-\d+/ }).first();
  await invoiceRow.getByRole("button", { name: "Ver / Pagar" }).click();
  await page.getByLabel("Monto del pago").fill("6000");
  await page.getByRole("button", { name: "Pagar", exact: true }).click();
  await expect(page.locator("span").filter({ hasText: /^Parcialmente pagado$/ }).first()).toBeVisible({ timeout: 8000 });
  // El detalle refresca el saldo y limpia el monto tras el pago.
  await expect(page.getByLabel("Monto del pago")).toHaveValue(/^$|^0/);

  // Pagar el saldo y verificar estado pagado.
  await page.getByLabel("Monto del pago").fill("2000");
  await page.getByRole("button", { name: "Pagar", exact: true }).click();
  await expect(page.locator("span").filter({ hasText: /^Pagado$/ }).first()).toBeVisible({ timeout: 8000 });
  await page.getByRole("button", { name: "✕ Cerrar" }).click();
});

test("gastos: alta sin inventario, KPIs y pago parcial", async ({ page }) => {
  await page.goto(`/t/${tenantSlug}/admin/gastos`);
  await expect(page.getByRole("heading", { name: "Gastos", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "+ Nuevo gasto" }).click();
  await expect(page.getByRole("heading", { name: "Nuevo gasto" })).toBeVisible();

  const category = await prisma.expenseCategory.findFirst({ where: { tenantId: (await prisma.tenant.findFirst({ where: { status: "active" } }))!.id, active: true }, orderBy: { sortOrder: "asc" } });
  if (!category) throw new Error("Sin categoría de gasto activa");
  await page.getByLabel("Categoría", { exact: true }).selectOption(String(category.id));
  await page.getByLabel("Importe neto").fill("500000");
  await page.getByLabel("Notas").fill("Verificación navegador");
  await page.getByRole("button", { name: "Guardar gasto" }).click();
  await expect(page.getByText("Gasto registrado")).toBeVisible({ timeout: 8000 });

  await expect(page.getByText("Pendiente este mes")).toBeVisible();
  const row = page.locator("tr").filter({ hasText: /GA-\d+/ }).first();
  await row.getByRole("button", { name: "Ver / Pagar" }).click();
  await page.getByLabel("Monto del pago").fill("200000");
  await page.getByRole("button", { name: "Pagar", exact: true }).click();
  // El pago se refleja en el detalle: saldo pendiente y badge de estado.
  await expect(page.locator("span").filter({ hasText: /^Parcialmente pagado$/ }).first()).toBeVisible({ timeout: 8000 });
  await page.getByRole("button", { name: "✕ Cerrar" }).click();

  // El CSV está disponible en la toolbar.
  await expect(page.getByRole("link", { name: /CSV/ })).toBeVisible();
});

test("filtros del módulo de compras", async ({ page }) => {
  await page.goto(`/t/${tenantSlug}/admin/compras`);
  await expect(page.getByLabel("Buscar en compras")).toBeVisible();
  await page.getByLabel("Buscar en compras").fill("zzz-no-existe");
  await expect(page.getByText("0 resultados")).toBeVisible();
  await page.getByLabel("Buscar en compras").fill("");
  await page.getByLabel("Filtrar por estado").selectOption({ label: "Enviado" });
  await expect(page.getByLabel("Filtrar por proveedor")).toBeVisible();
});

test("responsive móvil: compras y gastos se ven como listas operativas", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/t/${tenantSlug}/admin/compras`);
  await expect(page.getByRole("heading", { name: "Compras", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pedidos" })).toBeVisible();
  await page.goto(`/t/${tenantSlug}/admin/gastos`);
  await expect(page.getByRole("heading", { name: "Gastos", exact: true })).toBeVisible();
  await expect(page.getByText("Pendiente este mes")).toBeVisible();
});
