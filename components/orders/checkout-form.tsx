"use client";

import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import { readBrowserJson, readBrowserText, removeBrowserText, writeBrowserJson } from "@/lib/browser-compat";
import { scopedFetch } from "@/lib/client-routing";
import { publicHrefForVisiblePath } from "@/lib/routes";

type StoredCartItem = {
  id: number;
  name: string;
  image: string;
  price: number;
  quantity: number;
  variantId?: number | null;
  variantName?: string | null;
  variantPrice?: number;
  extraIds?: number[];
  extrasSelected?: Array<{ id: number; name: string; price: number }>;
  notes?: string;
};

type BranchOption = {
  id: number;
  slug?: string;
  name: string;
  address: string;
  deliveryFee: number;
  minimumOrder: number;
};

/** @summary Formatea importes del pedido usando la moneda configurada para la experiencia pública. */
function formatPrice(value: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

/** @summary Recupera un carrito compatible desde el almacenamiento local y descarta entradas inválidas. */
function storedCart() {
  const value: unknown = readBrowserJson("laterne_carrito", []);
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is StoredCartItem =>
      Boolean(item) &&
      typeof item === "object" &&
      "id" in item &&
      "quantity" in item &&
      Number.isInteger(Number((item as StoredCartItem).id)),
  );
}

