import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getDefaultTenant } from "@/lib/tenant";

/**
 * @summary Valida la entrada relacionada con los errores registrados.
 */
const errorInput = z.object({
  source: z.enum(["client-boundary", "global-boundary", "service-worker"]),
  message: z.string().trim().min(1).max(500),
  path: z.string().trim().max(500).optional(),
  digest: z.string().trim().max(160).optional(),
});

/** @summary Anonimiza la dirección de red para limitar incidentes repetidos sin conservarla en claro. */
function requestAddressHash(request: Request) {
  const address =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? "development-only-change-me"}:error:${address}`)
    .digest("hex");
}

/** @summary Registra errores técnicos reducidos sin aceptar trazas, credenciales ni datos arbitrarios. */
export async function POST(request: Request) {
  const parsed = errorInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const tenant = await getDefaultTenant().catch(() => null);
  if (!tenant) return new NextResponse(null, { status: 204 });
  const addressHash = requestAddressHash(request);
  const recentFromAddress = await prisma.errorLog.count({
    where: {
      tenantId: tenant.id,
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      context: { path: "$.addressHash", equals: addressHash },
    },
  });
  if (recentFromAddress >= 50) return new NextResponse(null, { status: 204 });
  const fingerprint = createHash("sha256")
    .update(`${parsed.data.source}:${parsed.data.digest || parsed.data.message}`)
    .digest("hex");
  const recent = await prisma.errorLog.count({
    where: { tenantId: tenant.id, fingerprint, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent < 20) {
    await prisma.errorLog.create({
      data: {
        tenantId: tenant.id,
        source: parsed.data.source,
        message: parsed.data.message,
        path: parsed.data.path || null,
        fingerprint,
        context: { digest: parsed.data.digest || null, addressHash },
      },
    });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
