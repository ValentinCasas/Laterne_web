"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import { trackEvent } from "@/components/analytics/tracker";
import { useDragToScroll } from "@/components/use-carousel-drag";
import { copyBrowserText, createBrowserId, readBrowserJson, writeBrowserJson } from "@/lib/browser-compat";
import { publicHrefForVisiblePath } from "@/lib/routes";
import { usePathname } from "next/navigation";

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

/** @summary Convierte un precio al formato monetario configurado por el negocio. */
const formatPrice = (value: number, currency: string, locale: string) =>
  new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
const productFallback = "/images/image_defect/product_default.png";

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
}: {
  categories: MenuCategory[];
  phone: string;
  currency: string;
  locale: string;
  businessName: string;
  branchName?: string;
  tenantSlug: string;
  branchSlug?: string;
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
  useEffect(() => {
    /** @summary Fija el tope de los títulos justo debajo del navbar y del bloque de búsqueda reales. */
    const toolbar = toolbarRef.current;
    const header = document.querySelector<HTMLElement>("header");
    const update = () => {
      const headerHeight = header?.getBoundingClientRect().height ?? 64;
      const toolbarHeight = toolbar?.getBoundingClientRect().height ?? 0;
      setStickyOffset(headerHeight + toolbarHeight);
    };
    update();
    const observer = new ResizeObserver(update);
    if (toolbar) observer.observe(toolbar);
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
                    typeof value.image === "string" && value.image.trim() ? value.image : productFallback,
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
  const locationName = branchName?.trim() || "Principal";
  const businessLocationLabel = locationName.toLocaleLowerCase("es").startsWith(businessName.toLocaleLowerCase("es"))
    ? locationName
    : `${businessName} · ${locationName}`;
  const activeFilterCount = Number(diet !== "all") + Number(Boolean(maximumPrice)) + Number(sort !== "recommended");
  const recentProducts = recentIds
    .map((id) => categories.flatMap((category) => category.products).find((product) => product.id === id))
    .filter((product): product is MenuProduct => Boolean(product));
  /** @summary Formatea importes de la carta con la moneda y región configuradas por el negocio. */
  const priceText = (value: number) => formatPrice(value, currency, locale);
  function openFilters() {
    setDraftDiet(diet);
    setDraftMaximumPrice(maximumPrice);
    setDraftSort(sort);
    setFiltersOpen(true);
  }
  function applyFilters() {
    setDiet(draftDiet);
    setMaximumPrice(draftMaximumPrice);
    setSort(draftSort);
    setFiltersOpen(false);
  }
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
      <section className="relative overflow-hidden border-b border-white/10 py-4 md:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(236,72,153,.28),transparent_35%),radial-gradient(circle_at_85%_30%,rgba(245,197,66,.16),transparent_30%)]" />
        <div className="shell relative">
          <div className="flex min-w-0 items-center justify-between gap-3 md:hidden">
            <div className="min-w-0">
              <p className="truncate text-base font-black">
                {businessLocationLabel}
              </p>
              <p className="mt-0.5 text-xs font-bold text-zinc-400">Carta virtual</p>
            </div>
            <button
              className="min-h-11 shrink-0 rounded-full bg-pink-500 px-4 text-sm font-black text-white"
              onClick={() => setCartOpen(true)}
              type="button"
            >
              Pedido ({quantity})
            </button>
          </div>
          <div className="hidden items-center justify-between gap-4 md:flex">
            <div>
              <p className="text-6xl font-black text-pink-500">
                {businessName}<span className="text-white">&.</span>
              </p>
              <p className="mt-2 text-xs font-black uppercase tracking-[.28em] text-zinc-400">
                Carta virtual · {locationName}
              </p>
            </div>
            <Link
              className="inline-flex rounded-full border border-white/15 px-5 py-3 text-sm font-bold hover:bg-white hover:text-black"
              href={publicHref("/")}
            >
              Volver al inicio
            </Link>
          </div>
          <div className="mt-16 hidden max-w-3xl md:block">
            <p className="section-eyebrow">Cervezas · Cocina · Momentos</p>
            <h1 className="mt-3 text-8xl font-black tracking-[-.06em]">
              Carta <span className="text-pink-500">{businessName}</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-zinc-400">
              Recorré las categorías, elegí tus favoritos y armá tu pedido.
            </p>
            <div className="mt-8 flex gap-3">
              <a className="btn" href="#productos">
                Ver carta
              </a>
              <button
                className="btn btn-secondary"
                onClick={() => setCartOpen(true)}
              >
                Pedido ({quantity})
              </button>
            </div>
          </div>
        </div>
      </section>

      <section
        ref={toolbarRef}
        className="z-30 border-b border-white/10 bg-black/95 py-3 backdrop-blur-xl md:sticky md:top-16 md:py-4"
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
                className={`flex min-h-12 shrink-0 snap-start items-center gap-2 rounded-full border px-4 py-2 text-sm font-black transition md:min-h-0 md:font-bold ${
                  activeCategoryId === category.id
                    ? "border-pink-500 bg-pink-500/20 text-white"
                    : "border-white/10 bg-white/5 text-zinc-200 hover:border-pink-500 hover:bg-pink-500/10"
                }`}
                href={`#category-${category.id}`}
                key={category.id}
                onClick={() => setActiveCategoryId(category.id)}
              >
                <Image
                  src={`/images/images_categories/${category.image}`}
                  alt=""
                  width={28}
                  height={28}
                  draggable={false}
                  className="pointer-events-none h-7 w-7 object-contain"
                  onError={(event) => {
                    event.currentTarget.src = "/images/images_categories/bottle-1-svgrepo-com.png";
                  }}
                />
                {category.name}
              </a>
            ))}
          </div>
          <div className="mt-2 flex items-stretch gap-2 md:mt-3">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Buscar productos</span>
              <input
                className="input min-h-12 py-2.5 text-base"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar en la carta…"
                type="search"
              />
            </label>
            <button
              className="min-h-12 shrink-0 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-black lg:hidden"
              onClick={openFilters}
              type="button"
              aria-haspopup="dialog"
            >
              ⚙ Filtros{activeFilterCount ? ` (${activeFilterCount})` : ""}
            </button>
          </div>
          {activeFilterCount > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2 lg:hidden" aria-label="Filtros activos">
              {diet !== "all" && (
                <button className="rounded-full bg-pink-500/15 px-3 py-1.5 text-xs font-bold text-pink-200" onClick={() => setDiet("all")} type="button">
                  {diet === "vegetarian" ? "Vegetarianos" : diet === "vegan" ? "Veganos" : diet === "glutenFree" ? "Sin gluten" : "Sin alcohol"} ×
                </button>
              )}
              {maximumPrice && (
                <button className="rounded-full bg-pink-500/15 px-3 py-1.5 text-xs font-bold text-pink-200" onClick={() => setMaximumPrice("")} type="button">
                  Hasta {priceText(Number(maximumPrice))} ×
                </button>
              )}
              {sort !== "recommended" && (
                <button className="rounded-full bg-pink-500/15 px-3 py-1.5 text-xs font-bold text-pink-200" onClick={() => setSort("recommended")} type="button">
                  {sort === "name" ? "Por nombre" : sort === "price_asc" ? "Menor precio" : "Mayor precio"} ×
                </button>
              )}
              <button className="px-1 py-1 text-xs font-bold text-zinc-400 underline" onClick={clearFilters} type="button">
                Limpiar
              </button>
            </div>
          )}
          <div className="mt-2 hidden grid-cols-3 gap-2 lg:grid">
            <select
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
              className="input py-2 text-xs sm:text-sm"
              value={maximumPrice}
              onChange={(event) => setMaximumPrice(event.target.value)}
              type="number"
              min={0}
              placeholder="Precio máximo"
              aria-label="Precio máximo"
            />
            <select
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
            className="scroll-mt-20 md:scroll-mt-[13rem]"
            id={`category-${category.id}`}
            key={category.id}
            style={stickyOffset > 0 ? { scrollMarginTop: `${stickyOffset + 2}px` } : undefined}
          >
            <header
              className="mb-3 flex items-center justify-between gap-2 border-b border-white/10 px-1 py-2 md:sticky md:top-[var(--menu-sticky-top)] md:z-20 md:-mx-2 md:mb-7 md:rounded-2xl md:border md:bg-black/90 md:px-4 md:py-3 md:shadow-xl md:shadow-black/30 md:backdrop-blur-xl"
              style={stickyOffset > 0 ? ({ "--menu-sticky-top": `${stickyOffset}px` } as React.CSSProperties) : undefined}
            >
              <div className="min-w-0">
                <p className="section-eyebrow hidden md:block">{businessName}</p>
                <h2 className="break-words text-lg font-black uppercase tracking-wide md:mt-1 md:text-3xl md:normal-case md:tracking-normal">{category.name}</h2>
                {category.description && (
                  <p className="mt-1 hidden line-clamp-1 text-sm text-zinc-500 md:block">
                    {category.description}
                  </p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-xs text-zinc-400 md:px-4 md:py-2 md:text-sm">
                {category.products.length}
              </span>
            </header>
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {category.products.map((product) => {
                const soldOut = product.availability?.toLowerCase() === "agotado";
                return (
                  <article
                    className="group grid min-h-52 min-w-0 grid-cols-[minmax(6.75rem,36%)_minmax(0,1fr)] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-xl shadow-black/20 sm:flex sm:min-h-[410px] sm:flex-col sm:rounded-[1.75rem]"
                    key={product.id}
                  >
                    <div className="relative min-h-52 overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-950 p-2 sm:h-56 sm:min-h-0 sm:p-5">
                      <button
                        className="relative h-full w-full"
                        type="button"
                        onClick={() => setPreview(product)}
                        aria-label={`Ampliar ${product.name}`}
                      >
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          sizes="(max-width: 640px) 116px, 320px"
                          className="object-contain transition duration-500 group-hover:scale-105"
                          onError={(event) => {
                            event.currentTarget.src = productFallback;
                          }}
                        />
                      </button>
                      {soldOut ? (
                        <span className="absolute left-2 top-2 rounded-full bg-red-500 px-2 py-1 text-[10px] font-black uppercase sm:left-4 sm:top-4 sm:px-3 sm:text-xs">
                          Agotado
                        </span>
                      ) : (
                        <button
                          className="absolute bottom-4 right-4 hidden h-11 w-11 place-items-center rounded-full bg-pink-500 text-2xl font-bold shadow-lg hover:scale-110 sm:grid"
                          onClick={() => add(product)}
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
                            <del className="block text-[10px] text-zinc-600">
                              {priceText(product.previousPrice)}
                            </del>
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
                        <Link
                          className="mb-2 block min-h-9 rounded-lg py-2 text-center text-xs font-bold text-zinc-400 hover:bg-white/5 hover:text-pink-300 sm:text-sm"
                          href={publicHref(`/productos/${product.slug}`)}
                        >
                          Ver detalles
                        </Link>
                        {soldOut ? (
                          <span className="text-xs font-bold text-red-300 sm:text-sm">No disponible</span>
                        ) : (
                          <button
                            className="min-h-11 w-full rounded-lg border border-white/15 px-2 py-2 text-sm font-black hover:border-pink-500 hover:bg-pink-500 sm:rounded-xl sm:py-3"
                            onClick={() => add(product)}
                            aria-label={`Agregar ${product.name}`}
                          >
                            Agregar
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
        {!shownCategories.length && (
          <section className="card p-12 text-center">
            <span className="text-5xl">🍺</span>
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
        <span className="text-lg" aria-hidden="true">🛒</span>
        <span className="text-sm text-white sm:text-left">
          <small className="hidden text-[10px] uppercase tracking-wider sm:block">Pedido</small>
          <span className="sm:hidden">Pedido ({quantity})</span>
          <span className="hidden sm:inline">{quantity} {quantity === 1 ? "producto" : "productos"}</span>
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
                <h2 className="mt-1 text-2xl font-black" id="filters-title">Filtros</h2>
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
                <select className="input min-h-12" value={draftDiet} onChange={(event) => setDraftDiet(event.target.value)}>
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
                <select className="input min-h-12" value={draftSort} onChange={(event) => setDraftSort(event.target.value)}>
                  <option value="recommended">Recomendados</option>
                  <option value="name">Nombre</option>
                  <option value="price_asc">Menor precio</option>
                  <option value="price_desc">Mayor precio</option>
                </select>
              </label>
            </div>
            <div className="mt-6 grid grid-cols-[auto_minmax(0,1fr)] gap-3">
              <button className="min-h-12 rounded-xl border border-white/15 px-4 font-bold text-zinc-300" onClick={clearFilters} type="button">
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
          className="fixed inset-0 z-[150] flex justify-end bg-black/75 backdrop-blur-sm"
          onClick={() => setCartOpen(false)}
        >
          <aside
            className="flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-white text-zinc-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
          >
            <header className="flex items-center justify-between border-b p-4 sm:p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-pink-600">{businessName}</p>
                <h2 id="cart-title" className="text-3xl font-black">
                  Tu pedido
                </h2>
              </div>
              <button
                className="grid h-11 w-11 place-items-center rounded-full bg-zinc-100 text-2xl"
                onClick={() => setCartOpen(false)}
                aria-label="Cerrar pedido"
              >
                ×
              </button>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
              {cart.length ? (
                cart.map((item) => (
                  <article className="flex gap-3 rounded-2xl border p-3" key={cartItemKey(item)}>
                    <div className="relative h-20 w-20 shrink-0 rounded-xl bg-zinc-100">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-contain p-1"
                        onError={(event) => {
                          event.currentTarget.src = productFallback;
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        <h3 className="break-words font-black leading-tight">{item.name}</h3>
                        <button
                          className="text-xl text-zinc-400"
                          onClick={() =>
                            setCart(cart.filter((product) => cartItemKey(product) !== cartItemKey(item)))
                          }
                          aria-label={`Quitar ${item.name}`}
                        >
                          ×
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        Unitario <strong className="text-pink-600">{priceText(cartItemPrice(item))}</strong>
                      </p>
                      {item.variantName && <p className="text-xs text-zinc-500">{item.variantName}</p>}
                      {!!item.extrasSelected?.length && (
                        <p className="line-clamp-1 text-xs text-zinc-500">
                          + {item.extrasSelected.map((extra) => extra.name).join(", ")}
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center rounded-full bg-zinc-100 p-1">
                          <button
                            className="h-8 w-8 rounded-full bg-white"
                            onClick={() => change(cartItemKey(item), -1)}
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-sm font-black">{item.quantity}</span>
                          <button
                            className="h-8 w-8 rounded-full bg-white"
                            onClick={() => change(cartItemKey(item), 1)}
                          >
                            +
                          </button>
                        </div>
                        <span className="text-right text-xs text-zinc-500">
                          Subtotal
                          <strong className="block text-sm text-zinc-950">{priceText(cartItemPrice(item) * item.quantity)}</strong>
                        </span>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-2xl bg-zinc-100 p-10 text-center text-zinc-500">
                  Todavía no agregaste productos.
                </div>
              )}
            </div>
            <footer className="border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6">
              <div className="mb-5 flex items-end justify-between">
                <span className="text-sm font-bold uppercase tracking-widest text-zinc-500">Subtotal general</span>
                <strong className="text-3xl">{priceText(total)}</strong>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Link
                  className={`rounded-xl bg-pink-500 py-3 text-center font-bold text-white sm:col-span-2 ${!cart.length ? "pointer-events-none opacity-40" : ""}`}
                  href={publicHref("/pedido")}
                  onClick={() => {
                    trackEvent("order.started", { metadata: { itemCount: quantity } });
                    setCartOpen(false);
                  }}
                >
                  Continuar →
                </Link>
                <button
                  className="rounded-xl border py-3 text-sm font-bold disabled:opacity-40"
                  disabled={!cart.length}
                  onClick={copyOrder}
                >
                  Copiar pedido
                </button>
                {phone && (
                  <a
                    className={`rounded-xl border border-green-700 py-3 text-center text-sm font-bold text-green-700 ${!cart.length ? "pointer-events-none opacity-40" : ""}`}
                    href={`https://wa.me/${phone}?text=${encodeURIComponent(orderText)}`}
                    onClick={() => trackEvent("whatsapp.click", { metadata: { source: "menu_cart" } })}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Compartir por WhatsApp
                  </a>
                )}
                <button className="py-2 text-sm font-bold text-red-600 sm:col-span-2" onClick={() => setCart([])} type="button">
                  Vaciar pedido
                </button>
              </div>
            </footer>
          </aside>
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-[160] grid place-items-center bg-black/90 p-5"
          onClick={() => setPreview(null)}
          role="dialog"
          aria-modal="true"
          aria-label={preview.name}
        >
          <div
            className="relative h-[82vh] w-full max-w-4xl rounded-3xl bg-white p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={preview.image}
              alt={preview.name}
              fill
              sizes="90vw"
              className="object-contain p-10"
              onError={(event) => {
                event.currentTarget.src = productFallback;
              }}
            />
            <p className="absolute inset-x-5 bottom-5 rounded-2xl bg-black/80 p-4 text-center font-bold text-white backdrop-blur">
              {preview.name}
            </p>
            <button
              className="absolute right-5 top-5 z-10 grid h-11 w-11 place-items-center rounded-full bg-black text-2xl text-white"
              onClick={() => setPreview(null)}
              aria-label="Cerrar imagen"
            >
              ×
            </button>
          </div>
        </div>
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
