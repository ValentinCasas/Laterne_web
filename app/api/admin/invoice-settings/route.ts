import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { defaultInvoiceDesign, resolveInvoiceDesign } from "@/lib/invoice-design";
import { prisma } from "@/lib/prisma";

/**
 * @summary Valida la entrada relacionada con la configuración de comprobantes.
 */
const blockInput = z.object({
  id: z.string().optional(),
  type: z.string().optional(),
  visible: z.boolean().optional(),
  columns: z.enum(["single", "half"]).optional(),
  text: z.string().max(600).optional(),
  fontSize: z.number().min(6).max(48).optional(),
  bold: z.boolean().optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .nullable(),
  background: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .nullable(),
  tableColumns: z
    .object({
      product: z.boolean().optional(),
      quantity: z.boolean().optional(),
      unitPrice: z.boolean().optional(),
      total: z.boolean().optional(),
      variant: z.boolean().optional(),
      extras: z.boolean().optional(),
    })
    .optional(),
  tableStyle: z.enum(["compact", "normal", "wide"]).optional(),
});

/**
 * @summary Valida la entrada relacionada con la configuración de comprobantes.
 */
const settingsInput = z.object({
  issuerName: z.string().trim().max(180).optional().nullable(),
  taxId: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  terms: z.string().trim().max(3000).optional().nullable(),
  templatePreset: z.enum(["compact", "classic", "modern"]).optional(),
  design: z
    .object({
      preset: z.enum(["compact", "classic", "modern"]).optional(),
      accent: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .optional(),
      font: z.enum(["sans", "serif", "mono"]).optional(),
      footerText: z.string().trim().max(600).optional(),
      blocks: z.array(blockInput).max(40).optional(),
    })
    .optional(),
});

/** @summary Devuelve la configuración de emisor y el diseño del comprobante. */
export async function GET() {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const settings = await prisma.invoiceSettings.findUnique({ where: { tenantId: auth.tenant.id } });
  return NextResponse.json({ settings: serialize(settings) });
}

/** @summary Guarda datos del emisor y el diseño (preset, color, tipografía y elementos visibles). */
export async function PATCH(request: Request) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = settingsInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Configuración inválida" }, { status: 400 });
  const { templatePreset, design, ...issuer } = parsed.data;
  const designToSave = design !== undefined ? resolveInvoiceDesign(design) : undefined;
  const current = await prisma.invoiceSettings.findUnique({ where: { tenantId: auth.tenant.id } });
  const settings = await prisma.invoiceSettings.upsert({
    where: { tenantId: auth.tenant.id },
    create: {
      tenantId: auth.tenant.id,
      ...issuer,
      templatePreset: designToSave?.preset ?? templatePreset ?? defaultInvoiceDesign.preset,
      design: (designToSave as unknown as object) ?? undefined,
    },
    update: {
      ...issuer,
      templatePreset: designToSave?.preset ?? templatePreset ?? current?.templatePreset,
      design: (designToSave as unknown as object) ?? undefined,
    },
  });
  await recordAudit({
    context: auth,
    action: "update",
    entityType: "invoice-settings",
    entityId: settings.id,
    oldValues: current ? toAuditValue(serialize(current)) : undefined,
    newValues: toAuditValue(serialize(settings)),
    request,
  });
  return NextResponse.json({ settings: serialize(settings) });
}
