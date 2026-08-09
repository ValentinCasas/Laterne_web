import { expect, test } from "@playwright/test";

/** @summary Cierra el aviso opcional para evitar que cubra controles durante el recorrido automatizado. */
async function acceptPrivacy(page: import("@playwright/test").Page) {
  const button = page.getByRole("button", { name: "Aceptar analítica" });
  await button.waitFor({ state: "visible", timeout: 2_000 }).catch(() => undefined);
  if (await button.isVisible().catch(() => false)) await button.click();
}

test("muestra la propuesta comercial y sus planes administrables", async ({ page }) => {
  await page.goto("/para-negocios");
  await expect(page.getByRole("heading", { name: /Tu carta deja de ser un archivo/i })).toBeVisible();
  await page.getByRole("link", { name: "Ver planes" }).click();
  await expect(page.getByRole("heading", { name: "Plan Esencial", level: 2 })).toBeVisible();
  await expect(page.getByText("$ 690.000", { exact: true })).toBeVisible();
});

test("recorre la carta y abre una ficha individual", async ({ page }) => {
  await page.goto("/carta");
  await acceptPrivacy(page);
  const detailLink = page.getByRole("link", { name: "Ver detalles" }).first();
  await expect(detailLink).toBeVisible();
  await Promise.all([page.waitForURL(/\/productos\//), detailLink.click()]);
  await expect(page.getByRole("button", { name: /Agregar al pedido|Temporalmente agotado/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Favorito/i })).toBeVisible();
});

test("presenta un formulario de demo completo y accesible", async ({ page }) => {
  await page.goto("/solicitar-demo");
  await expect(page.getByRole("heading", { name: /Veamos cómo funcionaría/i })).toBeVisible();
  await expect(page.getByLabel("Nombre y apellido")).toBeVisible();
  await expect(page.getByLabel("Tipo de negocio")).toBeVisible();
  await expect(page.getByRole("button", { name: "Solicitar demostración" })).toBeVisible();
});
