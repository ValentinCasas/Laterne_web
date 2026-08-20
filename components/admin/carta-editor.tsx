"use client";

import Image from "next/image";
import { useState } from "react";
import type { CSSProperties } from "react";
import { PageHeader, FormSection } from "@/components/admin/ui";
import { ResponsivePreview } from "@/components/admin/responsive-preview";
import { CartaHeader } from "@/components/menu/carta-header";
import { MenuProductCard } from "@/components/menu/menu-product-card";
import type { MenuCategory } from "@/components/menu/menu-client";
import { SiteHeader } from "@/components/site-header";
import type { CartaHeaderConfig } from "@/lib/carta-content";
import { Icon } from "@/components/admin/ui/icons";
import { CARTA_HEADER_DEFAULTS } from "@/lib/carta-content";
import { scopedFetch } from "@/lib/client-routing";
import { CATEGORY_IMAGE_FALLBACK, handleImageError } from "@/lib/image-fallback";
import { paletteCssVariables, paletteFromLegacy } from "@/lib/theme-palettes";

export type CartaEditorData = {
  initialConfig: CartaHeaderConfig;
  businessName: string;
  branchName: string;
  tenantSlug: string;
  branchSlug: string;
  currency: string;
  locale: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  fontFamily: string;
  previewCategories: MenuCategory[];
};

