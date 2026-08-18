/**
 * Verificación integral del gestor visual de Productos en navegador real.
 *
 * Cubre: vista Lista y Tarjetas, búsqueda, ordenamiento, densidad, filtros
 * rápidos y avanzados con chips activos, filtros por columna, selección
 * múltiple con toolbar masivo, empty states, creación de producto con carga
 * real de imagen (drag & drop), GLB y USDZ, y persistencia al re-editar.
 *
 * Crea un usuario administrativo temporal con contraseña conocida y un
 * producto de prueba; elimina ambos al terminar y restaura los datos tocados.
 */
import { config as loadEnv } from "dotenv";
loadEnv();

import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

const prisma = new PrismaClient();
const password = `prod-${Date.now()}`;
const email = `products-check-${Date.now()}@example.com`;

let tenantSlug = "";
let existingProductName = "";
let categoryName = "";
const createdProductName = `E2E Producto ${Date.now()}`;

/** @summary PNG transparente de 1x1 para probar la carga de imágenes. */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/** @summary GLB glTF 2.0 mínimo (escena vacía) que supera la validación del servidor. */
function tinyGlb(): Buffer {
  const json = Buffer.from('{"asset":{"version":"2.0"}}', "utf8");
  // El chunk JSON se rellena con espacios (0x20), como exige la especificación glTF.
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
  json.copy(padded);
  const total = 12 + 8 + padded.length;
  const header = Buffer.alloc(12);
  header.write("glTF", 0, "ascii");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);
  const chunkHeader = Buffer.alloc(8);
  chunkHeader.writeUInt32LE(padded.length, 0);
  chunkHeader.writeUInt32LE(0x4e4f534a, 4); // "JSON"
  return Buffer.concat([header, chunkHeader, padded]);
}

