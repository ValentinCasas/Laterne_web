import { config as loadEnv } from "dotenv";
loadEnv();

import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { expect, test, type BrowserContext, type ConsoleMessage, type Page } from "@playwright/test";

const prisma = new PrismaClient();
const suffix = `${Date.now()}-${randomBytes(3).toString("hex")}`;
const password = `mobile-check-${suffix}`;
const email = `mobile-check-${suffix}@example.com`;

let tenantSlug = "";
let userId = -1;

const publicPaths = ["", "/carta", "/pedido", "/reservas", "/promociones", "/fidelidad", "/ayuda"] as const;
const adminPaths = [
  "",
  "/pedidos",
  "/cocina",
  "/salon",
  "/reservas",
  "/delivery",
  "/repartidores",
  "/clientes",
  "/productos",
  "/inventario",
  "/compras/pedidos",
  "/compras/facturas",
  "/gastos",
  "/finanzas",
  "/reportes",
  "/integraciones",
  "/usuarios",
  "/sucursales",
] as const;

function privateHash(value: string) {
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? "development-only-change-me"}:${value}`)
    .digest("hex");
}

/** @summary Inicia una sesión E2E sin depender del host localhost para poder validar también por LAN. */
async function login(context: BrowserContext, page: Page) {
  const response = await page.request.post(`/api/t/${tenantSlug}/auth/login`, {
    data: { email, password, tenantSlug, context: "tenant", branchId: 0 },
  });
  expect(response.ok()).toBeTruthy();
  const setCookie = response.headers()["set-cookie"];
  expect(setCookie).toBeTruthy();
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  await context.addCookies(
    cookies.map((cookie) => {
      const [pair] = cookie.split(";");
      const separator = pair.indexOf("=");
      return {
        name: pair.slice(0, separator).trim(),
        value: pair.slice(separator + 1).trim(),
        url: new URL(response.url()).origin,
        httpOnly: true,
        sameSite: "Strict" as const,
      };
    }),
  );
}

/** @summary Mide el viewport móvil y detecta únicamente overflow global, no rieles horizontales intencionales. */
async function mobileLayout(page: Page) {
  return page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
}

/** @summary Verifica que una ruta cargue, conserve el navbar fijo y no ensanche el documento móvil. */
async function auditRoute(page: Page, path: string, navbarSelector: string) {
  const hydrationProblems: string[] = [];
  const hydrationPattern = /hydration|did not match|text content did not match|expected server html/i;
  const recordConsoleProblem = (message: ConsoleMessage) => {
    if (message.type() === "error" && hydrationPattern.test(message.text())) hydrationProblems.push(message.text());
  };
  const recordPageProblem = (error: Error) => {
    if (hydrationPattern.test(String(error))) hydrationProblems.push(String(error));
  };
  page.on("console", recordConsoleProblem);
  page.on("pageerror", recordPageProblem);
  try {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `Estado HTTP de ${path}`).toBeLessThan(400);
    await expect(page.locator(navbarSelector), `Navbar de ${path}`).toHaveCSS("position", "fixed");
    await page.waitForTimeout(250);
    const layout = await mobileLayout(page);
    expect(layout.documentWidth, `Overflow del documento en ${path}: ${JSON.stringify(layout)}`).toBeLessThanOrEqual(layout.viewport);
    expect(layout.bodyWidth, `Overflow del body en ${path}: ${JSON.stringify(layout)}`).toBeLessThanOrEqual(layout.viewport);
    expect(hydrationProblems, `Hydration de ${path}`).toEqual([]);
  } finally {
    page.off("console", recordConsoleProblem);
    page.off("pageerror", recordPageProblem);
  }
}

test.describe.serial("regresión móvil transversal", () => {
  test.skip(({ isMobile }) => !isMobile, "Esta auditoría usa el viewport táctil del proyecto mobile.");
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({ where: { status: "active" } });
    if (!tenant) throw new Error("No hay tenant activo para la auditoría móvil");
    tenantSlug = tenant.slug;

    const branches = await prisma.branch.findMany({
      where: { tenantId: tenant.id, active: true },
      select: { id: true },
    });
    const role = await prisma.role.findFirst({
      where: {
        tenantId: tenant.id,
        OR: [
          { key: { in: ["owner", "administrator"] } },
          { permissions: { some: { permission: { key: "*" } } } },
        ],
      },
      orderBy: { id: "asc" },
    });
    if (!role) throw new Error("No existe un rol administrativo integral");

    const user = await prisma.user.create({
      data: {
        name: "Mobile regression",
        email,
        password: await bcrypt.hash(password, 10),
        role: role.id,
        imageUrl: "",
      },
    });
    userId = user.id;
    await prisma.tenantMembership.create({
      data: {
        tenantId: tenant.id,
        userId,
        roleId: role.id,
        status: "active",
        allBranches: true,
        branchAccess: { create: branches.map(({ id }) => ({ branchId: id })) },
      },
    });
  });

  test.afterAll(async () => {
    if (userId > 0) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    await prisma.loginAttempt.deleteMany({ where: { emailHash: privateHash(email) } });
    await prisma.$disconnect();
  });

  test("las superficies públicas principales funcionan entre 320 y 430 px", async ({ page }) => {
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      for (const suffixPath of publicPaths) {
        await auditRoute(page, `/t/${tenantSlug}${suffixPath}`, '[data-site-navbar="true"]');
      }
    }

    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto(`/t/${tenantSlug}`);
    const publicMenuTrigger = page.getByRole("button", { name: "Abrir navegación" });
    expect((await publicMenuTrigger.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await publicMenuTrigger.click();
    const publicDrawer = page.getByRole("dialog", { name: "Menú de navegación" });
    await expect(publicDrawer).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    await page.keyboard.press("Escape");
    await expect(publicDrawer).toHaveCount(0);
  });

  test("las superficies administrativas principales no se cortan en celular", async ({ context, page }) => {
    await login(context, page);
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      for (const suffixPath of adminPaths) {
        await auditRoute(page, `/t/${tenantSlug}/admin${suffixPath}`, '[data-admin-navbar="true"]');
      }
    }

    await page.setViewportSize({ width: 320, height: 844 });
    const adminMenuTrigger = page.getByRole("button", { name: "Abrir menú" });
    expect((await adminMenuTrigger.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await adminMenuTrigger.click();
    const drawer = page.getByRole("dialog", { name: "Menú de administración" });
    await expect(drawer).toBeVisible();
    const drawerBox = await drawer.boundingBox();
    expect(drawerBox?.width ?? Infinity).toBeLessThanOrEqual(320);
    expect((await drawer.getByRole("button", { name: "Cerrar navegación" }).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);

    await page.goto(`/t/${tenantSlug}/admin/repartidores`);
    await page.getByRole("button", { name: "Filtros", exact: true }).click();
    const filters = page.getByRole("dialog", { name: "Filtros" });
    await expect(filters).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    await filters.getByRole("button", { name: "Cerrar" }).click();
    await expect(filters).toHaveCount(0);

    await page.getByRole("button", { name: "Nuevo repartidor" }).click();
    const driverDrawer = page.getByRole("dialog", { name: "Nuevo repartidor" });
    await expect(driverDrawer).toBeVisible();
    const closeDriverDrawer = driverDrawer.getByRole("button", { name: "Cerrar" });
    expect((await closeDriverDrawer.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await closeDriverDrawer.click();
    await expect(driverDrawer).toHaveCount(0);
  });
});
