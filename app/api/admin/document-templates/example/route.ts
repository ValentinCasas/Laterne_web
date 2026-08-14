import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { buildExampleDocumentTemplate } from "@/lib/documents/example-templates";
import { DOCX_MIME } from "@/lib/documents/template-engine";

export async function GET(request: Request) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const variant = new URL(request.url).searchParams.get("variant") === "modern" ? "modern" : "classic";
  const bytes = await buildExampleDocumentTemplate(variant);
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Response(body, {
    headers: {
      "content-type": DOCX_MIME,
      "content-disposition": `attachment; filename="comprobante-${variant === "modern" ? "moderno" : "clasico"}.docx"`,
      "cache-control": "private, no-store",
    },
  });
}
