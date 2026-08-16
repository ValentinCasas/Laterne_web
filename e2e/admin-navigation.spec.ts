/**
 * Verifica visualmente que el módulo de Inventario esté integrado al menú
 * principal: Carta → Costos → Inventario, que el enlace use las rutas
 * tenant/branch-scoped de los helpers y que el módulo abra correctamente.
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

test("Carta → Costos → Inventario aparece en el menú y abre el módulo", async ({ page }) => {
  await page.goto(`/t/${tenantSlug}/admin`);
  await expect(page.getByRole("button", { name: "Carta" })).toBeVisible();
  await page.getByRole("button", { name: "Carta" }).click();

  const inventarioLink = page.getByRole("link", { name: "Inventario" });
  await expect(inventarioLink).toBeVisible();
  await expect(page.getByText("Costos", { exact: true }).first()).toBeVisible();

  // El enlace usa las rutas tenant-scoped de los helpers (nada hardcodeado).
  const href = await inventarioLink.getAttribute("href");
  expect(href).toMatch(/^\/t\/[^/]+\/laterne\/admin\/inventario$/);

  await inventarioLink.click();
  await expect(page).toHaveURL(/\/admin\/inventario$/);
  await expect(page.getByRole("heading", { name: "Inventario" })).toBeVisible();
  // El módulo completo está cargado: pestañas operativas.
  await expect(page.getByRole("button", { name: "Stock por sucursal" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Movimientos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Conteos físicos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Transferencias" })).toBeVisible();
});

test("con sucursal seleccionada el enlace de Inventario conserva la sucursal", async ({ page }) => {
  expect(branchSlugs.length).toBeGreaterThan(0);
  await page.goto(`/t/${tenantSlug}/admin/s/${branchSlugs[0]}`);
  await page.getByRole("button", { name: "Carta" }).click();

  const inventarioLink = page.getByRole("link", { name: "Inventario" });
  await expect(inventarioLink).toBeVisible();
  const href = await inventarioLink.getAttribute("href");
  expect(href).toMatch(new RegExp(`/admin/s/${branchSlugs[0]}/inventario$`));
});
