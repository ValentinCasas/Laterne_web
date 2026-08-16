import { defineConfig } from "vitest/config";

/**
 * Configuración para las pruebas end-to-end contra la base real de desarrollo.
 * Se corre explícitamente (no entra en `npm run test:unit`):
 *   npx vitest run -c vitest.e2e.config.mts e2e/inventory.test.ts
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["e2e/**/*.test.ts"],
  },
  resolve: { alias: { "@": new URL(".", import.meta.url).pathname } },
});
