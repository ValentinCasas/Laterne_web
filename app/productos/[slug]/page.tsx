import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { ProductActions } from "@/components/menu/product-actions";
import { ModelExperience } from "@/components/products/model-experience";
import { prisma } from "@/lib/prisma";
import { getDefaultTenant } from "@/lib/tenant";
import { productAvailableAt } from "@/lib/product-availability";

type ProductPageProps = { params: Promise<{ slug: string }> };

/** @summary Consulta un producto público mediante un slug perteneciente al negocio activo. */
async function getProduct(slug: string) {
  const tenant = await getDefaultTenant();
  return prisma.product.findFirst({
    where: {
      tenantId: tenant.id,
      slug,
      OR: [{ status: "published" }, { status: "scheduled", publishAt: { lte: new Date() } }],
    },
    include: {
      categories: { include: { category: true }, take: 3 },
      allergens: { include: { allergen: true } },
      relatedFrom: { include: { relatedProduct: true }, take: 4 },
    },
  });
}

/** @summary Genera título, descripción e imagen social específicos para la ficha del producto. */
export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Producto no encontrado" };
  const image = `/images/images_product/${product.imageUrl}`;
  return {
    title: product.name,
    description: product.description,
    openGraph: { title: product.name, description: product.description, images: [image], type: "website" },
  };
}