/** @summary USDZ vacío (zip sin entradas) con la firma que valida el servidor. */
function tinyUsdz(): Buffer {
  const zip = Buffer.alloc(22);
  zip[0] = 0x50; // P
  zip[1] = 0x4b; // K
  zip[2] = 0x05;
  zip[3] = 0x06;
  return zip;
}

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

  const product = await prisma.product.findFirst({
    where: { tenantId: tenant.id, status: { not: "archived" } },
    select: { id: true, name: true },
  });
  if (product) existingProductName = product.name;

  const parentCategory = await prisma.category.findFirst({
    where: { tenantId: tenant.id, parentId: null },
    select: { name: true },
  });
  if (parentCategory) categoryName = parentCategory.name;

  const user = await prisma.user.create({
    data: {
      name: "Verificación productos",
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

/** @summary Recolecta errores fatales de la página (hydration o excepciones no capturadas). */
function watchPage(page: Page) {
  const problems: string[] = [];
  const hydrationPattern = /hydration|did not match|text content did not match|Expected server HTML/i;
  page.on("console", (message) => {
    if (message.type() === "error" && hydrationPattern.test(message.text())) {
      problems.push(message.text());
    }
  });
  page.on("pageerror", (error) => problems.push(String(error)));
  return problems;
}

/** @summary Espera a que la página hidrate y confirma que no hubo errores. */
async function expectClean(page: Page, problems: string[]) {
  await page.waitForTimeout(500);
  expect(problems, "No debe haber errores de hydration ni excepciones en consola").toEqual([]);
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
  // Producto de prueba y sus archivos subidos durante la verificación.
  const created = await prisma.product.findMany({
    where: { name: { startsWith: "E2E Producto" } },
    select: { id: true },
  });
  if (created.length) {
    const ids = created.map((item) => item.id);
    await prisma.$transaction([
      prisma.productVariant.deleteMany({ where: { group: { productId: { in: ids } } } }),
      prisma.productExtra.deleteMany({ where: { group: { productId: { in: ids } } } }),
      prisma.productOptionGroup.deleteMany({ where: { productId: { in: ids } } }),
      prisma.productPrice.deleteMany({ where: { productId: { in: ids } } }),
      prisma.productComboItem.deleteMany({
        where: { OR: [{ productId: { in: ids } }, { itemProductId: { in: ids } }] },
      }),
      prisma.recipeIngredient.deleteMany({
        where: { OR: [{ productId: { in: ids } }, { ingredientProductId: { in: ids } }] },
      }),
      prisma.branchProduct.deleteMany({ where: { productId: { in: ids } } }),
      prisma.productCategory.deleteMany({ where: { productId: { in: ids } } }),
      prisma.productAllergen.deleteMany({ where: { productId: { in: ids } } }),
      prisma.inventoryStock.deleteMany({ where: { productId: { in: ids } } }),
      prisma.product.deleteMany({ where: { id: { in: ids } } }),
    ]);
  }
  await prisma.mediaAsset.deleteMany({
    where: {
      OR: [
        { filename: { startsWith: "e2e-test-img" } },
        { filename: { startsWith: "e2e-test-model" } },
        { filename: { startsWith: "e2e-test-usdz" } },
      ],
    },
  });
  await prisma.$disconnect();
});

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("vista Lista y Tarjetas: toggle, información de producto y consola limpia", async ({ page }) => {
  const problems = watchPage(page);
  await page.goto(`/t/${tenantSlug}/admin/productos`);
  await expect(page.getByRole("heading", { name: "Productos" })).toBeVisible();
  await expectClean(page, problems);

  // Vista Lista por defecto: la tabla es visible y tiene filas.
  const table = page.locator("table");
  await expect(table).toBeVisible();
  await expect(table.locator("tbody tr").first()).toBeVisible();

  // Cambiar a Tarjetas: aparece la grilla de cards con imagen, nombre y precio.
  await page.getByRole("button", { name: "Tarjetas" }).click();
  const cards = page.locator("article");
  await expect(cards.first()).toBeVisible();
  await expect(cards.first().locator("img")).toBeVisible();
  await expect(cards.first().locator("h3")).toBeVisible();
  expect(await page.locator("article").count()).toBeGreaterThan(1);
  await expectClean(page, problems);

  // Volver a Lista: la tabla reaparece.
  await page.getByRole("button", { name: "Lista" }).click();
  await expect(table).toBeVisible();
  await expectClean(page, problems);
});

test("búsqueda, ordenamiento y densidad", async ({ page }) => {
  await page.goto(`/t/${tenantSlug}/admin/productos`);
  await expect(page.getByRole("heading", { name: "Productos" })).toBeVisible();

  const search = page.getByRole("textbox", { name: "Buscar productos" });
  const rows = page.locator("tbody tr");
  const initialCount = await rows.count();
  expect(initialCount).toBeGreaterThan(1);

  await search.fill(existingProductName.slice(0, 20));
  await page.waitForTimeout(400);
  const filteredCount = await rows.count();
  expect(filteredCount).toBeGreaterThan(0);
  expect(filteredCount).toBeLessThan(initialCount);
  await expect(rows.first()).toContainText(existingProductName.slice(0, 20));

  // Limpiar búsqueda y ordenar por precio.
  await search.fill("");
  await page.getByLabel("Ordenar productos").selectOption({ label: "Precio (mayor a menor)" });
  await page.waitForTimeout(300);
  await expect(page.locator("tbody tr").first()).toBeVisible();

  // Densidad compacta.
  await page.getByLabel("Densidad de la lista").selectOption({ label: "Compacta" });
  await page.waitForTimeout(200);
  await expect(page.getByLabel("Densidad de la lista")).toHaveValue("compact");
});

test("filtros rápidos, drawer avanzado y chips activos", async ({ page }) => {
  await page.goto(`/t/${tenantSlug}/admin/productos`);

  // Chip rápido de favoritos.
  const favoriteChip = page.getByRole("button", { name: "Favoritos", exact: true });
  await favoriteChip.click();
  await expect(favoriteChip).toHaveClass(/bg-pink-500\/20/);
  await favoriteChip.click();

  // Drawer de filtros avanzados: estado Borrador + ver resultados.
  await page.getByRole("button", { name: /Filtros/ }).first().click();
  await page.getByRole("button", { name: "Cerrar filtros" }).waitFor();
  await page.getByLabel("Estado editorial").selectOption({ label: "Borrador" });
  await page.getByRole("button", { name: "Ver resultados" }).click();
  await page.waitForTimeout(300);

  // Los chips activos muestran el filtro aplicado.
  await expect(page.getByText("Estado: Borrador")).toBeVisible();
  await page.getByRole("button", { name: "Limpiar filtros" }).first().click();
  await page.waitForTimeout(200);
  await expect(page.getByText("Estado: Borrador")).toHaveCount(0);
});

test("filtro contextual por columna (Margen sin costo)", async ({ page }) => {
  await page.goto(`/t/${tenantSlug}/admin/productos`);
  const table = page.locator("table");
  await expect(table).toBeVisible();

  await page.getByRole("button", { name: "Filtrar por Margen" }).click();
  const panel = page.locator("th", { has: page.getByRole("button", { name: "Filtrar por Margen" }) });
  const select = panel.locator("select");
  await select.selectOption({ label: "Sin costo" });
  await page.getByRole("button", { name: "Listo" }).click();
  await page.waitForTimeout(300);

  // El chip del filtro aparece y la tabla sigue funcionando.
  await expect(page.getByText(/Sin costo/).first()).toBeVisible();
  await page.getByRole("button", { name: "Limpiar filtros" }).first().click();
  await page.waitForTimeout(200);
  await expect(table.locator("tbody tr").first()).toBeVisible();
});

test("selección múltiple con toolbar masivo contextual", async ({ page }) => {
  await page.goto(`/t/${tenantSlug}/admin/productos`);
  await page.getByRole("button", { name: "Tarjetas" }).click();
  const cards = page.locator("article");
  await expect(cards.first()).toBeVisible();

  await cards.nth(0).getByRole("checkbox").check();
  await cards.nth(1).getByRole("checkbox").check();
  await expect(page.getByText("2 seleccionados")).toBeVisible();
  await page.getByRole("button", { name: "Quitar selección" }).click();
  await expect(page.getByText("2 seleccionados")).toHaveCount(0);
});

test("empty state con búsqueda sin resultados y limpieza", async ({ page }) => {
  await page.goto(`/t/${tenantSlug}/admin/productos`);
  const search = page.getByRole("textbox", { name: "Buscar productos" });
  await search.fill("zzzz-no-existe-este-producto");
  await expect(page.getByText("No encontramos productos con estos filtros")).toBeVisible();
  await page.getByRole("button", { name: "Limpiar filtros" }).first().click();
  await page.waitForTimeout(200);
  await expect(page.locator("table tbody tr").first()).toBeVisible();
});

test("crear producto con imagen (drag & drop), GLB y USDZ + persistencia", async ({ page }) => {
  const problems = watchPage(page);
  await page.goto(`/t/${tenantSlug}/admin/productos`);

  await page.getByRole("button", { name: "+ Nuevo producto" }).click();
  await expect(page.getByRole("heading", { name: "Nuevo producto" })).toBeVisible();
  await page.getByPlaceholder("Ej. Café con 2 medialunas").fill(createdProductName);
  await page.getByPlaceholder("Ej. Café expreso con dos medialunas recién horneadas.").fill("Producto creado para verificación end-to-end del gestor visual.");
  await page.getByLabel("Categoría de la carta").selectOption({ label: categoryName });

  // Imagen por drag & drop real (mismo flujo que el selector de archivos).
  await page.evaluate(
    async ({ dropText, fileName, bytes, mime }) => {
      const file = new File([new Uint8Array(bytes)], fileName, { type: mime });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const targets = [...document.querySelectorAll("button")].filter((button) =>
        button.textContent?.includes(dropText),
      );
      const target = targets[0];
      if (target) target.dispatchEvent(new DragEvent("drop", { dataTransfer: transfer, bubbles: true }));
    },
    {
      dropText: "Arrastrá una imagen",
      fileName: "e2e-test-img.png",
      bytes: [...TINY_PNG],
      mime: "image/png",
    },
  );
  await expect(page.getByText("Imagen cargada")).toBeVisible({ timeout: 15000 });

  // Paso 2: precio (obligatorio para publicar).
  await page.getByRole("button", { name: "Siguiente →" }).click();
  await page.getByLabel("Precio de venta").fill("1200");

  // Ir al paso 5 (Imagen y 3D/AR).
  for (let index = 0; index < 3; index += 1) {
    await page.getByRole("button", { name: "Siguiente →" }).click();
  }
  await expect(page.getByText("Rutas técnicas")).toBeVisible();

  // Cargar GLB y USDZ.
  const modelInput = page.locator('input[type="file"]').nth(0);
  await modelInput.setInputFiles({
    name: "e2e-test-model.glb",
    mimeType: "model/gltf-binary",
    buffer: tinyGlb(),
  });
  await expect(page.getByText(/e2e-test-model-.*\.glb/).first()).toBeVisible({ timeout: 15000 });

  const usdzInput = page.locator('input[type="file"]').nth(1);
  await usdzInput.setInputFiles({
    name: "e2e-test-usdz.usdz",
    mimeType: "model/vnd.usdz+zip",
    buffer: tinyUsdz(),
  });
  await expect(page.getByText(/e2e-test-usdz-.*\.usdz/).first()).toBeVisible({ timeout: 15000 });

  // Guardar el producto.
  await page.getByRole("button", { name: "Crear producto" }).click();
  await expect(page.getByText("Producto creado")).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("heading", { name: "Nuevo producto" })).toHaveCount(0, { timeout: 15000 });
  await expectClean(page, problems);

  // Aparece en el tablero.
  await page.getByRole("textbox", { name: "Buscar productos" }).fill(createdProductName);
  await expect(page.getByText(createdProductName).first()).toBeVisible({ timeout: 10000 });

  // Persistencia: re-editar y verificar que imagen y modelos quedaron guardados.
  await page.locator("tbody tr").first().getByRole("button", { name: "Editar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Editar producto" })).toBeVisible();
  await expect(page.getByText("Imagen cargada")).toBeVisible();
  for (let index = 0; index < 4; index += 1) {
    await page.getByRole("button", { name: "Siguiente →" }).click();
  }
  await expect(page.getByText(/e2e-test-model-.*\.glb/).first()).toBeVisible();
  await expect(page.getByText(/e2e-test-usdz-.*\.usdz/).first()).toBeVisible();
  await expectClean(page, problems);
});

test("responsive móvil: tarjetas en una columna y drawer de filtros", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/t/${tenantSlug}/admin/productos`);
  await page.getByRole("button", { name: "Tarjetas" }).click();
  const cards = page.locator("article");
  await expect(cards.first()).toBeVisible();
  const firstBox = await cards.nth(0).boundingBox();
  const secondBox = await cards.nth(1).boundingBox();
  expect(firstBox && secondBox).toBeTruthy();
  // En una columna, la segunda card está debajo de la primera.
  expect((secondBox?.y ?? 0) > (firstBox?.y ?? 0)).toBeTruthy();
});
