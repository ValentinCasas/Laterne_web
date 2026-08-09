import { randomBytes } from "node:crypto";

/** @summary Convierte el nombre de una mesa en una base breve apta para su código público. */
function tableCodeBase(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24) || "MESA"
  );
}

/** @summary Genera un código público impredecible y reconocible para una mesa. */
export function tableCode(name: string) {
  return `${tableCodeBase(name)}-${randomBytes(3).toString("hex").toUpperCase()}`;
}
