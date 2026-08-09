import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** @summary Protege celdas CSV que podrían interpretarse como fórmulas al abrir una exportación. */
function csvCell(value: string | number | null) {
  let text = value === null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

/** @summary Exporta eventos analíticos del período solicitado sin direcciones ni identificadores sensibles. */
export async function GET(request: Request) {
  const auth = await authorize("analytics.read");
  if (!auth) return new Response("No autorizado", { status: 403 });
  const parameters = new URL(request.url).searchParams;
  const days = Math.min(365, Math.max(1, Number(parameters.get("days") ?? 30)));
  const events = await prisma.analyticsEvent.findMany({
    where: { tenantId: auth.tenant.id, occurredAt: { gte: new Date(Date.now() - days * 86_400_000) } },
    select: {
      occurredAt: true,
      eventType: true,
      path: true,
      entityType: true,
      entityId: true,
      metadata: true,
    },
    orderBy: { occurredAt: "desc" },
    take: 100_000,
  });
  const rows = [
    "fecha,evento,ruta,entidad,id,metadatos",
    ...events.map((event) =>
      [
        event.occurredAt.toISOString(),
        event.eventType,
        event.path,
        event.entityType,
        event.entityId,
        event.metadata ? JSON.stringify(event.metadata) : "",
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  return new Response(`\uFEFF${rows.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="laterne-analitica-${days}d.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
