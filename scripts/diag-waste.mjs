import { registerWaste } from "../lib/inventory.ts";

const result = await registerWaste(1, 1, {
  productId: 77,
  quantity: 0.05,
  reason: "Verificación e2e (se restaura)",
}).catch((error) => ({ error: error.message }));

console.log("result:", JSON.stringify(result));
