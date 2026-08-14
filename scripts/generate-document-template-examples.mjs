import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildExampleDocumentTemplate } from "../lib/documents/example-templates.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destination = path.join(root, "examples", "templates");
await mkdir(destination, { recursive: true });

for (const [variant, filename] of [
  ["classic", "comprobante-clasico.docx"],
  ["modern", "comprobante-moderno.docx"],
]) {
  const bytes = await buildExampleDocumentTemplate(variant);
  await writeFile(path.join(destination, filename), bytes);
}

console.log(`Plantillas DOCX generadas en ${destination}`);
