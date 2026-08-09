import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next", "e2e"],
    coverage: { reporter: ["text", "html"] },
  },
  resolve: { alias: { "@": new URL(".", import.meta.url).pathname } },
});
