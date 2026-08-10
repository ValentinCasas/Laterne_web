"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { trackEvent } from "@/components/analytics/tracker";
import { useDragToScroll } from "@/components/use-carousel-drag";

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
}: {
  categories: MenuCategory[];
  phone: string;
  currency: string;
  locale: string;
}) {
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
  const [configuring, setConfiguring] = useState<MenuProduct | null>(null);
  const [ready, setReady] = useState(false);
  const [recentIds, setRecentIds] = useState<number[]>([]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored: unknown = JSON.parse(localStorage.getItem("laterne_carrito") ?? "[]");
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
        const viewed = JSON.parse(localStorage.getItem("laterne_vistos") ?? "[]") as Array<{ id?: number }>;
        setRecentIds(
          viewed
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
    if (ready) localStorage.setItem("laterne_carrito", JSON.stringify(cart));
  }, [cart, ready]);
  useEffect(() => {
    /** @summary Cierra cualquier panel modal cuando el visitante presiona la tecla Escape. */
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCartOpen(false);
        setPreview(null);
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);
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
  const recentProducts = recentIds
    .map((id) => categories.flatMap((category) => category.products).find((product) => product.id === id))
    .filter((product): product is MenuProduct => Boolean(product));
  /** @summary Formatea importes de la carta con la moneda y región configuradas por el negocio. */
  const priceText = (value: number) => formatPrice(value, currency, locale);
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
        lineId: crypto.randomUUID(),
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
  const orderText = `Pedido Laterne:\n\n${cart.map((item) => `${item.quantity} x ${item.name}${item.variantName ? ` (${item.variantName})` : ""}${item.extrasSelected?.length ? ` + ${item.extrasSelected.map((extra) => extra.name).join(", ")}` : ""}${item.notes ? ` · ${item.notes}` : ""} - ${priceText(cartItemPrice(item) * item.quantity)}`).join("\n")}\n\nTotal: ${priceText(total)}`;
  /** @summary Copia al portapapeles un resumen completo del pedido actual. */
  async function copyOrder() {
    if (!cart.length) return;
    await navigator.clipboard.writeText(orderText);
    await Swal.fire({
      title: "Pedido copiado",
      text: "Ya podés pegarlo donde quieras.",
      icon: "success",
      timer: 1800,
      showConfirmButton: false,
      background: "#18181b",
      color: "#fafafa",
    });
  }

  return (
    <main className="menu-page min-h-screen pb-32">
      <section className="relative overflow-hidden border-b border-white/10 py-7 sm:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(236,72,153,.28),transparent_35%),radial-gradient(circle_at_85%_30%,rgba(245,197,66,.16),transparent_30%)]" />
        <div className="shell relative">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-3xl font-black text-pink-500 sm:text-6xl">
                Laterne<span className="text-white">&.</span>
              </p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[.28em] text-zinc-400 sm:mt-2 sm:text-xs">
                Carta virtual
              </p>
            </div>
            <Link
              className="hidden rounded-full border border-white/15 px-5 py-3 text-sm font-bold hover:bg-white hover:text-black sm:inline-flex"
              href="/"
            >
              Volver al inicio
            </Link>
          </div>
          <div className="mt-7 max-w-3xl sm:mt-16">
            <p className="section-eyebrow hidden sm:block">Cervezas · Cocina · Momentos</p>
            <h1 className="text-4xl font-black tracking-[-.06em] sm:mt-3 sm:text-8xl">
              Carta <span className="text-pink-500">Laterne</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400 sm:mt-5 sm:text-lg">
              Recorré las categorías, elegí tus favoritos y armá tu pedido.
            </p>
            <div className="mt-4 flex gap-2 sm:mt-8 sm:gap-3">
              <a className="btn px-4 py-2 text-sm sm:px-[1.1rem] sm:py-[.7rem]" href="#productos">
                Ver carta
              </a>
              <button
                className="btn btn-secondary px-4 py-2 text-sm sm:px-[1.1rem] sm:py-[.7rem]"
                onClick={() => setCartOpen(true)}
              >
                Pedido ({quantity})
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="sticky top-16 z-30 border-b border-white/10 bg-black/90 py-2 backdrop-blur-xl sm:py-4">
        <div className="shell">
          <div
            ref={categoryScroll}
            {...categoryDragProps}
            className={`flex gap-2 overflow-x-auto pb-1 select-none [scrollbar-width:none] sm:gap-3 sm:pb-2 ${isDraggingCategories ? "cursor-grabbing" : "cursor-grab"}`}
          >
            {categories.map((category) => (
              <a
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold hover:border-pink-500 hover:bg-pink-500/10 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
                href={`#category-${category.id}`}
                key={category.id}
              >
                <Image
                  src={`/images/images_categories/${category.image}`}
                  alt=""
                  width={28}
                  height={28}
                  draggable={false}
                  className="pointer-events-none h-5 w-5 object-contain sm:h-7 sm:w-7"
                  onError={(event) => {
                    event.currentTarget.src = "/images/images_categories/bottle-1-svgrepo-com.png";
                  }}
                />
                {category.name}
              </a>
            ))}
          </div>
          <label className="mt-2 block sm:mt-3">
            <span className="sr-only">Buscar productos</span>
            <input
              className="input py-2 text-sm sm:py-3 sm:text-base"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar en la carta…"
              type="search"
            />
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
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

      <div id="productos" className="shell space-y-12 py-8 sm:space-y-20 sm:py-16">
        {recentProducts.length > 0 && (
          <section aria-labelledby="recent-title">
            <p className="section-eyebrow">Tu recorrido</p>
            <h2 id="recent-title" className="mt-2 text-2xl font-black sm:text-3xl">
              Vistos recientemente
            </h2>
            <div className="mt-4 flex gap-3 overflow-x-auto pb-3">
              {recentProducts.map((product) => (
                <Link
                  className="flex min-w-64 items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-3 hover:border-pink-500/40"
                  href={`/productos/${product.slug}`}
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
            className="scroll-mt-[10.75rem] sm:scroll-mt-[13rem]"
            id={`category-${category.id}`}
            key={category.id}
          >
            <header className="sticky top-[10.75rem] z-20 -mx-1 mb-4 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/90 px-3 py-2 shadow-xl shadow-black/30 backdrop-blur-xl sm:top-[13rem] sm:-mx-2 sm:mb-7 sm:rounded-2xl sm:px-4 sm:py-3">
              <div className="min-w-0">
                <p className="section-eyebrow hidden sm:block">Laterne</p>
                <h2 className="truncate text-xl font-black sm:mt-1 sm:text-3xl">{category.name}</h2>
                {category.description && (
                  <p className="mt-1 hidden line-clamp-1 text-sm text-zinc-500 sm:block">
                    {category.description}
                  </p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-xs text-zinc-400 sm:px-4 sm:py-2 sm:text-sm">
                {category.products.length}
              </span>
            </header>
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {category.products.map((product) => {
                const soldOut = product.availability?.toLowerCase() === "agotado";
                return (
                  <article
                    className="group grid min-h-44 min-w-0 grid-cols-[7.25rem_minmax(0,1fr)] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-xl shadow-black/20 sm:flex sm:min-h-[410px] sm:flex-col sm:rounded-[1.75rem]"
                    key={product.id}
                  >
                    <div className="relative min-h-44 overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-950 p-2 sm:h-56 sm:min-h-0 sm:p-5">
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
                          className="absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full bg-pink-500 text-xl font-bold shadow-lg hover:scale-110 sm:bottom-4 sm:right-4 sm:h-11 sm:w-11 sm:text-2xl"
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
                        <h3 className="min-w-0 flex-1 break-words text-sm font-black leading-tight sm:text-base">
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
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-500 sm:mt-3 sm:line-clamp-3 sm:text-sm">
                        {product.description || "Sin descripción disponible."}
                      </p>
                      <div className="mt-auto pt-3 sm:pt-5">
                        <Link
                          className="mb-2 block text-center text-xs font-bold text-zinc-400 hover:text-pink-300 sm:text-sm"
                          href={`/productos/${product.slug}`}
                        >
                          Ver detalles
                        </Link>
                        {soldOut ? (
                          <span className="text-xs font-bold text-red-300 sm:text-sm">No disponible</span>
                        ) : (
                          <button
                            className="w-full rounded-lg border border-white/15 py-2 text-xs font-black hover:border-pink-500 hover:bg-pink-500 sm:rounded-xl sm:py-3 sm:text-sm"
                            onClick={() => add(product)}
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
        className="fixed bottom-4 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-pink-500 font-black shadow-2xl shadow-pink-950/60 hover:scale-105 sm:bottom-5 sm:right-5 sm:flex sm:h-auto sm:w-auto sm:gap-3 sm:px-5 sm:py-3"
        onClick={() => setCartOpen(true)}
        aria-label={`Ver pedido con ${quantity} ${quantity === 1 ? "producto" : "productos"}`}
      >
        <span className="text-xl">🛒</span>
        <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-white px-1 text-xs text-black sm:static sm:block sm:h-auto sm:bg-transparent sm:p-0 sm:text-left sm:text-white">
          <small className="hidden text-[10px] uppercase tracking-wider sm:block">Pedido</small>
          {quantity}
          <span className="hidden sm:inline"> {quantity === 1 ? "producto" : "productos"}</span>
        </span>
      </button>

      {cartOpen && (
        <div
          className="fixed inset-0 z-[100] flex justify-end bg-black/75 backdrop-blur-sm"
          onClick={() => setCartOpen(false)}
        >
          <aside
            className="flex h-full w-full max-w-lg flex-col bg-white text-zinc-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
          >
            <header className="flex items-center justify-between border-b p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-pink-600">Laterne</p>
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
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
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
                        <h3 className="truncate font-black">{item.name}</h3>
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
                      <p className="text-sm font-bold text-pink-600">{priceText(cartItemPrice(item))}</p>
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
                        <strong>{priceText(cartItemPrice(item) * item.quantity)}</strong>
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
            <footer className="border-t p-6">
              <div className="mb-5 flex items-end justify-between">
                <span className="text-sm font-bold uppercase tracking-widest text-zinc-500">Total</span>
                <strong className="text-3xl">{priceText(total)}</strong>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Link
                  className={`rounded-xl bg-pink-500 py-3 text-center font-bold text-white sm:col-span-2 ${!cart.length ? "pointer-events-none opacity-40" : ""}`}
                  href="/pedido"
                  onClick={() => {
                    trackEvent("order.started", { metadata: { itemCount: quantity } });
                    setCartOpen(false);
                  }}
                >
                  Continuar y guardar pedido
                </Link>
                <button className="rounded-xl border py-3 font-bold" onClick={() => setCart([])}>
                  Vaciar pedido
                </button>
                <button
                  className="rounded-xl bg-black py-3 font-bold text-white disabled:opacity-40"
                  disabled={!cart.length}
                  onClick={copyOrder}
                >
                  Copiar pedido
                </button>
                {phone && (
                  <a
                    className={`rounded-xl bg-green-600 py-3 text-center font-bold text-white sm:col-span-2 ${!cart.length ? "pointer-events-none opacity-40" : ""}`}
                    href={`https://wa.me/${phone}?text=${encodeURIComponent(orderText)}`}
                    onClick={() => trackEvent("whatsapp.click", { metadata: { source: "menu_cart" } })}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Enviar por WhatsApp
                  </a>
                )}
              </div>
            </footer>
          </aside>
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-[110] grid place-items-center bg-black/90 p-5"
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
          className="fixed inset-0 z-[115] grid place-items-center bg-black/80 p-4 backdrop-blur"
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
