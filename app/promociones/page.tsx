import Image from "next/image";
import Link from "next/link";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { isPromotionActive, promotionBenefit, promotionTypeLabel } from "@/lib/promotion";
import { getDefaultTenant } from "@/lib/tenant";
import { managedPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** @summary Recupera la configuración SEO administrable de promociones. */
export function generateMetadata() {
  return managedPageMetadata(
    "/promociones",
    "Promociones",
    "Beneficios, happy hours, combos y promociones vigentes.",
  );
}

/** @summary Publica únicamente promociones vigentes con sus productos, categorías y condiciones. */
export default async function PromotionsPage() {
  const tenant = await getDefaultTenant();
  const now = new Date();
  const [records, imageFiles] = await Promise.all([
    prisma.promotion.findMany({
      where: { tenantId: tenant.id, status: { in: ["published", "scheduled"] } },
      include: {
        products: { include: { product: { select: { id: true, name: true, slug: true } } } },
        categories: { include: { category: { select: { id: true, name: true } } } },
      },
      orderBy: [{ priority: "desc" }, { startAt: "desc" }],
    }),
    readdir(path.join(process.cwd(), "public", "images", "images_promotions")).catch(() => []),
  ]);
  const availableImages = new Set(imageFiles);
  const promotions = records.filter(
    (promotion) =>
      (promotion.status === "published" ||
        (promotion.status === "scheduled" && promotion.publishAt && promotion.publishAt <= now)) &&
      isPromotionActive(promotion, now),
  );

  return (
    <main>
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,.28),transparent_35%),#09090b] py-16 sm:py-24">
        <div className="shell">
          <p className="section-eyebrow">Beneficios vigentes</p>
          <h1 className="mt-3 max-w-4xl text-5xl font-black tracking-[-.06em] sm:text-8xl">
            Siempre hay una buena excusa para volver.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
            Consultá combos, happy hours y descuentos actualizados directamente por el bar.
          </p>
        </div>
      </section>

      <section className="shell py-12 sm:py-20">
        {promotions.length ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {promotions.map((promotion) => {
              const hasImage = promotion.imageUrl && availableImages.has(promotion.imageUrl);
              return (
                <article
                  className="overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950 shadow-2xl shadow-black/25"
                  key={promotion.id}
                >
                  <div className="relative h-64 bg-gradient-to-br from-pink-950/60 to-zinc-950">
                    {hasImage ? (
                      <Image
                        src={`/images/images_promotions/${promotion.imageUrl}`}
                        alt={promotion.name}
                        fill
                        sizes="(max-width: 1024px) 100vw, 50vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-7xl font-black text-pink-500/30">
                        {promotionBenefit(
                          promotion.type,
                          promotion.discountValue ? Number(promotion.discountValue) : null,
                          promotion.buyQuantity,
                          promotion.receiveQuantity,
                        )}
                      </div>
                    )}
                    <span className="absolute left-5 top-5 rounded-full bg-black/75 px-3 py-1.5 text-xs font-black uppercase text-pink-300 backdrop-blur">
                      {promotionTypeLabel(promotion.type)}
                    </span>
                  </div>
                  <div className="p-6 sm:p-8">
                    <p className="text-3xl font-black text-pink-300">
                      {promotionBenefit(
                        promotion.type,
                        promotion.discountValue ? Number(promotion.discountValue) : null,
                        promotion.buyQuantity,
                        promotion.receiveQuantity,
                      )}
                    </p>
                    <h2 className="mt-2 text-3xl font-black">{promotion.name}</h2>
                    <p className="mt-3 leading-relaxed text-zinc-400">{promotion.description}</p>
                    {promotion.code && (
                      <p className="mt-5 rounded-xl border border-dashed border-pink-500/30 bg-pink-500/5 p-3 text-sm">
                        Código: <strong className="tracking-widest text-pink-300">{promotion.code}</strong>
                      </p>
                    )}
                    {(promotion.products.length > 0 || promotion.categories.length > 0) && (
                      <div className="mt-5 flex flex-wrap gap-2">
                        {promotion.products.slice(0, 5).map(({ product }) => (
                          <Link
                            className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-bold hover:bg-pink-500"
                            href={`/productos/${product.slug}`}
                            key={product.id}
                          >
                            {product.name}
                          </Link>
                        ))}
                        {promotion.categories.map(({ category }) => (
                          <span
                            className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-zinc-400"
                            key={category.id}
                          >
                            {category.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {promotion.conditions && (
                      <details className="mt-5 rounded-xl bg-white/[.03] p-3 text-sm text-zinc-500">
                        <summary className="cursor-pointer font-bold text-zinc-300">Ver condiciones</summary>
                        <p className="mt-2 whitespace-pre-wrap leading-relaxed">{promotion.conditions}</p>
                      </details>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[2rem] border border-dashed border-white/15 p-12 text-center">
            <h2 className="text-3xl font-black">No hay promociones vigentes ahora</h2>
            <p className="mt-3 text-zinc-500">
              La carta completa sigue disponible y se actualiza en tiempo real.
            </p>
            <Link className="btn mt-6" href="/carta">
              Ver la carta
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
