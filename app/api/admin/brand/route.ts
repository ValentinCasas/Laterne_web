import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const brandInput = z.object({
  logoUrl: z.string().trim().max(500).optional(),
  isotypeUrl: z.string().trim().max(500).optional(),
  faviconUrl: z.string().trim().max(500).optional(),
  primaryColor: color,
  secondaryColor: color,
  backgroundColor: color,
  fontFamily: z.enum(["Inter", "system-ui", "Georgia", "Arial"]),
  buttonStyle: z.enum(["rounded", "pill", "square"]),
  cardStyle: z.enum(["soft", "bordered", "flat"]),
  heroTitle: z.string().trim().max(220).optional(),
  heroSubtitle: z.string().trim().max(500).optional(),
  tone: z.string().trim().max(120).optional(),
  instagram: z.string().trim().url().max(500).optional().or(z.literal("")),
  facebook: z.string().trim().url().max(500).optional().or(z.literal("")),
  customDomain: z
    .string()
    .trim()
    .max(255)
    .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i)
    .optional()
    .or(z.literal("")),
  analyticsId: z.string().trim().max(100).optional(),
  metaPixelId: z.string().trim().max(100).optional(),
  searchConsoleId: z.string().trim().max(255).optional(),
  defaultCurrency: z.enum(["ARS", "USD", "UYU", "BRL", "CLP", "EUR"]),
  locale: z.enum(["es-AR", "es-UY", "es-CL", "en-US", "pt-BR"]),
  timeZone: z.enum([
    "America/Argentina/Buenos_Aires",
    "America/Montevideo",
    "America/Santiago",
    "America/Sao_Paulo",
    "America/New_York",
    "Europe/Madrid",
  ]),
});

/** @summary Valida una imagen de marca para impedir referencias a esquemas inseguros. */
function brandAsset(value: string | undefined) {
  if (!value) return null;
  if (value.startsWith("/images/images_brand/")) return value;
  throw new Error("La imagen debe cargarse desde el gestor de marca");
}

/** @summary Guarda la identidad visual centralizada y audita todos sus cambios. */
export async function PATCH(request: Request) {
  const auth = await authorize("brand.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = brandInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Revisá colores, URLs y textos de marca" }, { status: 400 });
  try {
    const current = await prisma.brandSettings.findUnique({ where: { tenantId: auth.tenant.id } });
    const customDomain = parsed.data.customDomain?.toLocaleLowerCase("en") || null;
    const domainConflict = customDomain
      ? await prisma.brandSettings.findFirst({
          where: { customDomain, tenantId: { not: auth.tenant.id } },
          select: { id: true },
        })
      : null;
    if (domainConflict) throw new Error("El dominio ya está asignado a otro negocio");
    const data = {
      logoUrl: brandAsset(parsed.data.logoUrl),
      isotypeUrl: brandAsset(parsed.data.isotypeUrl),
      faviconUrl: brandAsset(parsed.data.faviconUrl),
      primaryColor: parsed.data.primaryColor,
      secondaryColor: parsed.data.secondaryColor,
      backgroundColor: parsed.data.backgroundColor,
      fontFamily: parsed.data.fontFamily,
      buttonStyle: parsed.data.buttonStyle,
      cardStyle: parsed.data.cardStyle,
      heroTitle: parsed.data.heroTitle || null,
      heroSubtitle: parsed.data.heroSubtitle || null,
      tone: parsed.data.tone || null,
      socialLinks: { instagram: parsed.data.instagram || "", facebook: parsed.data.facebook || "" },
      customDomain,
      analyticsId: parsed.data.analyticsId || null,
      metaPixelId: parsed.data.metaPixelId || null,
      searchConsoleId: parsed.data.searchConsoleId || null,
    };
    const [brand] = await prisma.$transaction([
      prisma.brandSettings.upsert({
        where: { tenantId: auth.tenant.id },
        create: { tenantId: auth.tenant.id, ...data },
        update: data,
      }),
      prisma.tenant.update({
        where: { id: auth.tenant.id },
        data: {
          defaultCurrency: parsed.data.defaultCurrency,
          locale: parsed.data.locale,
          timeZone: parsed.data.timeZone,
        },
      }),
    ]);
    const responseBrand = {
      ...serialize(brand),
      defaultCurrency: parsed.data.defaultCurrency,
      locale: parsed.data.locale,
      timeZone: parsed.data.timeZone,
    };
    await recordAudit({
      context: auth,
      action: "update",
      entityType: "brand-settings",
      entityId: brand.id,
      oldValues: current ? toAuditValue(serialize(current)) : undefined,
      newValues: toAuditValue(serialize(brand)),
      request,
    });
    return NextResponse.json({ brand: responseBrand });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar la marca" },
      { status: 400 },
    );
  }
}