type SaveStatus =
  { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

/** @summary Editor de los textos de la cabecera de la carta virtual con una vista previa real en vivo. */
export function CartaEditor({ data }: { data: CartaEditorData }) {
  const [config, setConfig] = useState<CartaHeaderConfig>({
    ...CARTA_HEADER_DEFAULTS,
    ...data.initialConfig,
  });
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });

  const previewPalette = paletteFromLegacy(data.primaryColor, data.secondaryColor, data.backgroundColor);
  const previewBodyStyle: CSSProperties = {
    ...paletteCssVariables(previewPalette),
    backgroundColor: data.backgroundColor,
    fontFamily: data.fontFamily,
    colorScheme: "dark",
  };

  /**
   * @summary Actualiza el estado del editor de carta y conserva su consistencia.
   */
  function update(field: keyof CartaHeaderConfig) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setConfig((current) => ({ ...current, [field]: event.target.value }));
  }

  /**
   * @summary Actualiza el estado del editor de carta y conserva su consistencia.
   */
  async function save() {
    if (status.kind === "saving") return;
    setStatus({ kind: "saving" });
    try {
      const response = await scopedFetch("/api/admin/brand", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          landingSections: {
            carta: {
              eyebrow: config.eyebrow.trim(),
              title: config.title.trim(),
              highlight: config.highlight.trim(),
              description: config.description.trim(),
              primaryButton: config.primaryButton.trim(),
              cartButton: config.cartButton.trim(),
            },
          },
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudo guardar la carta");
      setStatus({ kind: "saved" });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "No se pudo guardar." });
    }
  }

  return (
    <section>
      <PageHeader
        eyebrow="Página pública"
        title="Editor de carta"
        description="Configurá los textos de la cabecera de la carta virtual. El fondo, los colores y el diseño dependen de tu marca."
        section="carta"
        actions={
          <button
            className="btn"
            disabled={status.kind === "saving"}
            onClick={() => void save()}
            type="button"
          >
            {status.kind === "saving" ? "Guardando…" : "Guardar carta"}
          </button>
        }
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(360px,420px)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <FormSection title="Textos de la cabecera" className="xl:col-span-1">
            <label>
              <span className="label">Texto de arriba (eyebrow)</span>
              <input
                className="input"
                value={config.eyebrow}
                maxLength={120}
                onChange={update("eyebrow")}
                placeholder={CARTA_HEADER_DEFAULTS.eyebrow}
              />
            </label>
            <label>
              <span className="label">Título principal</span>
              <input
                className="input"
                value={config.title}
                maxLength={120}
                onChange={update("title")}
                placeholder={CARTA_HEADER_DEFAULTS.title}
              />
            </label>
            <label>
              <span className="label">Palabra destacada</span>
              <input
                className="input"
                value={config.highlight}
                maxLength={120}
                onChange={update("highlight")}
                placeholder={data.businessName}
              />
              <p className="mt-1 text-xs text-zinc-500">
                Si la dejás vacía se usa el nombre del negocio ({data.businessName}).
              </p>
            </label>
            <label>
              <span className="label">Descripción</span>
              <textarea
                className="input min-h-24"
                value={config.description}
                maxLength={500}
                onChange={update("description")}
                placeholder={CARTA_HEADER_DEFAULTS.description}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="label">Botón principal</span>
                <input
                  className="input"
                  value={config.primaryButton}
                  maxLength={60}
                  onChange={update("primaryButton")}
                  placeholder={CARTA_HEADER_DEFAULTS.primaryButton}
                />
              </label>
              <label>
                <span className="label">Botón del pedido</span>
                <input
                  className="input"
                  value={config.cartButton}
                  maxLength={60}
                  onChange={update("cartButton")}
                  placeholder={CARTA_HEADER_DEFAULTS.cartButton}
                />
              </label>
            </div>
          </FormSection>

          <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4 text-xs leading-relaxed text-zinc-400">
            <p className="font-black uppercase tracking-widest text-pink-300">Datos dinámicos</p>
            <p className="mt-2">
              Estos valores se completan solos y no se guardan acá: nombre del negocio (
              <strong className="text-white">{data.businessName}</strong>), sucursal (
              <strong className="text-white">{data.branchName || "Principal"}</strong>) y cantidad del pedido.
            </p>
          </div>

          {status.kind === "saved" && (
            <p
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"
              role="status"
            >
              Guardado ✓ Los cambios ya se ven en la carta pública.
            </p>
          )}
          {status.kind === "error" && (
            <p
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
              role="alert"
            >
              {status.message}
            </p>
          )}
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-black">Vista previa</h2>
            <p className="text-xs text-zinc-500">
              La cabecera usa el mismo renderizador y las mismas tarjetas que la carta pública.
            </p>
          </div>
            <div className="h-[min(680px,calc(100dvh-14rem))] overflow-hidden rounded-2xl border border-white/10">
            <ResponsivePreview bodyClass="tenant-theme" bodyStyle={previewBodyStyle}>
              <div className="flex min-h-full flex-col bg-[var(--brand-background)]">
                <SiteHeader
                  brandName={data.businessName}
                  logoUrl={data.logoUrl}
                  tenantSlug={data.tenantSlug}
                  branchSlug={data.branchSlug}
                />
                <CartaHeader
                  config={config}
                  businessName={data.businessName}
                  branchName={data.branchName}
                  quantity={0}
                  onOpenCart={() => undefined}
                  homeHref="#"
                />
                <section className="border-b border-white/10 bg-black/95 py-3">
                  <div className="shell">
                    <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] md:gap-3">
                      {data.previewCategories.map((category) => (
                        <a
                          className="flex min-h-12 shrink-0 snap-start items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-zinc-200"
                          href={`#category-${category.id}`}
                          key={category.id}
                        >
                          <Image
                            src={`/images/images_categories/${category.image}`}
                            alt=""
                            width={28}
                            height={28}
                            draggable={false}
                            className="pointer-events-none h-7 w-7 object-contain"
                            data-fallback-src={CATEGORY_IMAGE_FALLBACK}
                            onError={handleImageError}
                          />
                          {category.name}
                        </a>
                      ))}
                    </div>
                    <div className="mt-2 flex items-stretch gap-2 md:mt-3">
                      <input
                        className="input min-h-12 w-full py-2.5 text-base"
                        placeholder="Buscar en la carta…"
                        type="search"
                        readOnly
                        aria-label="Buscador de la carta (vista previa)"
                      />
                      <button
                        className="flex min-h-12 shrink-0 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-black lg:hidden"
                        type="button"
                      >
                        <Icon name="gear" className="h-4 w-4" /> Filtros
                      </button>
                    </div>
                  </div>
                </section>
                <div id="productos" className="shell space-y-8 py-4 md:py-10">
                  {data.previewCategories.length ? (
                    data.previewCategories.map((category) => (
                      <section className="scroll-mt-24" id={`category-${category.id}`} key={category.id}>
                        <header className="mb-3 flex items-center justify-between gap-2 border-b border-white/10 px-1 py-2">
                          <div className="min-w-0">
                            <h2 className="break-words text-lg font-black uppercase tracking-wide">
                              {category.name}
                            </h2>
                            {category.description && (
                              <p className="mt-1 hidden line-clamp-1 text-sm text-zinc-500 md:block">
                                {category.description}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-xs text-zinc-400">
                            {category.products.length}
                          </span>
                        </header>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {category.products.map((product) => (
                            <MenuProductCard
                              key={product.id}
                              product={product}
                              currency={data.currency}
                              locale={data.locale}
                              detailHref="#"
                              onAdd={() => undefined}
                              onPreview={() => undefined}
                            />
                          ))}
                        </div>
                      </section>
                    ))
                  ) : (
                    <section className="rounded-2xl border border-white/10 bg-white/[.03] p-10 text-center text-sm text-zinc-400">
                      Publicá categorías con productos para verlos acá. Mientras tanto la cabecera ya muestra
                      tus textos.
                    </section>
                  )}
                </div>
              </div>
            </ResponsivePreview>
          </div>
        </div>
      </div>
    </section>
  );
}
