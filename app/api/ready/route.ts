import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const READINESS_TIMEOUT_MS = 5_000;

/**
 * Readiness: la aplicación puede atender tráfico real.
 *
 * Verifica que la base de datos responda dentro de un tiempo acotado. En
 * despliegues multi-instancia el load balancer debe sacar de rotación a una
 * réplica que no esté `ready`. No devuelve información sensible.
 */
export async function GET() {
  try {
    const result = await Promise.race([
      prisma.$queryRaw`SELECT 1 AS ok`,
      new Promise<never>((_, reject) => {
        const timer = setTimeout(() => reject(new Error("timeout")), READINESS_TIMEOUT_MS);
        (timer as unknown as { unref?: () => void }).unref?.();
      }),
    ]);
    if (Array.isArray(result) && result[0] && Number((result[0] as { ok?: number }).ok) === 1) {
      return NextResponse.json(
        { ok: true, status: "ready" },
        { status: 200, headers: { "cache-control": "no-store" } },
      );
    }
    return NextResponse.json(
      { ok: false, status: "not_ready" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, status: "not_ready" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}