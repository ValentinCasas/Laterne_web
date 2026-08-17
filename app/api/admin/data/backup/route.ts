import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

/**
 * @summary Valida la entrada relacionada con el recurso solicitado.
 */
const backupInput = z.object({
  version: z.literal(1),
  tenantSlug: z.string().min(1),
  data: z.object({
    categories: z.array(
      z.object({
        name: z.string(),
        slug: z.string(),
        description: z.string(),
        imageUrl: z.string(),
        status: z.string(),
        sortOrder: z.number(),
      }),
    ),
    products: z.array(
      z.object({
        name: z.string(),
        slug: z.string(),
        description: z.string(),
        availability: z.string().nullable(),
        price: z.union([z.string(), z.number()]).nullable(),
        imageUrl: z.string(),
        status: z.string(),
        featured: z.boolean(),
        isNew: z.boolean(),
        recommended: z.boolean(),
        vegetarian: z.boolean(),
        vegan: z.boolean(),
        glutenFree: z.boolean(),
        alcoholFree: z.boolean(),
        spiceLevel: z.number(),
        preparationMinutes: z.number().nullable(),
        promotionalPrice: z.union([z.string(), z.number()]).nullable(),
        previousPrice: z.union([z.string(), z.number()]).nullable(),
        publishAt: z.string().nullable(),
        model3dUrl: z.string().nullable(),
        usdzUrl: z.string().nullable(),
        modelPosterUrl: z.string().nullable(),
        arEnabled: z.boolean(),
        arScale: z.union([z.string(), z.number()]),
        modelWidthCm: z.union([z.string(), z.number()]).nullable(),
        modelHeightCm: z.union([z.string(), z.number()]).nullable(),
        modelDepthCm: z.union([z.string(), z.number()]).nullable(),
        modelOrientation: z.string(),
        arPlacement: z.string(),
        arAllowScale: z.boolean(),
        availableDays: z.array(z.union([z.string(), z.number()])).nullable(),
        availableStartTime: z.string().nullable(),
        availableEndTime: z.string().nullable(),
        modelUpdatedAt: z.string().nullable(),
        categorySlugs: z.array(z.string()),
        variants: z.array(
          z.object({
            name: z.string(),
            priceAdjustment: z.union([z.string(), z.number()]),
            active: z.boolean(),
            sortOrder: z.number(),
          }),
        ),
        extras: z.array(
          z.object({
            name: z.string(),
            price: z.union([z.string(), z.number()]),
            active: z.boolean(),
            sortOrder: z.number(),
          }),
        ),
      }),
    ),
    branches: z.array(
      z.object({
        name: z.string(),
        slug: z.string(),
        address: z.string(),
        city: z.string().nullable(),
        province: z.string().nullable(),
        phone: z.string().nullable(),
        whatsapp: z.string().nullable(),
        latitude: z.union([z.string(), z.number()]).nullable(),
        longitude: z.union([z.string(), z.number()]).nullable(),
        deliveryFee: z.union([z.string(), z.number()]),
        minimumOrder: z.union([z.string(), z.number()]),
        orderPrefix: z.string(),
        isPrimary: z.boolean(),
        active: z.boolean(),
      }),
    ),
  }),
  confirmation: z.string().optional(),
});

/** @summary Copia un registro omitiendo campos internos que no deben formar parte del formato portable. */
function withoutFields(value: Record<string, unknown>, excluded: string[]) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !excluded.includes(key)));
}

