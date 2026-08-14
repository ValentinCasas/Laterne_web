import { expect, test } from "@playwright/test";

/** @summary Cierra el aviso de privacidad cuando todavía no existe una preferencia local. */
async function acceptPrivacy(page: import("@playwright/test").Page) {
  const button = page.getByRole("button", { name: "Aceptar analítica" });
  await button.waitFor({ state: "visible", timeout: 2_000 }).catch(() => undefined);
  if (await button.isVisible().catch(() => false)) await button.click();
}

test("convierte productos de la carta en un pedido persistente", async ({ page }) => {
  await page.goto("/t/laterne/carta");
  await acceptPrivacy(page);
  await page
    .getByRole("button", { name: /^Agregar / })
    .first()
    .click();
  await page.getByRole("button", { name: /Ver pedido con 1 producto/ }).click();
  await page.getByRole("link", { name: /Continuar/ }).click();
  await expect(page.getByRole("heading", { name: "Todo listo para pedir." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "¿Cómo querés recibir tu pedido?" })).toBeVisible();
});

test("expone reservas, fidelización y ayuda en dispositivos reales", async ({ page }) => {
  await page.goto("/t/laterne/reservas");
  await acceptPrivacy(page);
  await expect(page.getByRole("heading", { name: /Reservá sin llamadas/ })).toBeVisible();
  await expect(page.getByLabel("Cantidad de personas")).toBeVisible();

  await page.goto("/t/laterne/fidelidad");
  await expect(page.getByRole("heading", { name: "Sumá puntos en cada visita" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Crear perfil frecuente" })).toBeVisible();

  await page.goto("/t/laterne/ayuda");
  await expect(page.getByRole("heading", { name: "¿Cómo podemos ayudarte?" })).toBeVisible();
  await expect(page.getByPlaceholder("Buscar una respuesta…")).toBeVisible();
});

test("ofrece promociones, portfolio y páginas de error profesionales", async ({ page }) => {
  await page.goto("/t/laterne/promociones");
  await acceptPrivacy(page);
  await expect(page.getByRole("heading", { name: /Siempre hay una buena excusa/ })).toBeVisible();
  await page.goto("/clientes");
  await expect(page.getByRole("heading", { name: /Tecnología que se nota/ })).toBeVisible();
  await page.goto("/t/laterne/esta-ruta-no-existe");
  await expect(page.getByText("404")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ir a la carta" })).toBeVisible();
});
