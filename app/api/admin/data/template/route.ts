import { authorize } from "@/lib/auth";
import { stringifyCsv } from "@/lib/csv";

/** @summary Descarga una plantilla vacía con los encabezados admitidos para importar productos. */
export async function GET() {
  const auth = await authorize("product.manage");
  if (!auth) return new Response("No autorizado", { status: 403 });
  const csv = stringifyCsv([
    [
      "slug",
      "nombre",
      "descripcion",
      "precio",
      "disponibilidad",
      "estado",
      "categoria",
      "imagen",
      "destacado",
      "nuevo",
      "recomendado",
    ],
  ]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="plantilla-productos-laterne.csv"',
    },
  });
}
