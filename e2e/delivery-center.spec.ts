import { config as loadEnv } from "dotenv";
loadEnv();

import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma, PrismaClient } from "@prisma/client";
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";

const prisma = new PrismaClient();
const suffix = `${Date.now()}-${randomBytes(3).toString("hex")}`;
const password = `delivery-check-${suffix}`;
const adminEmail = `delivery-admin-${suffix}@example.com`;
const driverEmail = `delivery-driver-${suffix}@example.com`;

let tenantId = -1;
let tenantSlug = "";
let otherTenantSlug = "";
let branchId = -1;
let otherBranchId = -1;
let adminUserId = -1;
let adminRoleId = -1;
let driverRoleId = -1;
let driverUserId = -1;
let driverProfileId = -1;
let alternateDriverProfileId = -1;
let createdDriverProfileId = -1;
let orderId = -1;
let deliveryId = -1;

function privateHash(value: string) {
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? "development-only-change-me"}:${value}`)
    .digest("hex");
}

async function addSessionCookies(context: BrowserContext, page: Page, email: string) {
  const response = await page.request.post(`/api/t/${tenantSlug}/auth/login`, {
    data: { email, password, tenantSlug, context: "tenant", branchId },
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
        url: "http://localhost:3000",
        httpOnly: true,
        sameSite: "Strict" as const,
      };
    }),
  );
}

/** @summary Abre por click el grupo Delivery tanto en navegación superior como móvil. */
async function openDeliveryNavigation(page: Page): Promise<Locator> {
  if ((page.viewportSize()?.width ?? 1280) < 1024) {
    await page.getByRole("button", { name: "Abrir menú" }).click();
    const drawer = page.getByRole("dialog", { name: "Menú de administración" });
    const panel = drawer.locator("#mobile-admin-group-delivery");
    if (!(await panel.isVisible())) {
      await drawer.getByRole("button", { name: "Delivery", exact: true }).click();
    }
    await expect(panel).toBeVisible();
    return panel;
  }

  const navigation = page.getByRole("navigation", { name: "Secciones administrativas" }).first();
  const directTrigger = navigation.getByRole("button", { name: "Delivery", exact: true });
  if (await directTrigger.isVisible().catch(() => false)) {
    await directTrigger.click();
  } else {
    await navigation.getByRole("button", { name: "Más", exact: true }).click();
    await page.getByRole("button", { name: "Delivery", exact: true }).click();
  }
  const panel = page.getByRole("region", { name: "Secciones de Delivery" });
  await expect(panel).toBeVisible();
  return panel;
}

test.describe.serial("Delivery GPS real", () => {
  test.setTimeout(90_000);

  test.beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({ where: { status: "active" } });
    if (!tenant) throw new Error("No hay tenant activo");
    tenantId = tenant.id;
    tenantSlug = tenant.slug;
    otherTenantSlug =
      (await prisma.tenant.findFirst({ where: { id: { not: tenant.id }, status: "active" }, select: { slug: true } }))?.slug ?? "";
    const branches = await prisma.branch.findMany({
      where: { tenantId, active: true, latitude: { not: null }, longitude: { not: null } },
      select: { id: true },
      orderBy: { id: "asc" },
      take: 2,
    });
    if (!branches[0]) throw new Error("No hay sucursal activa con coordenadas");
    branchId = branches[0].id;
    otherBranchId = branches[1]?.id ?? -1;

    const permissionKeys = ["admin.access", "order.manage", "driver.view", "driver.manage", "business.manage"];
    const permissions = await prisma.permission.findMany({
      where: { key: { in: permissionKeys } },
      select: { id: true, key: true },
    });
    if (permissions.length !== permissionKeys.length) throw new Error("Faltan permisos de prueba para Delivery");
    const permissionId = (key: string) => {
      const permission = permissions.find((item) => item.key === key);
      if (!permission) throw new Error(`Falta el permiso ${key}`);
      return permission.id;
    };
    const adminRole = await prisma.role.create({
      data: {
        tenantId,
        key: `delivery-e2e-${suffix}`,
        name: "Delivery E2E",
        permissions: {
          create: ["admin.access", "order.manage", "driver.view", "driver.manage", "business.manage"].map((key) => ({
            permissionId: permissionId(key),
          })),
        },
      },
    });
    adminRoleId = adminRole.id;
    const driverRole = await prisma.role.create({
      data: {
        tenantId,
        key: `driver-e2e-${suffix}`,
        name: "Driver E2E",
        permissions: {
          create: [{ permissionId: permissionId("admin.access") }],
        },
      },
    });
    driverRoleId = driverRole.id;

    const passwordHash = await bcrypt.hash(password, 10);
    const [admin, driver] = await Promise.all([
      prisma.user.create({ data: { name: "Admin GPS Test", email: adminEmail, password: passwordHash, role: adminRole.id, imageUrl: "" } }),
      prisma.user.create({ data: { name: "Repartidor GPS Test", email: driverEmail, password: passwordHash, role: driverRole.id, imageUrl: "" } }),
    ]);
    adminUserId = admin.id;
    driverUserId = driver.id;
    await Promise.all([
      prisma.tenantMembership.create({
        data: {
          tenantId,
          userId: admin.id,
          roleId: adminRole.id,
          status: "active",
          allBranches: true,
          branchAccess: { create: { branchId } },
        },
      }),
      prisma.tenantMembership.create({
        data: {
          tenantId,
          userId: driver.id,
          roleId: driverRole.id,
          status: "active",
          allBranches: false,
          branchAccess: { create: { branchId } },
        },
      }),
    ]);
    const profile = await prisma.driverProfile.create({
      data: {
        tenantId,
        userId: driver.id,
        name: "Repartidor GPS Test",
        phone: "0000000000",
        status: "AVAILABLE",
        branches: { create: { tenantId, branchId } },
      },
    });
    driverProfileId = profile.id;
    const alternateProfile = await prisma.driverProfile.create({
      data: {
        tenantId,
        name: "Repartidor relevo Test",
        phone: "0000000001",
        status: "AVAILABLE",
        branches: { create: { tenantId, branchId } },
      },
    });
    alternateDriverProfileId = alternateProfile.id;
    const order = await prisma.customerOrder.create({
      data: {
        tenantId,
        branchId,
        reference: `GPS-${randomBytes(6).toString("hex").toUpperCase()}`,
        publicTokenHash: randomBytes(32).toString("hex"),
        status: "ready",
        orderType: "delivery",
        channel: "DELIVERY",
        customerName: "Cliente GPS Test",
        phone: "0000000000",
        deliveryAddress: "Dirección de prueba sin geocodificar",
        subtotal: new Prisma.Decimal(100),
        total: new Prisma.Decimal(100),
        items: { create: { productName: "Producto GPS Test", quantity: 1, unitPrice: 100, lineTotal: 100 } },
      },
      include: { items: true },
    });
    orderId = order.id;
    const delivery = await prisma.orderDelivery.create({
      data: {
        tenantId,
        orderId: order.id,
        branchId,
        number: `D-GPS-${randomBytes(5).toString("hex").toUpperCase()}`,
        customerName: order.customerName,
        deliveryAddress: order.deliveryAddress,
        status: "ASSIGNED",
        driverId: driver.id,
        driverProfileId: profile.id,
        assignedAt: new Date(),
        latitude: "-33.1889",
        longitude: "-66.3221",
        items: {
          create: {
            orderItemId: order.items[0].id,
            productName: order.items[0].productName,
            quantityDelivered: 1,
            unitPrice: 100,
          },
        },
      },
    });
    deliveryId = delivery.id;
  });

  test.afterAll(async () => {
    if (orderId > 0) await prisma.customerOrder.delete({ where: { id: orderId } }).catch(() => undefined);
    if (createdDriverProfileId > 0) await prisma.driverProfile.delete({ where: { id: createdDriverProfileId } }).catch(() => undefined);
    if (alternateDriverProfileId > 0) await prisma.driverProfile.delete({ where: { id: alternateDriverProfileId } }).catch(() => undefined);
    if (driverProfileId > 0) await prisma.driverProfile.delete({ where: { id: driverProfileId } }).catch(() => undefined);
    for (const userId of [adminUserId, driverUserId]) {
      if (userId > 0) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    for (const roleId of [adminRoleId, driverRoleId]) {
      if (roleId > 0) await prisma.role.delete({ where: { id: roleId } }).catch(() => undefined);
    }
    await prisma.loginAttempt.deleteMany({ where: { emailHash: { in: [privateHash(adminEmail), privateHash(driverEmail)] } } });
    await prisma.$disconnect();
  });

  test("el Admin abre Delivery y entra al panel personal sin permiso específico", async ({ page }) => {
    await addSessionCookies(page.context(), page, adminEmail);
    await page.goto(`/t/${tenantSlug}/admin/delivery`);
    await expect(page.getByRole("heading", { name: "Centro de delivery" })).toBeVisible();
    await expect(page.getByLabel("Mapa de repartidores, sucursal y entregas")).toBeVisible();
    await expect(page.getByText("Configurá un proveedor de mapas para habilitar la vista geográfica.")).toHaveCount(0);
    const deliveryAccess = page.getByRole("navigation", { name: "Accesos de Delivery" });
    await expect(deliveryAccess.getByRole("link", { name: "Repartidores" })).toBeVisible();
    await expect(deliveryAccess.getByRole("link", { name: "Mapa" })).toBeVisible();
    await expect(deliveryAccess.getByRole("button", { name: "Panel del repartidor" })).toBeVisible();
    await expect(deliveryAccess.getByRole("link", { name: "Configuración" })).toHaveAttribute(
      "href",
      /\/admin\/integraciones#delivery-map$/,
    );
    const assignmentCard = page.getByRole("button", { name: /Preparar envío D-GPS-.* para reasignar/ });
    const alternateDriver = page.locator(`[data-driver-profile-id="${alternateDriverProfileId}"]`);
    await expect(assignmentCard).toBeVisible();
    await expect(alternateDriver).toBeVisible();
    if ((page.viewportSize()?.width ?? 1280) < 1024) {
      await assignmentCard.click();
      await alternateDriver.click();
    } else {
      await assignmentCard.dragTo(alternateDriver);
    }
    await expect.poll(async () =>
      (await prisma.orderDelivery.findUniqueOrThrow({ where: { id: deliveryId } })).driverProfileId,
    ).toBe(alternateDriverProfileId);
    const restoreDriver = await page.request.patch(`/api/t/${tenantSlug}/admin/deliveries/${deliveryId}`, {
      data: { driverProfileId },
    });
    expect(restoreDriver.ok()).toBeTruthy();
    await expect.poll(async () =>
      (await prisma.orderDelivery.findUniqueOrThrow({ where: { id: deliveryId } })).driverProfileId,
    ).toBe(driverProfileId);
    const destination = page.getByRole("button", { name: new RegExp(`Abrir entrega ${deliveryId}|Abrir entrega D-GPS`) });
    await expect(destination).toBeVisible();
    await destination.click();
    if ((page.viewportSize()?.width ?? 1280) < 1024) {
      await expect(page.getByRole("tab", { name: "Entregas" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Detalle" })).toHaveAttribute("aria-selected", "true");
    }

    const deliveryMenu = await openDeliveryNavigation(page);
    await expect(deliveryMenu.getByRole("link", { name: "Centro de delivery", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(deliveryMenu.getByRole("link", { name: "Repartidores", exact: true })).toBeVisible();
    await expect(deliveryMenu.getByRole("link", { name: "Panel del repartidor", exact: true })).toBeVisible();
    await expect(deliveryMenu.getByRole("link", { name: "Configuración de delivery", exact: true })).toBeVisible();
    await deliveryMenu.getByRole("link", { name: "Panel del repartidor", exact: true }).click();
    await expect(page).toHaveURL(/\/t\/[^/]+\/[^/]+\/driver$/);
    await expect(page.getByRole("heading", { name: "Sin perfil de repartidor" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Acceso denegado" })).toHaveCount(0);
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Centro de delivery" })).toBeVisible();
    await page.getByRole("navigation", { name: "Accesos de Delivery" }).getByRole("link", { name: "Repartidores" }).click();
    await expect(page.getByRole("heading", { name: "Repartidores" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Abrir mi panel" })).toBeVisible();

    const createDriver = await page.request.post(`/api/t/${tenantSlug}/admin/drivers`, {
      data: {
        name: "Repartidor alta válida",
        phone: "2664000000",
        userId: null,
        status: "AVAILABLE",
        active: true,
        vehicleType: null,
        plate: null,
        color: null,
        capacity: null,
        notes: null,
        branchIds: [branchId],
      },
    });
    expect(createDriver.status()).toBe(201);
    const created = (await createDriver.json()) as { driver: { id: number; name: string } };
    createdDriverProfileId = created.driver.id;
    expect(created.driver.name).toBe("Repartidor alta válida");
  });

  test("un usuario vinculado sin driver.self comparte, mueve y pausa su ubicación con aislamiento", async ({ browser }) => {
    const driverContext = await browser.newContext({
      geolocation: { latitude: -33.188565, longitude: -66.3217242, accuracy: 8 },
      permissions: ["geolocation"],
    });
    const driverPage = await driverContext.newPage();
    await addSessionCookies(driverContext, driverPage, driverEmail);
    await driverPage.goto(`/t/${tenantSlug}/admin`);
    const deliveryMenu = await openDeliveryNavigation(driverPage);
    await deliveryMenu.getByRole("link", { name: "Panel del repartidor", exact: true }).click();
    await expect(driverPage).toHaveURL(/\/t\/[^/]+\/[^/]+\/driver$/);
    await expect(driverPage.getByRole("navigation", { name: "Navegación principal" })).toHaveCount(0);
    await expect(driverPage.getByRole("complementary", { name: "Preferencias de cookies" })).toHaveCount(0);
    await expect(driverPage.getByRole("button", { name: "Compartir ubicación" })).toBeVisible();
    const firstPost = driverPage.waitForResponse(
      (response) => response.request().method() === "POST" && response.url().includes("/drivers/positions"),
    );
    await driverPage.getByRole("button", { name: "Compartir ubicación" }).click();
    expect((await firstPost).ok()).toBeTruthy();
    await expect(driverPage.getByText("Compartiendo en vivo")).toBeVisible();

    await expect.poll(() =>
      prisma.driverPosition.findFirst({
        where: { tenantId, driverProfileId },
        orderBy: { recordedAt: "desc" },
      }),
    ).not.toBeNull();
    const stored = await prisma.driverPosition.findFirstOrThrow({
      where: { tenantId, driverProfileId },
      orderBy: { recordedAt: "desc" },
    });
    expect(stored.driverId).toBe(driverUserId);
    expect(stored.deliveryId).toBe(deliveryId);
    expect(stored.branchId).toBe(branchId);
    await expect.poll(async () => (await prisma.driverProfile.findUniqueOrThrow({ where: { id: driverProfileId } })).locationSharingEnabled).toBe(true);

    const driverUrl = driverPage.url();
    await driverPage.reload();
    await expect(driverPage.getByRole("button", { name: "Pausar ubicación" })).toBeVisible();
    expect((await prisma.driverProfile.findUniqueOrThrow({ where: { id: driverProfileId } })).locationSharingEnabled).toBe(true);
    await driverPage.goto(`/t/${tenantSlug}/admin`);
    await driverPage.goto(driverUrl);
    await expect(driverPage.getByRole("button", { name: "Pausar ubicación" })).toBeVisible();

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await addSessionCookies(adminContext, adminPage, adminEmail);
    await adminPage.goto(`/t/${tenantSlug}/admin/delivery`);
    const marker = adminPage.getByRole("button", { name: "Abrir seguimiento de Repartidor GPS Test" });
    await expect(marker).toBeVisible();
    await marker.evaluate((element) => (element as HTMLButtonElement).click());
    const preview = adminPage.getByRole("dialog", { name: "Seguimiento del repartidor" });
    await expect(preview).toBeVisible();
    await expect(preview.getByText("Cliente GPS Test")).toBeVisible();
    await adminPage.keyboard.press("Escape");
    const markerTransformBeforeMove = await marker.evaluate((element) => (element as HTMLElement).style.transform);

    const previousRecordedAt = stored.recordedAt;
    await driverPage.waitForTimeout(15_500);
    const movedPost = driverPage.waitForResponse(
      (response) => response.request().method() === "POST" && response.url().includes("/drivers/positions"),
    );
    await driverContext.setGeolocation({ latitude: -33.1882, longitude: -66.3213, accuracy: 7 });
    expect((await movedPost).ok()).toBeTruthy();
    await expect.poll(async () => {
      const position = await prisma.driverPosition.findFirstOrThrow({ where: { tenantId, driverProfileId }, orderBy: { recordedAt: "desc" } });
      return position.recordedAt.getTime();
    }).toBeGreaterThan(previousRecordedAt.getTime());
    await expect.poll(async () => Number((await prisma.driverPosition.findFirstOrThrow({ where: { tenantId, driverProfileId }, orderBy: { recordedAt: "desc" } })).latitude)).toBeCloseTo(-33.1882, 4);
    await expect.poll(
      () => marker.evaluate((element) => (element as HTMLElement).style.transform),
      { timeout: 30_000 },
    ).not.toBe(markerTransformBeforeMove);

    const ownItems = await driverPage.request.get(`/api/t/${tenantSlug}/admin/drivers/positions`);
    expect(ownItems.status()).toBe(403);
    if (otherTenantSlug) {
      const foreignTenant = await adminPage.request.get(`/api/t/${otherTenantSlug}/admin/drivers/positions`);
      expect(foreignTenant.status()).toBe(403);
    }
    if (otherBranchId > 0) {
      const otherBranch = await adminPage.request.get(`/api/t/${tenantSlug}/admin/drivers/positions?branchId=${otherBranchId}`);
      expect(otherBranch.status()).toBe(403);
    }

    await driverPage.getByRole("button", { name: "Pausar ubicación" }).click();
    await expect(driverPage.getByText("Ubicación pausada")).toBeVisible();
    await expect.poll(async () => (await prisma.driverProfile.findUniqueOrThrow({ where: { id: driverProfileId } })).locationSharingEnabled).toBe(false);
    const pausedAt = (await prisma.driverPosition.findFirstOrThrow({ where: { tenantId, driverProfileId }, orderBy: { recordedAt: "desc" } })).recordedAt;
    await driverContext.setGeolocation({ latitude: -33.1878, longitude: -66.3208, accuracy: 7 });
    await driverPage.waitForTimeout(2_000);
    const afterPause = await prisma.driverPosition.findFirstOrThrow({ where: { tenantId, driverProfileId }, orderBy: { recordedAt: "desc" } });
    expect(afterPause.recordedAt.getTime()).toBe(pausedAt.getTime());
    await driverPage.reload();
    await expect(driverPage.getByRole("button", { name: "Compartir ubicación" })).toBeVisible();
    expect((await prisma.driverProfile.findUniqueOrThrow({ where: { id: driverProfileId } })).locationSharingEnabled).toBe(false);

    await adminContext.close();
    await driverContext.close();
  });
});
