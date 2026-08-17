import { config as loadEnv } from "dotenv";
loadEnv();

import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

const prisma = new PrismaClient();
const password = `final-check-${Date.now()}`;
const email = `final-check-${Date.now()}@example.com`;

let tenantSlug = "";

function privateHash(value: string) {
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? "development-only-change-me"}:${value}`)
    .digest("hex");
}

async function createTempAdmin() {
  const tenant = await prisma.tenant.findFirst({ where: { status: "active" } });
  if (!tenant) throw new Error("No hay tenant activo");
  tenantSlug = tenant.slug;

  const branches = await prisma.branch.findMany({
    where: { tenantId: tenant.id, active: true },
    select: { id: true, slug: true },
  });

  const role = await prisma.role.findFirst({
    where: { tenantId: tenant.id, permissions: { some: { permission: { key: "customer.manage" } } } },
  });
  if (!role) throw new Error("No existe rol con customer.manage");

  const user = await prisma.user.create({
    data: {
      name: "Final check",
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

test("Las páginas principales cargan sin errores", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto(`/t/${tenantSlug}/admin/clientes`);
  await expect(page.getByRole("heading", { name: "Base maestra de clientes" })).toBeVisible();

  await page.goto(`/t/${tenantSlug}/admin/entregas`);
  await expect(page.getByRole("heading", { name: "Entregas confirmadas" })).toBeVisible();

  await page.goto(`/t/${tenantSlug}/admin/cobros`);
  await expect(page.getByRole("heading", { name: "Cobros y saldo de clientes" })).toBeVisible();

  await page.goto(`/t/${tenantSlug}/admin/fidelizacion`);
  await expect(page.getByRole("heading", { name: "Recompensas" })).toBeVisible();

  await page.goto(`/t/${tenantSlug}/admin/pedidos`);
  await expect(page.getByRole("heading", { name: "Pedidos" })).toBeVisible();

  const prismaErrors = errors.filter((text) => /PrismaClientKnownRequestError|PrismaClientValidationError/.test(text));
  expect(prismaErrors).toEqual([]);
});
