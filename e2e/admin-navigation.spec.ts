/**
 * Verifica visualmente que los módulos principales estén integrados al menú
 * principal, que los enlaces usen las rutas tenant/branch-scoped de los helpers
 * y que cada módulo abra correctamente.
 * Crea un usuario administrativo temporal y lo elimina al terminar.
 */
import { config as loadEnv } from "dotenv";
loadEnv();

import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

const prisma = new PrismaClient();
const password = `nav-${Date.now()}`;
const email = `nav-check-${Date.now()}@example.com`;

let tenantSlug = "";
let branchSlugs: string[] = [];

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
    where: { tenantId: tenant.id, permissions: { some: { permission: { key: "product.manage" } } } },
  });
  if (!role) throw new Error("No existe un rol con product.manage para el tenant");

  const user = await prisma.user.create({
    data: {
      name: "Verificación navegación",
      email,
      password: await bcrypt.hash(password, 10),
      role: role.id,
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
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  const parsed = cookies.map((cookie) => {
    const [pair] = cookie.split(";");
    const [name, value] = pair.split("=");
    return { name: name.trim(), value: value.trim() };
  });
  await page.context().addCookies(
    parsed.map(({ name, value }) => ({
      name,
      value,
      url: "http://localhost:3000",
      httpOnly: true,
      sameSite: "Strict",
    })),
  );
}

test.beforeAll(async () => {
  await createTempAdmin();
});

test.afterAll(async () => {
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

test("Inventario aparece en el menú y abre el módulo", async ({ page }) => {
  await page.goto(`/t/${tenantSlug}/admin`);
  await expect(page.getByRole("button", { name: "Inventario" })).toBeVisible();
  await page.getByRole("button", { name: "Inventario" }).click();

  const inventarioLink = page.locator('a').filter({ hasText: 'Inventario' }).filter({ hasText: 'Stock' }).first();
  await expect(inventarioLink).toBeVisible();
  await expect(page.getByText("Operación", { exact: true }).first()).toBeVisible();

  const href = await inventarioLink.getAttribute("href");
  expect(href).toMatch(/\/admin\/inventario$/);

  await inventarioLink.click();
  await expect(page).toHaveURL(/\/admin\/inventario$/);
  await expect(page.getByRole("heading", { name: "Inventario" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Stock por sucursal" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Movimientos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Conteos físicos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Transferencias" })).toBeVisible();
});

test("con sucursal seleccionada el enlace de Inventario conserva la sucursal", async ({ page }) => {
  expect(branchSlugs.length).toBeGreaterThan(0);
  await page.goto(`/t/${tenantSlug}/admin/s/${branchSlugs[0]}`);
  await page.getByRole("button", { name: "Inventario" }).click();

  const inventarioLink = page.locator('a').filter({ hasText: 'Inventario' }).filter({ hasText: 'Stock' }).first();
  await expect(inventarioLink).toBeVisible();
  const href = await inventarioLink.getAttribute("href");
  expect(href).toMatch(new RegExp(`/admin/s/${branchSlugs[0]}/inventario$`));
});

test("Compras aparece en el menú y abre el módulo", async ({ page }) => {
  await page.goto(`/t/${tenantSlug}/admin`);
  await expect(page.getByRole("button", { name: "Compras" })).toBeVisible();
  await page.getByRole("button", { name: "Compras" }).click();

  const comprasLink = page.locator('a').filter({ hasText: 'Compras' }).first();
  await expect(comprasLink).toBeVisible();
  const href = await comprasLink.getAttribute("href");
  expect(href).toMatch(/\/admin\/compras$/);

  await comprasLink.click();
  await expect(page).toHaveURL(/\/admin\/compras$/);
  await expect(page.getByRole("heading", { name: "Compras" })).toBeVisible();
});

test("Ventas agrupa pedidos, clientes, reservas y facturacion", async ({ page }) => {
  await page.goto(`/t/${tenantSlug}/admin`);
  await expect(page.getByRole("button", { name: "Ventas" })).toBeVisible();
  await page.getByRole("button", { name: "Ventas" }).click();

  await expect(page.getByText("Atención", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Clientes", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Reservas", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Facturación", { exact: true }).first()).toBeVisible();

  const pedidosLink = page.locator('a').filter({ hasText: 'Pedidos' }).first();
  await expect(pedidosLink).toBeVisible();
  await pedidosLink.click();
  await expect(page).toHaveURL(/\/admin\/pedidos$/);
});
