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

test("Operación agrupa compras y gastos", async ({ page }) => {
  await page.goto(`/t/${tenantSlug}/admin`);
  await expect(page.getByRole("button", { name: "Operación" })).toBeVisible();
  await page.getByRole("button", { name: "Operación" }).click();

  await expect(page.getByText("Compras", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Gastos", { exact: true }).first()).toBeVisible();

  const comprasLink = page.locator('a').filter({ hasText: 'Compras' }).first();
  await expect(comprasLink).toBeVisible();
  const href = await comprasLink.getAttribute("href");
  expect(href).toMatch(/\/admin\/compras$/);

  await comprasLink.click();
  await expect(page).toHaveURL(/\/admin\/compras$/);
  await expect(page.getByRole("heading", { name: "Compras" })).toBeVisible();
});

test("Productos agrupa catálogo, producción e inventario", async ({ page }) => {
  await page.goto(`/t/${tenantSlug}/admin`);
  await expect(page.getByRole("button", { name: "Productos" })).toBeVisible();
  await page.getByRole("button", { name: "Productos" }).click();

  await expect(page.getByText("Catálogo", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Producción", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Inventario", { exact: true }).first()).toBeVisible();

  const inventarioLink = page.locator('a').filter({ hasText: 'Inventario' }).filter({ hasText: 'Stock' }).first();
  await expect(inventarioLink).toBeVisible();
  await inventarioLink.click();
  await expect(page).toHaveURL(/\/admin\/inventario$/);
  await expect(page.getByRole("heading", { name: "Inventario" })).toBeVisible();
});

test("Administración agrupa negocio, configuración, análisis y datos", async ({ page }) => {
  await page.goto(`/t/${tenantSlug}/admin`);
  await expect(page.getByRole("button", { name: "Administración" })).toBeVisible();
  await page.getByRole("button", { name: "Administración" }).click();

  await expect(page.getByText("Negocio", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Análisis", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Datos", { exact: true }).first()).toBeVisible();

  const marcaLink = page.locator('a').filter({ hasText: 'Marca' }).first();
  await expect(marcaLink).toBeVisible();
  await marcaLink.click();
  await expect(page).toHaveURL(/\/admin\/marca$/);
  await expect(page.getByRole("heading", { name: "Marca" })).toBeVisible();
});

test("No hay hydration errors en Productos", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  await page.goto(`/t/${tenantSlug}/admin/productos`);
  await expect(page.getByRole("heading", { name: "Productos" })).toBeVisible();

  const hydrationErrors = consoleErrors.filter((text) =>
    /hydrat/i.test(text) || /didn't match/i.test(text),
  );
  expect(hydrationErrors).toEqual([]);
});
