import Link from "next/link";
import type { Route } from "next";
import type { CartaHeaderConfig } from "@/lib/carta-content";

/**
 * Renderer único de la cabecera de la carta virtual.
 * Lo usan la carta pública y la vista previa del editor para garantizar que el
 * resultado sea idéntico (una sola fuente de verdad).
 *
 * Solo los TEXTOS vienen de `config`; el nombre del negocio, la sucursal y la
 * cantidad del pedido son datos dinámicos que el editor no persiste.
 * @summary Renderiza el encabezado configurable de la carta pública.
 */
export function CartaHeader({
  config,
  businessName,
  branchName,
  quantity,
  onOpenCart,
  homeHref,
}: {
  config: CartaHeaderConfig;
  businessName: string;
  branchName?: string;
  quantity: number;
  onOpenCart: () => void;
  homeHref: string;
}) {
  const locationName = branchName?.trim() || "Principal";
  const businessLocationLabel = locationName
    .toLocaleLowerCase("es")
    .startsWith(businessName.toLocaleLowerCase("es"))
    ? locationName
    : `${businessName} · ${locationName}`;
  const highlight = config.highlight.trim() || businessName;

  return (
    <section className="relative overflow-hidden border-b border-white/10 py-4 md:py-24">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(236,72,153,.28),transparent_35%),radial-gradient(circle_at_85%_30%,rgba(245,197,66,.16),transparent_30%)]" />
      <div className="shell relative">
        <div className="flex min-w-0 items-center justify-between gap-3 md:hidden">
          <div className="min-w-0">
            <p className="truncate text-base font-black">{businessLocationLabel}</p>
            <p className="mt-0.5 text-xs font-bold text-zinc-400">Carta virtual</p>
          </div>
          <button
            className="min-h-11 shrink-0 rounded-full bg-pink-500 px-4 text-sm font-black text-white"
            onClick={onOpenCart}
            type="button"
          >
            {config.cartButton} ({quantity})
          </button>
        </div>
        <div className="hidden items-center justify-between gap-4 md:flex">
          <div>
            <p className="text-6xl font-black text-pink-500">
              {businessName}
              <span className="text-white">&.</span>
            </p>
            <p className="mt-2 text-xs font-black uppercase tracking-[.28em] text-zinc-400">
              Carta virtual · {locationName}
            </p>
          </div>
          <Link
            className="inline-flex rounded-full border border-white/15 px-5 py-3 text-sm font-bold hover:bg-white hover:text-black"
            href={homeHref as Route}
          >
            Volver al inicio
          </Link>
        </div>
        <div className="mt-16 hidden max-w-3xl md:block">
          <p className="section-eyebrow">{config.eyebrow}</p>
          <h1 className="mt-3 text-8xl font-black tracking-[-.06em]">
            {config.title} <span className="text-pink-500">{highlight}</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-zinc-400">{config.description}</p>
          <div className="mt-8 flex gap-3">
            <a className="btn" href="#productos">
              {config.primaryButton}
            </a>
            <button className="btn btn-secondary" onClick={onOpenCart} type="button">
              {config.cartButton} ({quantity})
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
