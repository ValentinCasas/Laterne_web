import { NextResponse } from "next/server";
import { z } from "zod";
import { analyticsHash, publicAnalyticsEvents, sanitizeAnalyticsMetadata } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { getDefaultTenant } from "@/lib/tenant";

const eventInput = z.object({
  eventType: z.enum(publicAnalyticsEvents),
  sessionId: z.string().min(8).max(100),
  path: z.string().trim().max(300).optional(),
  entityType: z.enum(["product", "category", "promotion", "reservation", "order", "page"]).optional(),
  entityId: z.coerce.number().int().positive().optional(),
  metadata: z.unknown().optional(),
});

/** @summary Recupera una referencia de red para controlar volumen sin conservarla directamente. */
function requestAddress(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** @summary Comprueba que el evento haya sido enviado desde el mismo sitio cuando el navegador informa origen. */
function validOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/** @summary Resuelve la sucursal activa cuando la ruta pertenece a una carta/sitio de sucursal. */
async function branchIdFromRequest(request: Request, path: string | undefined) {
  const headerSlug = request.headers.get("x-menuclick-branch-slug")?.trim().toLocaleLowerCase("es");
  const canonicalMatch = path?.match(/^\/t\/[^/]+\/s\/([a-z0-9-]+)(?:\/|$)/i);
  const legacyMatch = path?.match(/^\/s\/([a-z0-9-]+)(?:\/|$)/i);
  const branchSlug = headerSlug || canonicalMatch?.[1] || legacyMatch?.[1];
  if (!branchSlug) return null;
  const tenant = await getDefaultTenant();
  const branch = await prisma.branch.findFirst({
    where: { tenantId: tenant.id, slug: branchSlug, active: true },
    select: { id: true },
  });
  return branch?.id ?? null;
}

/** @summary Registra un evento anónimo permitido con límites de volumen y metadatos reducidos. */
export async function POST(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ error: "Origen inválido" }, { status: 403 });
  const parsed = eventInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Evento inválido" }, { status: 400 });
  const tenant = await getDefaultTenant();
  const ipHash = analyticsHash("address", requestAddress(request));
  const count = await prisma.analyticsEvent.count({
    where: { ipHash, occurredAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (count >= 300) return new NextResponse(null, { status: 204 });
  const branchId = await branchIdFromRequest(request, parsed.data.path);
  await prisma.analyticsEvent.create({
    data: {
      tenantId: tenant.id,
      branchId,
      eventType: parsed.data.eventType,
      sessionHash: analyticsHash("session", parsed.data.sessionId),
      ipHash,
      path: parsed.data.path?.slice(0, 300) || null,
      entityType: parsed.data.entityType || null,
      entityId: parsed.data.entityId || null,
      metadata: sanitizeAnalyticsMetadata(parsed.data.metadata),
    },
  });
  return new NextResponse(null, { status: 204 });
}
