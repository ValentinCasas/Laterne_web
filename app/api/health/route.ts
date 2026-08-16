import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Health: proceso Node vivo.
 *
 * No toca la base de datos ni servicios externos: responde 200 mientras el
 * proceso pueda atender peticiones. El orquestador lo usa para reiniciar un
 * container colgado o sin proceso. No expone información sensible.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "menuclick",
      status: "ok",
      uptime: Math.floor(process.uptime()),
    },
    {
      status: 200,
      headers: { "cache-control": "no-store" },
    },
  );
}