"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import { trackEvent } from "@/components/analytics-tracker";
import { useDragToScroll } from "@/components/use-carousel-drag";
import { CartaHeader } from "@/components/menu/carta-header";
import { MenuProductCard, formatMenuPrice } from "@/components/menu/menu-product-card";
import type { CartaHeaderConfig } from "@/lib/carta-content";
import { CARTA_HEADER_DEFAULTS } from "@/lib/carta-content";
import { copyBrowserText, createBrowserId, readBrowserJson, writeBrowserJson } from "@/lib/browser-compat";
import { CATEGORY_IMAGE_FALLBACK, handleImageError, PRODUCT_IMAGE_FALLBACK } from "@/lib/image-fallback";
import { Icon } from "@/components/admin/ui/icons";
import { publicHrefForVisiblePath } from "@/lib/routes";
import { usePathname } from "next/navigation";

/** @summary Crea un efecto ripple sutil desde el punto de click usando el accent del tenant. */
function useRipple() {
  return useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dot = document.createElement("span");
    dot.className = "ripple";
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    el.appendChild(dot);
    setTimeout(() => dot.remove(), 500);
  }, []);
}

export type MenuProduct = {
  id: number;
  slug: string;
  name: string;
  description: string;
  price: number;
  availability: string | null;
  image: string;
  featured: boolean;
  isNew: boolean;
  recommended: boolean;
  vegetarian: boolean;
  vegan: boolean;
  glutenFree: boolean;
  alcoholFree: boolean;
  promotionalPrice: number | null;
  previousPrice: number | null;
  arEnabled: boolean;
  preparationMinutes: number | null;
  spiceLevel: number;
  variants: Array<{ id: number; name: string; priceAdjustment: number }>;
  extras: Array<{ id: number; name: string; price: number }>;
};
export type MenuCategory = {
  id: number;
  name: string;
  description: string;
  image: string;
  products: MenuProduct[];
};
type CartItem = MenuProduct & {
  quantity: number;
  lineId?: string;
  variantId?: number | null;
  variantName?: string | null;
  variantPrice?: number;
  extraIds?: number[];
  extrasSelected?: Array<{ id: number; name: string; price: number }>;
  notes?: string;
};

/** @summary Calcula el precio unitario de una elección incluyendo variante y agregados. */
function cartItemPrice(item: CartItem) {
  return (
    item.price +
    Number(item.variantPrice ?? 0) +
    (item.extrasSelected?.reduce((sum, extra) => sum + extra.price, 0) ?? 0)
  );
}

/** @summary Obtiene la clave estable de una línea para distinguir personalizaciones del mismo producto. */
function cartItemKey(item: CartItem) {
  return item.lineId ?? String(item.id);
}

