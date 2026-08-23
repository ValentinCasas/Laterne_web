/**
 * Verifica que las páginas de recetas e ingredientes no produzcan errores de
 * hydration en el navegador (SSR y primera renderización del cliente deben
 * coincidir). Cubre acceso directo, F5, navegación desde el tablero, botón de
 * volver y URLs con sucursal seleccionada.
 *
 * Crea un usuario administrativo temporal con contraseña conocida, lo elimina
 * al terminar y restaura los datos que toca.
 */
import { config as loadEnv } from "dotenv";
loadEnv();

import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

const prisma = new PrismaClient();
const password = `hydra-${Date.now()}`;
const email = `hydration-check-${Date.now()}@example.com`;

let tenantSlug = "";
let productId = 0;
let productName = "";
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

  const product =
    (await prisma.product.findFirst({
      where: { tenantId: tenant.id, status: { not: "archived" }, recipeItems: { some: {} } },
      select: { id: true, name: true },
    })) ??
    (await prisma.product.findFirst({
      where: { tenantId: tenant.id, status: { not: "archived" } },
      select: { id: true, name: true },
    }));
  if (!product) throw new Error("No hay productos para probar el editor de recetas");
  productId = product.id;
  productName = product.name;

  const user = await prisma.user.create({
    data: {
      name: "Verificación hydration",
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

/** @summary Recolecta errores de consola durante la navegación de un test. */
function watchConsole(page: Page) {
  const problems: string[] = [];
  const hydrationPattern = /hydration|did not match|text content did not match|Expected server HTML/i;
  page.on("console", (message) => {
    if (message.type() === "error" && hydrationPattern.test(message.text())) {
      problems.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    if (hydrationPattern.test(String(error))) problems.push(String(error));
  });
  return problems;
}

/** @summary Espera a que la página hidrate y confirma que no hubo warnings. */
async function expectCleanHydration(page: Page, problems: string[]) {
  await page.waitForTimeout(400);
  expect(problems, "No debe haber warnings de hydration en consola").toEqual([]);
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

test("acceso directo y refresco del editor de receta sin hydration errors", async ({ page }) => {
  const problems = watchConsole(page);
  const editorUrl = `/t/${tenantSlug}/admin/recetas/${productId}`;
  await page.goto(editorUrl);
  await expect(page.getByRole("link", { name: /Volver/ })).toBeVisible();
  await expectCleanHydration(page, problems);

  await page.reload();
  await expect(page.getByRole("link", { name: /Volver/ })).toBeVisible();
  await expectCleanHydration(page, problems);
});

test("navegación desde el tablero al editor y volver sin hydration errors", async ({ page }) => {
  const problems = watchConsole(page);
  const boardUrl = `/t/${tenantSlug}/admin/recetas`;
  await page.goto(boardUrl);
  await expect(page.getByRole("heading", { name: "Recetas" })).toBeVisible();
  await expectCleanHydration(page, problems);

  await page.getByPlaceholder(/Buscar por nombre/).fill(productName);
  await expect(page.getByText(productName, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Abrir acciones" }).filter({ visible: true }).first().click();
  await page.getByRole("menuitem", { name: "Editar" }).click();
  await expect(page.getByRole("link", { name: /Volver/ })).toBeVisible();
  await expectCleanHydration(page, problems);

  await page.getByRole("link", { name: /Volver/ }).click();
  await expect(page).toHaveURL(/\/admin\/recetas$/);
  await expect(page.getByRole("heading", { name: "Recetas" })).toBeVisible();
  await expectCleanHydration(page, problems);
});

test("edición con sucursal seleccionada (ambas sucursales) sin hydration errors", async ({ page }) => {
  expect(branchSlugs.length).toBeGreaterThan(0);
  for (const branchSlug of branchSlugs) {
    const problems = watchConsole(page);
    await page.goto(`/t/${tenantSlug}/admin/s/${branchSlug}/recetas/${productId}`);
    await expect(page.getByRole("link", { name: /Volver/ })).toBeVisible();
    await expectCleanHydration(page, problems);
  }
});

test("tablero de recetas e ingredientes sin hydration errors", async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto(`/t/${tenantSlug}/admin/recetas`);
  await expect(page.getByRole("heading", { name: "Recetas" })).toBeVisible();
  await expectCleanHydration(page, problems);

  await page.goto(`/t/${tenantSlug}/admin/ingredientes`);
  await expect(page.getByRole("heading", { name: "Ingredientes" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver recetas" })).toBeVisible();
  await expectCleanHydration(page, problems);
});
