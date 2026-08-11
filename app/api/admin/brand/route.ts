import { unlink } from "node:fs/promises";
import path from "node:path";
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
  primaryColor: color.optional(),
  secondaryColor: color.optional(),
  backgroundColor: color.optional(),
  fontFamily: z.enum(["Inter", "system-ui", "Georgia", "Arial"]),
  buttonStyle: z.enum(["rounded", "pill", "square"]),
  cardStyle: z.enum(["soft", "bordered", "flat"]),
  adminTheme: z.enum(["menuclick-dark", "grafito", "medianoche", "alto-contraste"]).optional(),
  adminAccent: color.optional(),
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
       primaryColor: parsed.data.primaryColor ?? current?.primaryColor ?? "#ec4899",
       secondaryColor: parsed.data.secondaryColor ?? current?.secondaryColor ?? "#f5c542",
       backgroundColor: parsed.data.backgroundColor ?? current?.backgroundColor ?? "#09090b",
      fontFamily: parsed.data.fontFamily,
      buttonStyle: parsed.data.buttonStyle,
      cardStyle: parsed.data.cardStyle,
       adminTheme: parsed.data.adminTheme ?? current?.adminTheme ?? "menuclick-dark",
       adminAccent: parsed.data.adminAccent ?? current?.adminAccent ?? "#ec4899",
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

const brandFields = ["logoUrl", "isotypeUrl", "faviconUrl"] as const;

/** @summary Elimina la asociación del recurso de marca y, si es una imagen administrada, remueve el archivo físico. */
export async function DELETE(request: Request) {
  const auth = await authorize("brand.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = z
    .object({ field: z.enum(brandFields), assetUrl: z.string().min(1) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const { field, assetUrl } = parsed.data;
  const brand = await prisma.brandSettings.findUnique({ where: { tenantId: auth.tenant.id } });
  if (!brand) return NextResponse.json({ error: "No hay marca configurada" }, { status: 404 });
  const current = brand[field];
  if (!current || current !== assetUrl) {
    return NextResponse.json({ brand: serialize(brand), removed: false });
  }

  if (current.startsWith("/images/images_brand/")) {
    const assets = await prisma.mediaAsset.findMany({
      where: { tenantId: auth.tenant.id, url: current },
      select: { id: true, thumbnailUrl: true },
    });
    const publicRoot = path.resolve(process.cwd(), "public");
    for (const asset of assets) {
      const target = path.resolve(publicRoot, `.${current}`);
      if (target.toLocaleLowerCase("en").startsWith(`${publicRoot.toLocaleLowerCase("en")}${path.sep}`)) {
        await unlink(target).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== "ENOENT") throw error;
        });
      }
      if (asset.thumbnailUrl) {
        const thumbnailTarget = path.resolve(publicRoot, `.${asset.thumbnailUrl}`);
        if (
          thumbnailTarget
            .toLocaleLowerCase("en")
            .startsWith(`${publicRoot.toLocaleLowerCase("en")}${path.sep}`)
        ) {
          await unlink(thumbnailTarget).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== "ENOENT") throw error;
          });
        }
      }
      await prisma.mediaAsset.delete({ where: { id: asset.id } });
    }
  }

  const updated = await prisma.brandSettings.update({
    where: { tenantId: auth.tenant.id },
    data: { [field]: null },
  });
  await recordAudit({
    context: auth,
    action: "update",
    entityType: "brand-settings",
    entityId: updated.id,
    oldValues: toAuditValue(serialize(brand)),
    newValues: toAuditValue(serialize(updated)),
    request,
  });
  return NextResponse.json({ brand: serialize(updated), removed: true });
}
