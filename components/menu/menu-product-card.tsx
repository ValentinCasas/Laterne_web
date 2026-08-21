"use client";

import Image from "next/image";
import type { MenuProduct } from "@/components/menu/menu-client";
import { handleImageError, PRODUCT_IMAGE_FALLBACK } from "@/lib/image-fallback";

export const productFallback = PRODUCT_IMAGE_FALLBACK;

/** @summary Convierte un precio al formato monetario configurado por el negocio. */
export function formatMenuPrice(value: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(
    value,
  );
}

/**
 * @summary Card de producto de la carta. Toda la card es clickeable → abre modal de detalle.
 * La usan la carta pública y la vista previa del editor.
 */
export function MenuProductCard({
  product,
  currency,
  locale,
  onAdd,
  onPreview,
}: {
  product: MenuProduct;
  currency: string;
  locale: string;
  detailHref: string;
  onAdd: (product: MenuProduct) => void;
  onPreview: (product: MenuProduct) => void;
}) {
  const soldOut = product.availability?.toLowerCase() === "agotado";
  const priceText = (value: number) => formatMenuPrice(value, currency, locale);
  return (
    <article
      className="group grid min-h-52 min-w-0 cursor-pointer grid-cols-[minmax(6.75rem,36%)_minmax(0,1fr)] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-xl shadow-black/20 transition-all duration-200 hover:border-white/20 hover:shadow-2xl hover:shadow-black/30 sm:flex sm:min-h-[410px] sm:flex-col sm:rounded-[1.75rem]"
      onClick={() => onPreview(product)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPreview(product); } }}
      aria-label={`Ver ${product.name}`}
    >
      <div className="relative min-h-52 overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-950 p-2 sm:h-56 sm:min-h-0 sm:p-5">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 116px, 320px"
          className="pointer-events-none object-contain transition duration-500 group-hover:scale-105"
          onError={handleImageError}
        />
        {soldOut ? (
          <span className="absolute left-2 top-2 rounded-full bg-red-500 px-2 py-1 text-[10px] font-black uppercase sm:left-4 sm:top-4 sm:px-3 sm:text-xs">
            Agotado
          </span>
        ) : (
          <button
            className="absolute bottom-4 right-4 z-10 hidden h-11 w-11 place-items-center rounded-full bg-pink-500 text-2xl font-bold shadow-lg transition hover:scale-110 sm:grid"
            onClick={(e) => { e.stopPropagation(); onAdd(product); }}
            aria-label={`Agregar ${product.name}`}
          >
            +
          </button>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-5">
        {(product.featured || product.isNew || product.recommended || product.arEnabled) && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {product.featured && (
              <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-black uppercase text-amber-300">
                Destacado
              </span>
            )}
            {product.isNew && (
              <span className="rounded-full bg-sky-500/15 px-2 py-1 text-[10px] font-black uppercase text-sky-300">
                Nuevo
              </span>
            )}
            {product.recommended && (
              <span className="rounded-full bg-pink-500/15 px-2 py-1 text-[10px] font-black uppercase text-pink-300">
                Recomendado
              </span>
            )}
            {product.arEnabled && (
              <span className="rounded-full bg-violet-500/15 px-2 py-1 text-[10px] font-black uppercase text-violet-300">
                3D · AR
              </span>
            )}
          </div>
        )}
        <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:justify-between sm:gap-3">
          <h3 className="min-w-0 flex-1 break-words text-base font-black leading-tight sm:text-base">
            {product.name}
          </h3>
          <span className="shrink-0 text-right">
            {product.previousPrice && product.previousPrice > product.price && (
              <del className="block text-[10px] text-zinc-600">{priceText(product.previousPrice)}</del>
            )}
            <strong className="block rounded-full bg-pink-500/15 px-2.5 py-1 text-xs text-pink-300 sm:px-3 sm:text-sm">
              {priceText(product.price)}
            </strong>
          </span>
        </div>
        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-zinc-500 sm:mt-3 sm:text-sm">
          {product.description || "Sin descripción disponible."}
        </p>
        <div className="mt-auto pt-3 sm:pt-5">
          <p className="mb-2 block min-h-10 rounded-lg py-2 text-center text-sm font-bold text-zinc-400 transition group-hover:bg-white/5 group-hover:text-pink-300 sm:text-sm">
            Ver detalle
          </p>
          {soldOut ? (
            <span className="text-xs font-bold text-red-300 sm:text-sm">No disponible</span>
          ) : (
            <button
              className="min-h-12 w-full rounded-lg border border-white/15 px-2 py-3 text-base font-black transition hover:border-pink-500 hover:bg-pink-500 sm:rounded-xl sm:py-3"
              onClick={(e) => { e.stopPropagation(); onAdd(product); }}
              aria-label={`Agregar ${product.name}`}
            >
              Agregar
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
