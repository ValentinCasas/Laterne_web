import { NextResponse } from "next/server";

/**
 * @deprecated El contexto de sucursal vive en la URL canónica
 * `/t/{tenant}/admin/s/{branch}/...`. Este endpoint ya no muta la sesión.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "BRANCH_CONTEXT_IS_URL_DRIVEN",
      message: "La sucursal se cambia navegando a su URL canónica; la sesión no guarda una sucursal activa.",
    },
    { status: 410 },
  );
}
