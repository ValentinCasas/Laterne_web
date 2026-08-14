import { unlink } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const brandInput = z.object({
  logoUrl: z.string().trim().max(500).optional(),
  isotypeUrl: z.string().trim().max(500).optional(),
  faviconUrl: z.string().trim().max(500).optional(),
  heroImageUrl: z.string().trim().max(500).nullable().optional(),
  primaryColor: color.optional(),
  secondaryColor: color.optional(),
  backgroundColor: color.optional(),
  fontFamily: z.enum(["Inter", "system-ui", "Georgia", "Arial"]).optional(),
  buttonStyle: z.enum(["rounded", "pill", "square"]).optional(),
  cardStyle: z.enum(["soft", "bordered", "flat"]).optional(),
  adminTheme: z.enum(["menuclick-dark", "grafito", "medianoche", "alto-contraste"]).optional(),
  adminAccent: color.optional(),
  heroTitle: z.string().trim().max(220).optional(),
  heroSubtitle: z.string().trim().max(500).optional(),
  landingSections: z
    .object({
      beerImages: z.array(z.string().trim().min(1).max(500)).max(40).default([]),
      stories: z
        .array(
          z.object({
            title: z.string().trim().max(120),
            subtitle: z.string().trim().max(300),
            image: z.string().trim().min(1).max(500),
          }),
        )
        .max(40)
        .default([]),
    })
    .optional(),
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
  defaultCurrency: z.enum(["ARS", "USD", "UYU", "BRL", "CLP", "EUR"]).optional(),
  locale: z.enum(["es-AR", "es-UY", "es-CL", "en-US", "pt-BR"]).optional(),
  timeZone: z.enum([
    "America/Argentina/Buenos_Aires",
    "America/Montevideo",
    "America/Santiago",
    "America/Sao_Paulo",
    "America/New_York",
    "Europe/Madrid",
  ]).optional(),
});

/** @summary Valida una imagen de marca para impedir referencias a esquemas inseguros. */
function brandAsset(value: string | null | undefined) {
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
    const [current, currentTenant] = await Promise.all([
      prisma.brandSettings.findUnique({ where: { tenantId: auth.tenant.id } }),
      prisma.tenant.findUnique({ where: { id: auth.tenant.id } }),
    ]);
    const p = parsed.data;
    const customDomain =
      p.customDomain === undefined ? undefined : (p.customDomain.toLocaleLowerCase("en") || null);
    if (customDomain) {
      const domainConflict = await prisma.brandSettings.findFirst({
        where: { customDomain, tenantId: { not: auth.tenant.id } },
        select: { id: true },
      });
      if (domainConflict) throw new Error("El dominio ya está asignado a otro negocio");
    }

    const data: Prisma.BrandSettingsUpdateInput = {};
    if (p.logoUrl !== undefined) data.logoUrl = brandAsset(p.logoUrl);
    if (p.isotypeUrl !== undefined) data.isotypeUrl = brandAsset(p.isotypeUrl);
    if (p.faviconUrl !== undefined) data.faviconUrl = brandAsset(p.faviconUrl);
    if (p.heroImageUrl !== undefined) data.heroImageUrl = brandAsset(p.heroImageUrl);
    if (p.primaryColor !== undefined) data.primaryColor = p.primaryColor;
    if (p.secondaryColor !== undefined) data.secondaryColor = p.secondaryColor;
    if (p.backgroundColor !== undefined) data.backgroundColor = p.backgroundColor;
    if (p.fontFamily !== undefined) data.fontFamily = p.fontFamily;
    if (p.buttonStyle !== undefined) data.buttonStyle = p.buttonStyle;
    if (p.cardStyle !== undefined) data.cardStyle = p.cardStyle;
    if (p.adminTheme !== undefined) data.adminTheme = p.adminTheme;
    if (p.adminAccent !== undefined) data.adminAccent = p.adminAccent;
    if (p.heroTitle !== undefined) data.heroTitle = p.heroTitle || null;
    if (p.heroSubtitle !== undefined) data.heroSubtitle = p.heroSubtitle || null;
    if (p.landingSections !== undefined) {
      const normalized = p.landingSections;
      normalized.beerImages = [...new Set(normalized.beerImages)];
      data.landingSections = normalized;
    }
    if (p.tone !== undefined) data.tone = p.tone || null;
    if (p.instagram !== undefined || p.facebook !== undefined) {
      data.socialLinks = {
        instagram: p.instagram || "",
        facebook: p.facebook || "",
      };
    }
    if (customDomain !== undefined) data.customDomain = customDomain;
    if (p.analyticsId !== undefined) data.analyticsId = p.analyticsId || null;
    if (p.metaPixelId !== undefined) data.metaPixelId = p.metaPixelId || null;
    if (p.searchConsoleId !== undefined) data.searchConsoleId = p.searchConsoleId || null;

    const tenantData: Prisma.TenantUpdateInput = {};
    if (p.defaultCurrency !== undefined) tenantData.defaultCurrency = p.defaultCurrency;
    if (p.locale !== undefined) tenantData.locale = p.locale;
    if (p.timeZone !== undefined) tenantData.timeZone = p.timeZone;

    const brand = await prisma.$transaction(async (transaction) => {
      const result = await transaction.brandSettings.upsert({
        where: { tenantId: auth.tenant.id },
        create: { tenantId: auth.tenant.id, ...data } as Prisma.BrandSettingsUncheckedCreateInput,
        update: data,
      });
      if (Object.keys(tenantData).length > 0) {
        await transaction.tenant.update({ where: { id: auth.tenant.id }, data: tenantData });
      }
      return result;
    });
    const responseBrand = {
      ...serialize(brand),
      defaultCurrency: p.defaultCurrency ?? currentTenant?.defaultCurrency ?? "ARS",
      locale: p.locale ?? currentTenant?.locale ?? "es-AR",
      timeZone: p.timeZone ?? currentTenant?.timeZone ?? "America/Argentina/Buenos_Aires",
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

const brandFields = ["logoUrl", "isotypeUrl", "faviconUrl", "heroImageUrl"] as const;

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