/** @summary Muestra información completa, etiquetas, precio y acciones de un producto individual. */
export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const [product, tenant] = await Promise.all([getProduct(slug), getDefaultTenant()]);
  if (!product) notFound();
  const files = new Set(await readdir(path.join(process.cwd(), "public", "images", "images_product")));
  const image =
    product.imageUrl && product.imageUrl !== "product_default.png" && files.has(product.imageUrl)
      ? `/images/images_product/${product.imageUrl}`
      : "/images/image_defect/product_default.png";
  const price = Number(product.promotionalPrice ?? product.price ?? 0);
  const availableNow =
    product.availability?.toLocaleLowerCase("es") !== "agotado" &&
    productAvailableAt(
      product.availableDays,
      product.availableStartTime,
      product.availableEndTime,
      new Date(),
      tenant.timeZone,
    );
  const spatialAvailable = Boolean(product.model3dUrl);
  const labels = [
    product.featured && "Destacado",
    product.isNew && "Nuevo",
    product.recommended && "Recomendación del bar",
    product.vegetarian && "Vegetariano",
    product.vegan && "Vegano",
    product.glutenFree && "Sin gluten",
    product.alcoholFree && "Sin alcohol",
  ].filter(Boolean) as string[];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image,
    offers: {
      "@type": "Offer",
      priceCurrency: tenant.defaultCurrency,
      price,
      availability: !availableNow ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
    },
  };

  return (
    <main className="shell py-10 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="flex flex-wrap items-center gap-2 text-sm text-zinc-500" aria-label="Migas de pan">
        <Link className="hover:text-pink-300" href="/carta">
          Carta
        </Link>
        <span aria-hidden="true">/</span>
        {product.categories[0] && <span>{product.categories[0].category.name}</span>}
        <span aria-hidden="true">/</span>
        <span className="text-zinc-300">{product.name}</span>
      </nav>

      <section className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] lg:items-start">
        <div className="relative aspect-square overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-zinc-800 to-zinc-950">
          <Image
            src={image}
            alt={product.name}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 45vw"
            className="object-contain p-7 sm:p-12"
          />
        </div>
        <div className="lg:sticky lg:top-24">
          <div className="flex flex-wrap gap-2">
            {labels.map((label) => (
              <span
                className="rounded-full bg-pink-500/15 px-3 py-1.5 text-xs font-black uppercase text-pink-300"
                key={label}
              >
                {label}
              </span>
            ))}
          </div>
          <h1 className="mt-4 text-5xl font-black tracking-[-.05em] sm:text-7xl">{product.name}</h1>
          <p className="mt-5 text-lg leading-relaxed text-zinc-400">{product.description}</p>
          <div className="mt-7 flex items-end gap-3">
            <strong className="text-4xl font-black">
              {new Intl.NumberFormat(tenant.locale, {
                style: "currency",
                currency: tenant.defaultCurrency,
                maximumFractionDigits: 0,
              }).format(price)}
            </strong>
            {product.previousPrice && Number(product.previousPrice) > price && (
              <del className="pb-1 text-zinc-600">
                {new Intl.NumberFormat(tenant.locale, {
                  style: "currency",
                  currency: tenant.defaultCurrency,
                  maximumFractionDigits: 0,
                }).format(Number(product.previousPrice))}
              </del>
            )}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {(product.availableStartTime || product.availableDays) && (
              <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
                <span className="block text-xs uppercase text-zinc-500">Disponibilidad actual</span>
                <strong className={`mt-1 block ${availableNow ? "text-emerald-300" : "text-amber-300"}`}>
                  {availableNow ? "Disponible para pedir" : "Fuera del horario de venta"}
                </strong>
                {product.availableStartTime && product.availableEndTime && (
                  <small className="text-zinc-500">
                    {product.availableStartTime.toISOString().slice(11, 16)} a{" "}
                    {product.availableEndTime.toISOString().slice(11, 16)}
                  </small>
                )}
              </div>
            )}
            {product.preparationMinutes && (
              <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
                <span className="block text-xs uppercase text-zinc-500">Preparación estimada</span>
                <strong className="mt-1 block">{product.preparationMinutes} minutos</strong>
              </div>
            )}
            {product.spiceLevel > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
                <span className="block text-xs uppercase text-zinc-500">Nivel de picante</span>
                <strong className="mt-1 block">{"🌶️".repeat(product.spiceLevel)}</strong>
              </div>
            )}
          </div>
          {product.allergens.length > 0 && (
            <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
              <h2 className="font-black text-amber-200">Información de alérgenos</h2>
              <p className="mt-2 text-sm text-amber-100/70">
                Contiene o puede contener: {product.allergens.map((item) => item.allergen.name).join(", ")}.
              </p>
            </div>
          )}
          <div className="mt-8">
            <ProductActions
              product={{
                id: product.id,
                slug: product.slug,
                name: product.name,
                description: product.description,
                price,
                availability: availableNow ? "disponible" : "agotado",
                image,
              }}
            />
          </div>
          {spatialAvailable && (
            <a
              className="mt-3 inline-flex min-h-12 items-center font-black text-pink-300 hover:text-pink-200"
              href="#experiencia-3d"
            >
              {product.arEnabled ? "Ver este producto en 3D o sobre tu mesa ↓" : "Ver este producto en 3D ↓"}
            </a>
          )}
        </div>
      </section>

      {spatialAvailable && product.model3dUrl && (
        <section className="mt-16 scroll-mt-24" id="experiencia-3d">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="section-eyebrow">Experiencia espacial</p>
              <h2 className="mt-2 text-3xl font-black sm:text-5xl">
                {product.arEnabled ? "Mirá cómo queda en tu mesa" : "Exploralo desde todos los ángulos"}
              </h2>
            </div>
            {(product.modelWidthCm || product.modelHeightCm || product.modelDepthCm) && (
              <p className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-400">
                Medidas aproximadas: {product.modelWidthCm ? `${Number(product.modelWidthCm)} cm` : "—"} ×{" "}
                {product.modelHeightCm ? `${Number(product.modelHeightCm)} cm` : "—"} ×{" "}
                {product.modelDepthCm ? `${Number(product.modelDepthCm)} cm` : "—"}
              </p>
            )}
          </div>
          <ModelExperience
            productId={product.id}
            modelUrl={product.model3dUrl}
            iosUrl={product.usdzUrl}
            posterUrl={product.modelPosterUrl ?? image}
            productName={product.name}
            scale={Number(product.arScale)}
            orientation={product.modelOrientation}
            placement={product.arPlacement === "wall" ? "wall" : "floor"}
            allowScale={product.arAllowScale}
            arEnabled={product.arEnabled}
          />
          {product.arEnabled && (
            <p className="mt-4 text-sm leading-relaxed text-zinc-500">
              La realidad aumentada utiliza WebXR cuando está disponible, Scene Viewer en Android y Quick Look
              en iPhone. Requiere HTTPS y permiso de cámara. Si el dispositivo no es compatible, el producto
              permanece disponible en el visor 3D interactivo.
            </p>
          )}
        </section>
      )}

      {product.relatedFrom.length > 0 && (
        <section className="mt-20">
          <p className="section-eyebrow">También puede gustarte</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {product.relatedFrom.map(({ relatedProduct }) => (
              <Link
                className="rounded-2xl border border-white/10 p-5 hover:border-pink-500/40"
                href={`/productos/${relatedProduct.slug}`}
                key={relatedProduct.id}
              >
                <h2 className="font-black">{relatedProduct.name}</h2>
                <p className="mt-2 line-clamp-2 text-sm text-zinc-500">{relatedProduct.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