/** @summary Permite revisar datos, modalidad y productos antes de almacenar un pedido definitivo. */
export function CheckoutForm({
  branches,
  currency,
  locale,
  tenantSlug,
  fixedBranchSlug,
}: {
  branches: BranchOption[];
  currency: string;
  locale: string;
  tenantSlug: string;
  fixedBranchSlug?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<StoredCartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderType, setOrderType] = useState<"takeaway" | "dine_in" | "delivery">("takeaway");
  const [tableCode, setTableCode] = useState("");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? 0);
  const idempotencyKeyRef = useRef<string | null>(null);

  function idempotencyKey() {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current =
        (globalThis.crypto?.randomUUID?.() as string | undefined) ??
        `ck-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    }
    return idempotencyKeyRef.current;
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const table = searchParams.get("mesa") || readBrowserText("laterne_mesa") || "";
      const requestedBranch = fixedBranchSlug || searchParams.get("branch") || "";
      const fixedBranch = branches.find((branch) => branch.slug === requestedBranch);
      if (fixedBranch) setBranchId(fixedBranch.id);
      setTableCode(table);
      if (table) setOrderType("dine_in");
      setItems(storedCart());
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [branches, fixedBranchSlug, searchParams]);

  const subtotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        const extras =
          item.extrasSelected?.reduce((extraSum, extra) => extraSum + Number(extra.price), 0) ?? 0;
        return sum + (Number(item.price) + Number(item.variantPrice ?? 0) + extras) * Number(item.quantity);
      }, 0),
    [items],
  );
  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === branchId),
    [branchId, branches],
  );

  /** @summary Quita un producto de la revisión y sincroniza el carrito persistido. */
  function removeItem(index: number) {
    setItems((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      writeBrowserJson("laterne_carrito", next);
      return next;
    });
  }

  /** @summary Envía el pedido para validación de precios y abre su seguimiento privado. */
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!items.length) return;
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const requestedTime = String(form.get("requestedTime") ?? "");
    const payload = {
      customerName: form.get("customerName"),
      phone: form.get("phone"),
      email: form.get("email"),
      orderType,
      branchId,
      tableCode: orderType === "dine_in" ? tableCode : undefined,
      address: orderType === "delivery" ? form.get("address") : undefined,
      requestedTime: requestedTime ? new Date(requestedTime).toISOString() : "",
      notes: form.get("notes"),
      promotionCode: form.get("promotionCode"),
      tip: Number(form.get("tip") || 0),
      paymentMethod: form.get("paymentMethod"),
      website: form.get("website"),
      loyaltyToken: readBrowserText("laterne_cliente_token") || undefined,
      idempotencyKey: idempotencyKey(),
      items: items.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
        variantId: item.variantId ?? null,
        extraIds: item.extraIds ?? item.extrasSelected?.map((extra) => extra.id) ?? [],
        notes: item.notes,
      })),
    };
    const response = await scopedFetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
      reference?: string;
      token?: string;
    };
    setSubmitting(false);
    if (!response.ok || !result.reference || !result.token) {
      await Swal.fire({
        title: "No pudimos guardar el pedido",
        text: result.error ?? "Intentá nuevamente en unos instantes.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
        confirmButtonColor: "#ec4899",
      });
      return;
    }
    removeBrowserText("laterne_carrito");
    router.push(`${publicHrefForVisiblePath(pathname, tenantSlug, `/pedido/${result.reference}`, fixedBranchSlug)}?token=${encodeURIComponent(result.token)}`);
  }

  if (!ready) return <div className="card p-10 text-center text-zinc-400">Preparando tu pedido…</div>;

  return (
    <form className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]" onSubmit={submit}>
      <div className="space-y-6">
        <section className="card p-5 sm:p-7">
          <p className="section-eyebrow">Paso 1</p>
          <h2 className="mt-2 text-2xl font-black">¿Cómo querés recibirlo?</h2>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {(
              [
                ["takeaway", "Retiro en el local"],
                ["dine_in", "Consumo en mesa"],
                ["delivery", "Delivery"],
              ] as const
            ).map(([value, label]) => (
              <button
                className={`rounded-2xl border p-4 text-left font-bold ${orderType === value ? "border-pink-500 bg-pink-500/15 text-pink-200" : "border-white/10 bg-white/5"}`}
                key={value}
                onClick={() => setOrderType(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          {branches.length > 0 && orderType !== "dine_in" && (
            <label className="mt-4 block">
              <span className="label">Sucursal</span>
              <select
                className="input"
                value={branchId}
                onChange={(event) => setBranchId(Number(event.target.value))}
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} · {branch.address}
                  </option>
                ))}
              </select>
            </label>
          )}
          {orderType === "dine_in" && (
            <label className="mt-4 block">
              <span className="label">Código de mesa</span>
              <input
                className="input"
                onChange={(event) => setTableCode(event.target.value)}
                placeholder="Ejemplo: MESA-01"
                value={tableCode}
              />
            </label>
          )}
          {orderType === "delivery" && (
            <label className="mt-4 block">
              <span className="label">Dirección de entrega</span>
              <input className="input" name="address" required placeholder="Calle, número y referencias" />
            </label>
          )}
        </section>

        <section className="card p-5 sm:p-7">
          <p className="section-eyebrow">Paso 2</p>
          <h2 className="mt-2 text-2xl font-black">Tus datos</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="label">Nombre</span>
              <input className="input" name="customerName" required minLength={2} autoComplete="name" />
            </label>
            <label>
              <span className="label">Teléfono</span>
              <input className="input" name="phone" required minLength={6} autoComplete="tel" />
            </label>
            <label>
              <span className="label">Email opcional</span>
              <input className="input" name="email" type="email" autoComplete="email" />
            </label>
            <label>
              <span className="label">Horario preferido</span>
              <input className="input" name="requestedTime" type="datetime-local" />
            </label>
          </div>
          <label className="mt-4 block">
            <span className="label">Observaciones generales</span>
            <textarea className="input min-h-24" name="notes" maxLength={1500} />
          </label>
          <input className="hidden" name="website" tabIndex={-1} autoComplete="off" />
        </section>
      </div>

      <aside className="card h-fit overflow-hidden lg:sticky lg:top-24">
        <header className="border-b border-white/10 p-5">
          <p className="section-eyebrow">Paso 3</p>
          <h2 className="mt-2 text-2xl font-black">Revisá tu pedido</h2>
        </header>
        <div className="max-h-[42vh] space-y-3 overflow-y-auto p-4">
          {items.length ? (
            items.map((item, index) => (
              <article
                className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
                key={`${item.id}-${index}`}
              >
                <div className="relative h-16 w-16 shrink-0 rounded-xl bg-white/5">
                  <Image
                    src={item.image || "/images/image_defect/product_default.png"}
                    alt=""
                    fill
                    className="object-contain p-1"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2">
                    <h3 className="truncate font-black">
                      {item.quantity} × {item.name}
                    </h3>
                    <button
                      className="text-zinc-500 hover:text-red-300"
                      onClick={() => removeItem(index)}
                      type="button"
                      aria-label={`Quitar ${item.name}`}
                    >
                      ×
                    </button>
                  </div>
                  {item.variantName && <p className="text-xs text-zinc-400">{item.variantName}</p>}
                  {!!item.extrasSelected?.length && (
                    <p className="text-xs text-zinc-500">
                      + {item.extrasSelected.map((extra) => extra.name).join(", ")}
                    </p>
                  )}
                  <strong className="text-sm text-pink-300">
                    {formatPrice(
                      (item.price +
                        Number(item.variantPrice ?? 0) +
                        (item.extrasSelected?.reduce((sum, extra) => sum + extra.price, 0) ?? 0)) *
                        item.quantity,
                      currency,
                      locale,
                    )}
                  </strong>
                </div>
              </article>
            ))
          ) : (
            <div className="p-8 text-center text-zinc-500">Tu pedido está vacío.</div>
          )}
        </div>
        <div className="space-y-4 border-t border-white/10 p-5">
          <label>
            <span className="label">Código promocional</span>
            <input className="input" name="promotionCode" placeholder="Si tenés uno" />
          </label>
          <label>
            <span className="label">Propina opcional</span>
            <input className="input" name="tip" type="number" min={0} step={100} defaultValue={0} />
          </label>
          <label>
            <span className="label">Forma de pago</span>
            <select className="input" name="paymentMethod" defaultValue="on_delivery">
              <option value="on_delivery">A coordinar con el local</option>
              <option value="cash">Efectivo</option>
              <option value="card_on_delivery">Tarjeta al recibir</option>
              <option value="transfer">Transferencia</option>
            </select>
          </label>
          <div className="flex items-end justify-between border-t border-white/10 pt-4">
            <span className="text-sm text-zinc-400">Subtotal estimado</span>
            <strong className="text-2xl">{formatPrice(subtotal, currency, locale)}</strong>
          </div>
          {orderType === "delivery" && (
            <div className="space-y-1 text-sm text-zinc-400">
              <div className="flex justify-between">
                <span>Envío estimado</span>
                <span>{formatPrice(selectedBranch?.deliveryFee ?? 0, currency, locale)}</span>
              </div>
              {Number(selectedBranch?.minimumOrder ?? 0) > 0 && (
                <p className="text-xs">
                  Pedido mínimo: {formatPrice(selectedBranch?.minimumOrder ?? 0, currency, locale)}
                </p>
              )}
            </div>
          )}
          <p className="text-xs leading-relaxed text-zinc-500">
            El servidor vuelve a verificar precios, disponibilidad y promociones antes de confirmar.
          </p>
          <button
            className="btn w-full disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!items.length || submitting}
          >
            {submitting ? "Guardando…" : "Confirmar pedido"}
          </button>
        </div>
      </aside>
    </form>
  );
}
