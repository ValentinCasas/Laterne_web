import { expect, test } from "@playwright/test";

const mobileWidths = [320, 375, 390, 430] as const;

/**
 * @summary Acepta el aviso de privacidad cuando aparece en una prueba E2E.
 */
async function acceptPrivacy(page: import("@playwright/test").Page) {
  const button = page.getByRole("button", { name: "Aceptar analítica" });
  await button.waitFor({ state: "visible", timeout: 2_000 }).catch(() => undefined);
  if (await button.isVisible().catch(() => false)) await button.click();
}

/**
 * @summary Comprueba que una página móvil no tenga desbordamiento horizontal global.
 */
async function expectNoGlobalOverflow(page: import("@playwright/test").Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      })),
    )
    .toEqual(
      await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.clientWidth,
        body: document.documentElement.clientWidth,
      })),
    );
}

test.describe("carta pública responsive", () => {
  test.skip(({ isMobile }) => !isMobile, "La matriz usa el navegador mobile del proyecto.");

  for (const width of mobileWidths) {
    test(`mantiene categorías táctiles y contiene el overflow a ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/t/laterne/carta");
      await acceptPrivacy(page);

      const siteNavbar = page.locator('[data-site-navbar="true"]');
      const menuToolbar = page.getByLabel("Navegación y búsqueda de la carta");
      await expect(siteNavbar).toHaveCSS("position", "fixed");
      await expect(menuToolbar).toHaveCSS("position", "sticky");
      const navbarHeight = (await siteNavbar.boundingBox())?.height ?? 0;
      expect(navbarHeight).toBeGreaterThanOrEqual(64);
      await expect(menuToolbar).toHaveCSS("top", `${Math.round(navbarHeight)}px`);

      const categories = page.locator('a[href^="#category-"]');
      await expect(categories.first()).toBeVisible();
      expect(await categories.count()).toBeGreaterThan(1);
      const categoryBox = await categories.first().boundingBox();
      expect(categoryBox?.height ?? 0).toBeGreaterThanOrEqual(44);

      const rail = categories.first().locator("..");
      expect(await rail.evaluate((element) => element.scrollWidth > element.clientWidth)).toBeTruthy();
      await rail.evaluate((element) => element.scrollTo({ left: element.scrollWidth, behavior: "instant" }));
      await expect(categories.last()).toBeInViewport();
      await page.evaluate(() => window.scrollTo({ top: Math.max(500, document.body.scrollHeight / 3), behavior: "instant" }));
      expect(Math.round((await menuToolbar.boundingBox())?.y ?? -1)).toBe(Math.round(navbarHeight));
      await expectNoGlobalOverflow(page);
    });
  }

  test("respeta el area segura del telefono sin tapar la carta", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/t/laterne/carta");
    await acceptPrivacy(page);
    await page.evaluate(() => document.documentElement.style.setProperty("--site-safe-area-top", "24px"));

    const siteNavbar = page.locator('[data-site-navbar="true"]');
    const menuToolbar = page.locator('[data-menu-toolbar="true"]');
    await expect(siteNavbar).toHaveCSS("height", "89px");
    await expect(menuToolbar).toHaveCSS("top", "89px");

    await page.evaluate(() => window.scrollTo({ top: 700, behavior: "instant" }));
    await expect.poll(async () => Math.round((await menuToolbar.boundingBox())?.y ?? -1)).toBe(89);

    const firstSection = page.locator('[id^="category-"]').first();
    const toolbarHeight = (await menuToolbar.boundingBox())?.height ?? 0;
    const scrollMarginTop = await firstSection.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).scrollMarginTop),
    );
    expect(scrollMarginTop).toBeGreaterThanOrEqual(89 + toolbarHeight);
    await expectNoGlobalOverflow(page);
  });

  test("completa filtros, producto, pedido y checkout a 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/t/laterne/carta");
    await page.evaluate(() => localStorage.removeItem("laterne_carrito"));
    await page.reload();
    await acceptPrivacy(page);

    await expect(page.getByPlaceholder("Buscar en la carta…")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Filtros" })).toHaveCount(0);

    const categories = page.locator('a[href^="#category-"]');
    await categories.nth(1).click();
    await expect(categories.nth(1)).toHaveAttribute("aria-current", "true");

    await page.getByRole("button", { name: /^Filtros/ }).click();
    const filters = page.getByRole("dialog", { name: "Filtros" });
    await expect(filters).toBeVisible();
    await filters.getByLabel("Preferencias").selectOption("glutenFree");
    await filters.getByLabel("Precio máximo").fill("999999999");
    await filters.getByLabel("Ordenar por").selectOption("name");
    await filters.getByRole("button", { name: "Ver resultados" }).click();
    await expect(filters).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Filtros (3)" })).toBeVisible();

    let addButton = page.getByRole("button", { name: /^Agregar / }).first();
    if (!(await addButton.isVisible().catch(() => false))) {
      await page.getByRole("button", { name: /Sin gluten ×/ }).click();
      addButton = page.getByRole("button", { name: /^Agregar / }).first();
    }
    await addButton.click();
    const customizer = page.getByRole("dialog", { name: /^Personalizar / });
    if (await customizer.isVisible().catch(() => false)) {
      await customizer.getByRole("button", { name: "Agregar al pedido" }).click();
    }

    await page.getByRole("button", { name: /Ver pedido con 1 producto/ }).click();
    await expect(page.getByRole("dialog", { name: "Tu pedido" })).toBeVisible();
    await page.getByRole("link", { name: /Continuar/ }).click();
    await expect(page.getByRole("heading", { name: "Todo listo para pedir." })).toBeVisible();
    await expectNoGlobalOverflow(page);
  });
});