/** @summary Exporta una copia portable del contenido y la configuración operativa principal del tenant. */
export async function GET() {
  const auth = await authorize("admin.access");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const [categories, products, branches] = await Promise.all([
    prisma.category.findMany({ where: { tenantId: auth.tenant.id }, orderBy: { id: "asc" } }),
    prisma.product.findMany({
      where: { tenantId: auth.tenant.id },
      include: {
        categories: { include: { category: { select: { slug: true } } } },
        variants: true,
        extras: true,
      },
      orderBy: { id: "asc" },
    }),
    prisma.branch.findMany({ where: { tenantId: auth.tenant.id }, orderBy: { id: "asc" } }),
  ]);
  const backup = serialize({
    version: 1,
    exportedAt: new Date(),
    tenantSlug: auth.tenant.slug,
    data: {
      categories: categories.map((category) =>
        withoutFields(category, ["id", "tenantId", "createdAt", "updatedAt", "publishAt"]),
      ),
      products: products.map((product) => ({
        ...withoutFields(product, [
          "id",
          "tenantId",
          "createdAt",
          "updatedAt",
          "categories",
          "variants",
          "extras",
        ]),
        categorySlugs: product.categories.map((relation) => relation.category.slug),
        variants: product.variants.map((variant) =>
          withoutFields(variant, ["id", "tenantId", "productId", "createdAt", "updatedAt"]),
        ),
        extras: product.extras.map((extra) =>
          withoutFields(extra, ["id", "tenantId", "productId", "createdAt", "updatedAt"]),
        ),
      })),
      branches: branches.map((branch) => withoutFields(branch, ["id", "tenantId", "createdAt", "updatedAt"])),
    },
  });
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="laterne-${auth.tenant.slug}-backup.json"`,
      "Cache-Control": "no-store",
    },
  });
}

/** @summary Restaura mediante fusión categorías, productos, opciones y sucursales después de una confirmación explícita. */
export async function POST(request: Request) {
  const auth = await authorize("admin.access");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = backupInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "El archivo no es una copia compatible" }, { status: 400 });
  if (parsed.data.confirmation !== `RESTAURAR ${auth.tenant.slug}`) {
    return NextResponse.json(
      { error: `Escribí RESTAURAR ${auth.tenant.slug} para confirmar` },
      { status: 400 },
    );
  }
  if (parsed.data.tenantSlug !== auth.tenant.slug) {
    return NextResponse.json({ error: "La copia pertenece a otro negocio" }, { status: 409 });
  }
  const counts = await prisma.$transaction(async (transaction) => {
    const categoryIds = new Map<string, number>();
    for (const category of parsed.data.data.categories) {
      const slug = slugify(category.slug || category.name) || "categoria";
      const saved = await transaction.category.upsert({
        where: { tenantId_slug: { tenantId: auth.tenant.id, slug } },
        create: { tenantId: auth.tenant.id, ...category, slug },
        update: { ...category, slug },
      });
      categoryIds.set(slug, saved.id);
    }
    for (const product of parsed.data.data.products) {
      const { categorySlugs, variants, extras, ...values } = product;
      const slug = slugify(values.slug || values.name) || "producto";
      const restoredValues = {
        ...values,
        availableDays: values.availableDays ?? Prisma.DbNull,
        publishAt: values.publishAt ? new Date(values.publishAt) : null,
        availableStartTime: values.availableStartTime ? new Date(values.availableStartTime) : null,
        availableEndTime: values.availableEndTime ? new Date(values.availableEndTime) : null,
        modelUpdatedAt: values.modelUpdatedAt ? new Date(values.modelUpdatedAt) : null,
      };
      const saved = await transaction.product.upsert({
        where: { tenantId_slug: { tenantId: auth.tenant.id, slug } },
        create: { tenantId: auth.tenant.id, ...restoredValues, slug },
        update: { ...restoredValues, slug },
      });
      await transaction.productCategory.deleteMany({
        where: { tenantId: auth.tenant.id, productId: saved.id },
      });
      const relations = categorySlugs
        .map((categorySlug) => categoryIds.get(slugify(categorySlug)))
        .filter((id): id is number => Boolean(id));
      if (relations.length)
        await transaction.productCategory.createMany({
          data: relations.map((categoryId) => ({
            tenantId: auth.tenant.id,
            productId: saved.id,
            categoryId,
          })),
          skipDuplicates: true,
        });
      await transaction.productVariant.deleteMany({
        where: { tenantId: auth.tenant.id, productId: saved.id },
      });
      if (variants.length)
        await transaction.productVariant.createMany({
          data: variants.map((variant) => ({ tenantId: auth.tenant.id, productId: saved.id, ...variant })),
        });
      await transaction.productExtra.deleteMany({ where: { tenantId: auth.tenant.id, productId: saved.id } });
      if (extras.length)
        await transaction.productExtra.createMany({
          data: extras.map((extra) => ({ tenantId: auth.tenant.id, productId: saved.id, ...extra })),
        });
    }
    for (const branch of parsed.data.data.branches) {
      const slug = slugify(branch.slug || branch.name) || "sucursal";
      await transaction.branch.upsert({
        where: { tenantId_slug: { tenantId: auth.tenant.id, slug } } as never,
        create: { tenantId: auth.tenant.id, ...branch, slug, isPrimary: false },
        update: { ...branch, slug, isPrimary: branch.isPrimary },
      });
    }
    return {
      categories: parsed.data.data.categories.length,
      products: parsed.data.data.products.length,
      branches: parsed.data.data.branches.length,
    };
  });
  await recordAudit({
    context: auth,
    action: "backup.restore",
    entityType: "backup",
    newValues: counts,
    request,
  });
  return NextResponse.json({ ok: true, counts });
}