/** @summary Renderiza la carta interactiva, la búsqueda de productos y el pedido del visitante. */
export function MenuClient({
  categories,
  phone,
  currency,
  locale,
  businessName,
  branchName,
  tenantSlug,
  branchSlug,
  cartaConfig = CARTA_HEADER_DEFAULTS,
}: {
  categories: MenuCategory[];
  phone: string;
  currency: string;
  locale: string;
  businessName: string;
  branchName?: string;
  tenantSlug: string;
  branchSlug?: string;
  cartaConfig?: CartaHeaderConfig;
}) {
  const pathname = usePathname();
  const publicHref = (href: string) => publicHrefForVisiblePath(pathname, tenantSlug, href, branchSlug);
  const {
    ref: categoryScroll,
    isDragging: isDraggingCategories,
    dragProps: categoryDragProps,
  } = useDragToScroll<HTMLDivElement>();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [preview, setPreview] = useState<MenuProduct | null>(null);
  const [query, setQuery] = useState("");
  const [diet, setDiet] = useState("all");
  const [maximumPrice, setMaximumPrice] = useState("");
  const [sort, setSort] = useState("recommended");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftDiet, setDraftDiet] = useState("all");
  const [draftMaximumPrice, setDraftMaximumPrice] = useState("");
  const [draftSort, setDraftSort] = useState("recommended");
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? 0);
  const [configuring, setConfiguring] = useState<MenuProduct | null>(null);
  const [ready, setReady] = useState(false);
  const [recentIds, setRecentIds] = useState<number[]>([]);
  const [stickyOffset, setStickyOffset] = useState(0);
  const toolbarRef = useRef<HTMLElement | null>(null);
  const ripple = useRipple();
  useEffect(() => {
    /** @summary Fija el tope de los títulos justo debajo del navbar y del bloque de búsqueda reales. */
    const toolbar = toolbarRef.current;
    const header = document.querySelector<HTMLElement>('[data-site-navbar="true"]');
    const update = () => {
      const headerBottom = header?.getBoundingClientRect().bottom ?? 64;
      const toolbarHeight = toolbar?.getBoundingClientRect().height ?? 0;
      setStickyOffset(headerBottom + toolbarHeight);
    };
    update();
    const observer = new ResizeObserver(update);
    if (toolbar) observer.observe(toolbar, { box: "border-box" });
    if (header) observer.observe(header, { box: "border-box" });
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
  useEffect(() => {
    if (!cartOpen && !filtersOpen && !preview && !configuring) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [cartOpen, configuring, filtersOpen, preview]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored: unknown = readBrowserJson("laterne_carrito", []);
        const sanitized = Array.isArray(stored)
          ? stored
              .filter((item) => item && typeof item === "object" && "id" in item && "name" in item)
              .map((item) => {
                const value = item as CartItem;
                return {
                  ...value,
                  image:
                    typeof value.image === "string" && value.image.trim()
                      ? value.image
                      : PRODUCT_IMAGE_FALLBACK,
                  price: Number(value.price || 0),
                  quantity: Math.max(1, Number(value.quantity || 1)),
                };
              })
          : [];
        setCart(sanitized);
        const viewed = readBrowserJson<Array<{ id?: number }>>("laterne_vistos", []);
        setRecentIds(
          (Array.isArray(viewed) ? viewed : [])
            .map((item) => Number(item.id))
            .filter(Number.isInteger)
            .slice(0, 8),
        );
      } catch {
        setCart([]);
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (ready) writeBrowserJson("laterne_carrito", cart);
  }, [cart, ready]);
  useEffect(() => {
    /** @summary Cierra cualquier panel modal cuando el visitante presiona la tecla Escape. */
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCartOpen(false);
        setPreview(null);
        setConfiguring(null);
        setFiltersOpen(false);
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);
  useEffect(() => {
    const sections = categories
      .map((category) => document.getElementById(`category-${category.id}`))
      .filter((section): section is HTMLElement => Boolean(section));
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
        if (visible) setActiveCategoryId(Number(visible.target.id.replace("category-", "")));
      },
      { rootMargin: "-25% 0px -60% 0px", threshold: 0 },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [categories]);
  const shownCategories = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return categories
      .map((category) => ({
        ...category,
        products: category.products
          .filter(
            (product) =>
              !normalized ||
              `${product.name} ${product.description}`.toLocaleLowerCase("es").includes(normalized),
          )
          .filter((product) => diet === "all" || Boolean(product[diet as keyof MenuProduct]))
          .filter((product) => !maximumPrice || product.price <= Number(maximumPrice))
          .sort((left, right) => {
            if (sort === "name") return left.name.localeCompare(right.name, "es");
            if (sort === "price_asc") return left.price - right.price;
            if (sort === "price_desc") return right.price - left.price;
            return Number(right.recommended || right.featured) - Number(left.recommended || left.featured);
          }),
      }))
      .filter((category) => category.products.length);
  }, [categories, diet, maximumPrice, query, sort]);
  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) return;
    const timer = window.setTimeout(() => {
      trackEvent(shownCategories.length ? "menu.search" : "menu.search_empty", {
        metadata: { queryLength: normalized.length, results: shownCategories.length },
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [query, shownCategories.length]);
  const quantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + cartItemPrice(item) * item.quantity, 0);
  const activeFilterCount =
    Number(diet !== "all") + Number(Boolean(maximumPrice)) + Number(sort !== "recommended");
  const recentProducts = recentIds
    .map((id) => categories.flatMap((category) => category.products).find((product) => product.id === id))
    .filter((product): product is MenuProduct => Boolean(product));
  /** @summary Formatea importes de la carta con la moneda y región configuradas por el negocio. */
  const priceText = (value: number) => formatMenuPrice(value, currency, locale);
  /**
   * @summary Controla la navegación interna de la carta interactiva.
   */
  function openFilters() {
    setDraftDiet(diet);
    setDraftMaximumPrice(maximumPrice);
    setDraftSort(sort);
    setFiltersOpen(true);
  }
  /**
   * @summary Aplica la selección solicitada en la carta interactiva.
   */
  function applyFilters() {
    setDiet(draftDiet);
    setMaximumPrice(draftMaximumPrice);
    setSort(draftSort);
    setFiltersOpen(false);
  }
  /**
   * @summary Restablece todos los filtros de la carta a sus valores iniciales.
   */
  function clearFilters() {
    setDiet("all");
    setMaximumPrice("");
    setSort("recommended");
    setDraftDiet("all");
    setDraftMaximumPrice("");
    setDraftSort("recommended");
  }
  /** @summary Agrega un producto nuevo al pedido o incrementa su cantidad existente. */
  function add(product: MenuProduct) {
    if (product.variants.length || product.extras.length) {
      setConfiguring(product);
      return;
    }
    trackEvent("product.add", { entityType: "product", entityId: product.id });
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      return existing
        ? current.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
        : [...current, { ...product, quantity: 1 }];
    });
  }
  /** @summary Agrega una línea personalizada con variante, extras y observaciones propias. */
  function addConfigured(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configuring) return;
    const form = new FormData(event.currentTarget);
    const variantId = form.get("variantId") ? Number(form.get("variantId")) : null;
    const variant = configuring.variants.find((item) => item.id === variantId) ?? null;
    const extraIds = form.getAll("extraIds").map(Number);
    const extrasSelected = configuring.extras.filter((item) => extraIds.includes(item.id));
    setCart((current) => [
      ...current,
      {
        ...configuring,
        quantity: 1,
        lineId: createBrowserId(),
        variantId,
        variantName: variant?.name ?? null,
        variantPrice: variant?.priceAdjustment ?? 0,
        extraIds,
        extrasSelected,
        notes: String(form.get("notes") ?? "").trim(),
      },
    ]);
    trackEvent("product.add", {
      entityType: "product",
      entityId: configuring.id,
      metadata: { customized: true },
    });
    setConfiguring(null);
  }
  /** @summary Modifica la cantidad de un producto y lo retira cuando llega a cero. */
  function change(key: string, amount: number) {
    setCart((current) =>
      current
        .map((item) => (cartItemKey(item) === key ? { ...item, quantity: item.quantity + amount } : item))
        .filter((item) => item.quantity > 0),
    );
  }
  const orderText = `Pedido ${businessName}:\n\n${cart.map((item) => `${item.quantity} x ${item.name}${item.variantName ? ` (${item.variantName})` : ""}${item.extrasSelected?.length ? ` + ${item.extrasSelected.map((extra) => extra.name).join(", ")}` : ""}${item.notes ? ` · ${item.notes}` : ""} - ${priceText(cartItemPrice(item) * item.quantity)}`).join("\n")}\n\nTotal: ${priceText(total)}`;
  /** @summary Copia al portapapeles un resumen completo del pedido actual. */
  async function copyOrder() {
    if (!cart.length) return;
    const copied = await copyBrowserText(orderText);
    await Swal.fire({
      title: copied ? "Pedido copiado" : "No se pudo copiar automáticamente",
      text: copied ? "Ya podés pegarlo donde quieras." : "Mantené presionado el resumen para copiarlo.",
      icon: copied ? "success" : "info",
      timer: 1800,
      showConfirmButton: false,
      background: "#18181b",
      color: "#fafafa",
    });
  }

  return (
    <main className="menu-page min-h-screen pb-32">
      <CartaHeader
        config={cartaConfig}
        businessName={businessName}
        branchName={branchName}
        quantity={quantity}
        onOpenCart={() => setCartOpen(true)}
        homeHref={publicHref("/")}
      />

      <section
        ref={toolbarRef}
        data-menu-toolbar="true"
        aria-label="Navegación y búsqueda de la carta"
        className="sticky top-[var(--site-navbar-height)] z-30 border-b border-white/10 bg-black/95 py-3 shadow-lg shadow-black/20 md:backdrop-blur-xl md:py-4"
        style={{ position: "-webkit-sticky", transform: "translate3d(0,0,0)" }}
      >
        <div className="shell">
          <div
            ref={categoryScroll}
            {...categoryDragProps}
            className={`flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-1 select-none [scrollbar-width:none] md:gap-3 md:pb-2 ${isDraggingCategories ? "cursor-grabbing" : "cursor-grab"}`}
          >
            {categories.map((category) => (
              <a
                aria-current={activeCategoryId === category.id ? "true" : undefined}
                className={`ripple-container flex min-h-12 shrink-0 snap-start items-center gap-2 rounded-full border px-4 py-2 text-sm font-black transition md:min-h-0 md:font-bold ${
                  activeCategoryId === category.id
                    ? "border-pink-500 bg-pink-500/20 text-white"
                    : "border-white/10 bg-white/5 text-zinc-200 hover:border-pink-500 hover:bg-pink-500/10"
                }`}
                href={`#category-${category.id}`}
                key={category.id}
                onClick={(e) => { ripple(e); setActiveCategoryId(category.id); }}
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
            <label className="min-w-0 flex-1">
              <span className="sr-only">Buscar productos</span>
              <input
                suppressHydrationWarning
                className="input min-h-12 py-2.5 text-base"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar en la carta…"
                type="search"
              />
            </label>
            <button
              className="flex min-h-12 shrink-0 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-black lg:hidden"
              onClick={openFilters}
              type="button"
              aria-haspopup="dialog"
            >
              <Icon name="gear" className="h-4 w-4" /> Filtros{activeFilterCount ? ` (${activeFilterCount})` : ""}
            </button>
          </div>
          {activeFilterCount > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2 lg:hidden" aria-label="Filtros activos">
              {diet !== "all" && (
                <button
                  className="rounded-full bg-pink-500/15 px-3 py-1.5 text-xs font-bold text-pink-200"
                  onClick={() => setDiet("all")}
                  type="button"
                >
                  {diet === "vegetarian"
                    ? "Vegetarianos"
                    : diet === "vegan"
                      ? "Veganos"
                      : diet === "glutenFree"
                        ? "Sin gluten"
                        : "Sin alcohol"}{" "}
                  ×
                </button>
              )}
              {maximumPrice && (
                <button
                  className="rounded-full bg-pink-500/15 px-3 py-1.5 text-xs font-bold text-pink-200"
                  onClick={() => setMaximumPrice("")}
                  type="button"
                >
                  Hasta {priceText(Number(maximumPrice))} ×
                </button>
              )}
              {sort !== "recommended" && (
                <button
                  className="rounded-full bg-pink-500/15 px-3 py-1.5 text-xs font-bold text-pink-200"
                  onClick={() => setSort("recommended")}
                  type="button"
                >
                  {sort === "name" ? "Por nombre" : sort === "price_asc" ? "Menor precio" : "Mayor precio"} ×
                </button>
              )}
              <button
                className="px-1 py-1 text-xs font-bold text-zinc-400 underline"
                onClick={clearFilters}
                type="button"
              >
                Limpiar
              </button>
            </div>
          )}
          <div className="mt-2 hidden grid-cols-3 gap-2 lg:grid">
            <select
              suppressHydrationWarning
              className="input py-2 text-xs sm:text-sm"
              value={diet}
              onChange={(event) => setDiet(event.target.value)}
              aria-label="Preferencia alimentaria"
            >
              <option value="all">Todas las preferencias</option>
              <option value="vegetarian">Vegetarianos</option>
              <option value="vegan">Veganos</option>
              <option value="glutenFree">Sin gluten</option>
              <option value="alcoholFree">Sin alcohol</option>
            </select>
            <input
              suppressHydrationWarning
              className="input py-2 text-xs sm:text-sm"
              value={maximumPrice}
              onChange={(event) => setMaximumPrice(event.target.value)}
              type="number"
              min={0}
              placeholder="Precio máximo"
              aria-label="Precio máximo"
            />
            <select
              suppressHydrationWarning
              className="input col-span-2 py-2 text-xs sm:col-span-1 sm:text-sm"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              aria-label="Ordenar productos"
            >
              <option value="recommended">Recomendados</option>
              <option value="name">Nombre</option>
              <option value="price_asc">Menor precio</option>
              <option value="price_desc">Mayor precio</option>
            </select>
          </div>
        </div>
      </section>

      <div id="productos" className="shell space-y-8 py-4 md:space-y-20 md:py-16">
        {recentProducts.length > 0 && (
          <section className="hidden md:block" aria-labelledby="recent-title">
            <p className="section-eyebrow">Tu recorrido</p>
            <h2 id="recent-title" className="mt-2 text-2xl font-black sm:text-3xl">
              Vistos recientemente
            </h2>
            <div className="mt-4 flex gap-3 overflow-x-auto pb-3">
              {recentProducts.map((product) => (
                <Link
                  className="flex min-w-64 items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-3 hover:border-pink-500/40"
                  href={publicHref(`/productos/${product.slug}`)}
                  key={product.id}
                >
                  <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/5">
                    <Image src={product.image} alt="" fill sizes="64px" className="object-contain p-1" />
                  </span>
                  <span className="min-w-0">
                    <strong className="block truncate">{product.name}</strong>
                    <small className="text-pink-300">{priceText(product.price)}</small>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
        {shownCategories.map((category) => (
          <section
            id={`category-${category.id}`}
            key={category.id}
            style={{ scrollMarginTop: `${Math.max(stickyOffset + 2, 0)}px` }}
          >
            <header
              className="mb-6 mt-10 flex items-center justify-between gap-3 border-b border-white/10 px-1 pb-4 md:sticky md:top-[var(--menu-sticky-top)] md:z-20 md:-mx-2 md:mb-7 md:mt-14 md:rounded-2xl md:border md:bg-black/90 md:px-5 md:py-4 md:shadow-xl md:shadow-black/30 md:backdrop-blur-xl"
              style={
                stickyOffset > 0
                  ? ({ "--menu-sticky-top": `${stickyOffset}px`, position: "-webkit-sticky", transform: "translate3d(0,0,0)" } as React.CSSProperties)
                  : undefined
              }
            >
              <div className="min-w-0">
                <h2 className="break-words text-2xl font-black tracking-tight md:text-3xl">
                  {category.name}
                  <span className="ml-2 inline-block h-[3px] w-6 rounded-full align-middle" style={{ background: "var(--color-primary)" }} />
                </h2>
                {category.description && (
                  <p className="mt-1 line-clamp-1 text-sm text-zinc-400">
                    {category.description}
                  </p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-500 md:px-4 md:py-2 md:text-sm">
                {category.products.length}
              </span>
            </header>
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {category.products.map((product) => (
                <MenuProductCard
                  key={product.id}
                  product={product}
                  currency={currency}
                  locale={locale}
                  detailHref={publicHref(`/productos/${product.slug}`)}
                  onAdd={add}
                  onPreview={setPreview}
                />
              ))}
            </div>
          </section>
        ))}
        {!shownCategories.length && (
          <section className="card p-12 text-center">
            <Icon name="beer" className="mx-auto text-5xl text-zinc-600" />
            <h2 className="mt-4 text-2xl font-black">No encontramos productos</h2>
            <p className="mt-2 text-zinc-500">Probá con otra búsqueda.</p>
          </section>
        )}
      </div>

      <button
        className="fixed bottom-[calc(.75rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex min-h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-pink-500 px-5 font-black shadow-2xl shadow-pink-950/60 hover:scale-105 sm:bottom-5 sm:left-auto sm:right-5 sm:translate-x-0 sm:gap-3 sm:px-5 sm:py-3"
        onClick={() => setCartOpen(true)}
        aria-label={`Ver pedido con ${quantity} ${quantity === 1 ? "producto" : "productos"}`}
      >
        <span aria-hidden="true">
          <Icon name="cart" className="h-6 w-6" />
        </span>
        <span className="text-sm text-white sm:text-left">
          <small className="hidden text-[10px] uppercase tracking-wider sm:block">Pedido</small>
          <span className="sm:hidden">Pedido ({quantity})</span>
          <span className="hidden sm:inline">
            {quantity} {quantity === 1 ? "producto" : "productos"}
          </span>
        </span>
      </button>

      {filtersOpen && (
        <div
          className="fixed inset-0 z-[150] flex bg-black/75 backdrop-blur-sm lg:hidden"
          onClick={() => setFiltersOpen(false)}
        >
          <section
            className="mt-auto max-h-[88dvh] w-full overflow-y-auto rounded-t-[2rem] border-t border-white/15 bg-zinc-950 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="filters-title"
          >
            <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="section-eyebrow">Carta</p>
                <h2 className="mt-1 text-2xl font-black" id="filters-title">
                  Filtros
                </h2>
              </div>
              <button
                className="grid h-11 w-11 place-items-center rounded-full bg-white/5 text-xl"
                onClick={() => setFiltersOpen(false)}
                type="button"
                aria-label="Cerrar filtros"
              >
                ×
              </button>
            </header>
            <div className="mt-5 grid gap-5">
              <label>
                <span className="label">Preferencias</span>
                <select
                  suppressHydrationWarning
                  className="input min-h-12"
                  value={draftDiet}
                  onChange={(event) => setDraftDiet(event.target.value)}
                >
                  <option value="all">Todas</option>
                  <option value="vegetarian">Vegetarianos</option>
                  <option value="vegan">Veganos</option>
                  <option value="glutenFree">Sin gluten</option>
                  <option value="alcoholFree">Sin alcohol</option>
                </select>
              </label>
              <label>
                <span className="label">Precio máximo</span>
                <input
                  suppressHydrationWarning
                  className="input min-h-12"
                  value={draftMaximumPrice}
                  onChange={(event) => setDraftMaximumPrice(event.target.value)}
                  inputMode="numeric"
                  min={0}
                  placeholder="Sin límite"
                  type="number"
                />
              </label>
              <label>
                <span className="label">Ordenar por</span>
                <select
                  suppressHydrationWarning
                  className="input min-h-12"
                  value={draftSort}
                  onChange={(event) => setDraftSort(event.target.value)}
                >
                  <option value="recommended">Recomendados</option>
                  <option value="name">Nombre</option>
                  <option value="price_asc">Menor precio</option>
                  <option value="price_desc">Mayor precio</option>
                </select>
              </label>
            </div>
            <div className="mt-6 grid grid-cols-[auto_minmax(0,1fr)] gap-3">
              <button
                className="min-h-12 rounded-xl border border-white/15 px-4 font-bold text-zinc-300"
                onClick={clearFilters}
                type="button"
              >
                Limpiar
              </button>
              <button className="btn min-h-12 w-full" onClick={applyFilters} type="button">
                Ver resultados
              </button>
            </div>
          </section>
        </div>
      )}

      {cartOpen && (
        <div
          className="fixed inset-0 z-[150] flex justify-end bg-black/60 backdrop-blur-sm"
          onClick={() => setCartOpen(false)}
        >
          <aside
            className="flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-zinc-950 text-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
          >
            <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h2 id="cart-title" className="text-2xl font-black">
                  Tu pedido
                </h2>
                <p className="mt-0.5 text-xs text-zinc-400">{quantity} {quantity === 1 ? "producto" : "productos"}</p>
              </div>
              <button
                className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-lg transition hover:bg-white/15"
                onClick={() => setCartOpen(false)}
                aria-label="Cerrar pedido"
              >
                ×
              </button>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
              {cart.length ? (
                cart.map((item) => (
                  <article className="flex gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-3" key={cartItemKey(item)}>
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/5">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-contain p-1"
                        onError={handleImageError}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        <h3 className="break-words font-black leading-tight text-white">{item.name}</h3>
                        <button
                          className="text-lg text-zinc-500 transition hover:text-red-400"
                          onClick={() =>
                            setCart(cart.filter((product) => cartItemKey(product) !== cartItemKey(item)))
                          }
                          aria-label={`Quitar ${item.name}`}
                        >
                          ×
                        </button>
                      </div>
                      {item.variantName && <p className="mt-0.5 text-xs text-zinc-500">{item.variantName}</p>}
                      {!!item.extrasSelected?.length && (
                        <p className="line-clamp-1 text-xs text-zinc-500">
                          + {item.extrasSelected.map((extra) => extra.name).join(", ")}
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center rounded-full bg-white/10 p-1">
                          <button
                            className="h-11 w-11 rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:h-8 sm:w-8"
                            onClick={() => change(cartItemKey(item), -1)}
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-sm font-black text-white">{item.quantity}</span>
                          <button
                            className="h-11 w-11 rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:h-8 sm:w-8"
                            onClick={() => change(cartItemKey(item), 1)}
                          >
                            +
                          </button>
                        </div>
                        <span className="text-right text-xs text-zinc-400">
                          Subtotal
                          <strong className="block text-sm text-white">
                            {priceText(cartItemPrice(item) * item.quantity)}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-16 text-center">
                  <Icon name="cart" className="text-4xl text-zinc-700" />
                  <p className="mt-3 text-lg font-bold text-zinc-400">Tu pedido está vacío</p>
                  <p className="mt-1 text-sm text-zinc-600">Elegí algo de la carta para empezar.</p>
                </div>
              )}
            </div>
            {cart.length > 0 && (
              <footer className="border-t border-white/10 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6">
                {cart.length > 1 && (
                  <div className="mb-3 flex gap-2">
                    <button
                      className="flex-1 rounded-xl border border-white/10 py-2 text-xs font-bold text-zinc-400 transition hover:text-white"
                      onClick={copyOrder}
                    >
                      Copiar
                    </button>
                    {phone && (
                      <a
                        className="flex-1 rounded-xl border border-white/10 py-2 text-center text-xs font-bold text-zinc-400 transition hover:text-white"
                        href={`https://wa.me/${phone}?text=${encodeURIComponent(orderText)}`}
                        onClick={() => trackEvent("whatsapp.click", { metadata: { source: "menu_cart" } })}
                        target="_blank"
                        rel="noreferrer"
                      >
                        WhatsApp
                      </a>
                    )}
                    <button
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-red-400/60 transition hover:text-red-400"
                      onClick={() => setCart([])}
                      type="button"
                    >
                      Vaciar
                    </button>
                  </div>
                )}
                <div className="mb-3 flex items-end justify-between">
                  <span className="text-sm font-bold text-zinc-400">Subtotal</span>
                  <strong className="text-2xl font-black text-white">{priceText(total)}</strong>
                </div>
                <Link
                  className={`block rounded-xl bg-pink-500 py-3.5 text-center font-black text-white transition hover:brightness-110 ${!cart.length ? "pointer-events-none opacity-40" : ""}`}
                  href={publicHref("/pedido")}
                  onClick={() => {
                    trackEvent("order.started", { metadata: { itemCount: quantity } });
                    setCartOpen(false);
                  }}
                >
                  Continuar pedido
                </Link>
              </footer>
            )}
          </aside>
        </div>
      )}

      {preview && (
        <ProductDetailModal
          product={preview}
          priceText={priceText}
          onClose={() => setPreview(null)}
          onAdd={(p) => { add(p); setPreview(null); }}
          onConfigure={(p) => { setPreview(null); setConfiguring(p); }}
        />
      )}

      {configuring && (
        <div
          className="fixed inset-0 z-[165] grid place-items-center bg-black/80 p-4 backdrop-blur"
          onClick={() => setConfiguring(null)}
        >
          <form
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-zinc-950 p-6 text-white shadow-2xl"
            onSubmit={addConfigured}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Personalizar ${configuring.name}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-eyebrow">Personalizá tu elección</p>
                <h2 className="mt-2 text-3xl font-black">{configuring.name}</h2>
              </div>
              <button
                className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-xl"
                onClick={() => setConfiguring(null)}
                type="button"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            {!!configuring.variants.length && (
              <fieldset className="mt-6">
                <legend className="font-black">Variante</legend>
                <div className="mt-3 grid gap-2">
                  {configuring.variants.map((variant, index) => (
                    <label
                      className="flex items-center justify-between rounded-2xl border border-white/10 p-4"
                      key={variant.id}
                    >
                      <span className="flex items-center gap-3">
                        <input
                          name="variantId"
                          type="radio"
                          value={variant.id}
                          defaultChecked={index === 0}
                          required
                        />
                        {variant.name}
                      </span>
                      <span className="text-sm text-pink-300">
                        {variant.priceAdjustment
                          ? `+ ${priceText(variant.priceAdjustment)}`
                          : "Sin adicional"}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {!!configuring.extras.length && (
              <fieldset className="mt-6">
                <legend className="font-black">Agregados opcionales</legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {configuring.extras.map((extra) => (
                    <label
                      className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 p-3 text-sm"
                      key={extra.id}
                    >
                      <span className="flex items-center gap-2">
                        <input name="extraIds" type="checkbox" value={extra.id} />
                        {extra.name}
                      </span>
                      <span className="text-pink-300">+{priceText(extra.price)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <label className="mt-6 block">
              <span className="label">Nota para este producto</span>
              <textarea
                className="input min-h-20"
                name="notes"
                maxLength={500}
                placeholder="Ej. sin cebolla"
              />
            </label>
            <button className="btn mt-6 w-full">Agregar al pedido</button>
          </form>
        </div>
      )}
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Product Detail Modal — rich, data-complete, no page navigation
   ═══════════════════════════════════════════════════════════════ */

function ProductDetailModal({
  product,
  priceText,
  onClose,
  onAdd,
  onConfigure,
}: {
  product: MenuProduct;
  priceText: (v: number) => string;
  onClose: () => void;
  onAdd: (p: MenuProduct) => void;
  onConfigure: (p: MenuProduct) => void;
}) {
  const soldOut = product.availability?.toLowerCase() === "agotado";
  const hasVariants = product.variants.length > 0;
  const hasExtras = product.extras.length > 0;
  const needsConfig = hasVariants || hasExtras;
  const [qty, setQty] = useState(1);

  function handleAdd() {
    if (needsConfig) {
      onConfigure(product);
    } else {
      for (let i = 0; i < qty; i++) onAdd(product);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[160] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
    >
      {/* Desktop: centered modal. Mobile: bottom sheet. */}
      <div
        className="relative flex max-h-[92vh] w-full max-w-[980px] flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl pub-modal-in sm:pub-modal-in"
        style={{ background: "#0c0c0e" }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Close */}
        <button
          className="absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <Icon name="x" className="h-5 w-5" />
        </button>

        {/* Image — full width, generous */}
        <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-950 sm:aspect-[16/9]">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, 980px"
            className="object-contain p-6 sm:p-10"
            onError={handleImageError}
          />
          {/* Badges */}
          <div className="absolute left-4 top-4 flex flex-wrap gap-1.5">
            {product.isNew && (
              <span className="rounded-full bg-sky-500/90 px-2.5 py-1 text-[10px] font-black uppercase text-white shadow-lg">Nuevo</span>
            )}
            {product.recommended && (
              <span className="rounded-full bg-pink-500/90 px-2.5 py-1 text-[10px] font-black uppercase text-white shadow-lg">Recomendado</span>
            )}
            {product.featured && (
              <span className="rounded-full bg-amber-500/90 px-2.5 py-1 text-[10px] font-black uppercase text-white shadow-lg">Destacado</span>
            )}
            {product.arEnabled && (
              <span className="rounded-full bg-violet-500/90 px-2.5 py-1 text-[10px] font-black uppercase text-white shadow-lg">3D · AR</span>
            )}
          </div>
          {soldOut && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <span className="rounded-full bg-red-500/20 px-6 py-2 text-sm font-bold text-red-300 backdrop-blur">
                No disponible
              </span>
            </div>
          )}
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto p-5 pb-32 sm:p-8 sm:pb-36">
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{product.name}</h2>

          {/* Price */}
          <div className="mt-3 flex items-end gap-3">
            <span className="text-4xl font-black text-white">{priceText(product.price)}</span>
            {product.previousPrice && product.previousPrice > product.price && (
              <span className="pb-1.5 text-lg text-zinc-500 line-through">{priceText(product.previousPrice)}</span>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-400">
              {product.description}
            </p>
          )}

          {/* Dietary tags */}
          {(product.vegetarian || product.vegan || product.glutenFree || product.alcoholFree) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {product.vegetarian && <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-zinc-300">Vegetariano</span>}
              {product.vegan && <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-zinc-300">Vegano</span>}
              {product.glutenFree && <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-zinc-300">Sin gluten</span>}
              {product.alcoholFree && <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-zinc-300">Sin alcohol</span>}
            </div>
          )}

          {/* Details grid */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {product.preparationMinutes && (
              <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
                <span className="block text-xs uppercase tracking-wider text-zinc-500">Preparación</span>
                <strong className="mt-1 block text-white">{product.preparationMinutes} min</strong>
              </div>
            )}
            {product.spiceLevel > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
                <span className="block text-xs uppercase tracking-wider text-zinc-500">Picante</span>
                <span className="mt-1 flex items-center gap-0.5">
                  {Array.from({ length: product.spiceLevel }).map((_, i) => (
                    <Icon key={i} name="flame" className="h-4 w-4 text-red-400" />
                  ))}
                </span>
              </div>
            )}
            {needsConfig && (
              <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
                <span className="block text-xs uppercase tracking-wider text-zinc-500">Opciones</span>
                <strong className="mt-1 block text-white">
                  {hasVariants && `${product.variants.length} variantes`}
                  {hasVariants && hasExtras && " · "}
                  {hasExtras && `${product.extras.length} extras`}
                </strong>
              </div>
            )}
          </div>

          {/* Variants preview */}
          {hasVariants && (
            <div className="mt-6">
              <h3 className="text-sm font-bold text-zinc-300">Tamaños / variantes</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <span key={v.id} className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-zinc-300">
                    {v.name}{v.priceAdjustment ? ` · +${priceText(v.priceAdjustment)}` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Extras preview */}
          {hasExtras && (
            <div className="mt-4">
              <h3 className="text-sm font-bold text-zinc-300">Extras opcionales</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {product.extras.map((e) => (
                  <span key={e.id} className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-zinc-300">
                    {e.name} · +{priceText(e.price)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 3D / AR link */}
          {product.arEnabled && (
            <a
              className="mt-6 inline-flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm font-bold text-violet-300 transition hover:bg-violet-500/20"
              href={`/productos/${product.slug}#experiencia-3d`}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="cube" className="h-4 w-4" />
              Ver en 3D / Realidad aumentada
            </a>
          )}
        </div>

        {/* Sticky footer CTA */}
        {!soldOut && (
          <div
            className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-[#0c0c0e] p-4 sm:p-5"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center gap-3">
              {needsConfig ? (
                <button
                  className="flex-1 rounded-xl bg-pink-500 py-3.5 text-center text-base font-black text-white transition hover:brightness-110 active:scale-[0.98]"
                  onClick={handleAdd}
                >
                  Personalizar y agregar
                </button>
              ) : (
                <>
                  <div className="flex items-center rounded-xl border border-white/15">
                    <button
                      className="h-11 w-11 text-lg font-bold text-white/60 transition hover:text-white"
                      onClick={() => setQty(Math.max(1, qty - 1))}
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-black text-white">{qty}</span>
                    <button
                      className="h-11 w-11 text-lg font-bold text-white/60 transition hover:text-white"
                      onClick={() => setQty(qty + 1)}
                    >
                      +
                    </button>
                  </div>
                  <button
                    className="flex-1 rounded-xl bg-pink-500 py-3.5 text-center text-base font-black text-white transition hover:brightness-110 active:scale-[0.98]"
                    onClick={handleAdd}
                  >
                    Agregar · {priceText(product.price * qty)}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
