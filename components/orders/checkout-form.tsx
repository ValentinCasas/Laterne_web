"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState, useEffect } from "react";
import Swal from "sweetalert2";
import { readBrowserJson, readBrowserText, removeBrowserText, writeBrowserJson } from "@/lib/browser-compat";
import { scopedFetch } from "@/lib/client-routing";
import {
  availableOrderSlots,
  ORDER_MINIMUM_LEAD_MINUTES,
  type OrderOpeningHourInput,
} from "@/lib/order-scheduling";
import { publicHrefForVisiblePath } from "@/lib/routes";
import { PRODUCT_IMAGE_FALLBACK } from "@/lib/image-fallback";
import {
  DeliveryLocationPicker,
  type ConfirmedDeliveryLocation,
} from "@/components/orders/delivery-location-picker";

type StoredCartItem = {
  id: number;
  name: string;
  image: string;
  price: number;
  quantity: number;
  preparationMinutes?: number | null;
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
  geofenceEnabled?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  geofenceRadius?: number | null;
  openingHours: OrderOpeningHourInput[];
  tables?: Array<{ id: number; name: string; code: string }>;
};

type CheckoutStep = "details" | "payment" | "review";
type OrderType = "takeaway" | "dine_in" | "delivery";
type DeliveryLocationMode = "" | "current" | "map";

const checkoutSteps: Array<{ id: CheckoutStep; label: string }> = [
  { id: "details", label: "Datos + modalidad" },
  { id: "payment", label: "Forma de pago" },
  { id: "review", label: "Resumen" },
];

const orderTypeLabels: Record<OrderType, string> = {
  takeaway: "Retiro",
  dine_in: "Mesa",
  delivery: "Delivery",
};

const paymentLabels: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card_on_delivery: "Tarjeta al retirar o recibir",
  on_delivery: "A coordinar con el local",
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

/** @summary Permite revisar datos, modalidad y productos antes de crear el pedido definitivo. */
export function CheckoutForm({
  branches,
  currency,
  locale,
  timeZone,
  tenantSlug,
  fixedBranchSlug,
}: {
  branches: BranchOption[];
  currency: string;
  locale: string;
  timeZone: string;
  tenantSlug: string;
  fixedBranchSlug?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fixedBranch = useMemo(
    () => branches.find((branch) => branch.slug === fixedBranchSlug),
    [branches, fixedBranchSlug],
  );
  const selectableBranches = useMemo(() => (fixedBranch ? [fixedBranch] : branches), [branches, fixedBranch]);
  const [items, setItems] = useState<StoredCartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [scheduleNow, setScheduleNow] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<CheckoutStep>("details");
  const [error, setError] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("takeaway");
  const [tableCode, setTableCode] = useState("");
  const [branchId, setBranchId] = useState(fixedBranch?.id ?? branches[0]?.id ?? 0);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryReference, setDeliveryReference] = useState("");
  const [deliveryLocationMode, setDeliveryLocationMode] = useState<DeliveryLocationMode>("");
  const [deliveryLocation, setDeliveryLocation] = useState<ConfirmedDeliveryLocation | null>(null);
  const [requestingDeliveryLocation, setRequestingDeliveryLocation] = useState(false);
  const [deliveryLocationError, setDeliveryLocationError] = useState("");
  const [notes, setNotes] = useState("");
  const [requestedTime, setRequestedTime] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [promotionCode, setPromotionCode] = useState("");
  const [tip, setTip] = useState(0);
  const idempotencyKeyRef = useRef<string | null>(null);

  /**
   * @summary Obtiene o crea la clave que evita confirmar dos veces el mismo pedido.
   */
  function idempotencyKey() {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current =
        (globalThis.crypto?.randomUUID?.() as string | undefined) ??
        `ck-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    }
    return idempotencyKeyRef.current;
  }

  /**
   * @summary Pide la ubicación del navegador para validar el geofence del local.
   * Resuelve `null` si el navegador no la soporta, el usuario la deniega o expira.
   */
  function requestGeolocation(): Promise<{ latitude: number; longitude: number; accuracy: number } | null> {
    return new Promise((resolve) => {
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
      );
    });
  }

  /** @summary Pide GPS solo después del clic del cliente y conserva la precisión informada por el navegador. */
  async function requestCurrentDeliveryLocation() {
    setDeliveryLocationMode("current");
    setDeliveryLocation(null);
    setDeliveryLocationError("");
    setRequestingDeliveryLocation(true);
    const location = await requestGeolocation();
    setRequestingDeliveryLocation(false);
    if (!location) {
      setDeliveryLocationError("No pudimos acceder a tu ubicación. Podés habilitar el permiso o elegir el punto en el mapa.");
      return;
    }
    setDeliveryLocation(location);
  }

  /** @summary Abre la elección manual sin reutilizar silenciosamente una posición GPS anterior. */
  function chooseAnotherDeliveryLocation() {
    setDeliveryLocationMode("map");
    setDeliveryLocation(null);
    setDeliveryLocationError("");
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const table = searchParams.get("mesa") || readBrowserText("laterne_mesa") || "";
      const requestedBranch = fixedBranchSlug || searchParams.get("branch") || "";
      const initialBranch = branches.find((branch) => branch.slug === requestedBranch);
      if (initialBranch) setBranchId(initialBranch.id);
      setTableCode(table);
      if (table) setOrderType("dine_in");
      setItems(storedCart());
      setScheduleNow(new Date());
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
    () => selectableBranches.find((branch) => branch.id === branchId) ?? selectableBranches[0],
    [branchId, selectableBranches],
  );
  const leadMinutes = useMemo(
    () => Math.max(ORDER_MINIMUM_LEAD_MINUTES, ...items.map((item) => Number(item.preparationMinutes ?? 0))),
    [items],
  );
  const scheduleSlots = useMemo(
    () =>
      selectedBranch && scheduleNow
        ? availableOrderSlots({
            hours: selectedBranch.openingHours,
            timeZone,
            now: scheduleNow,
            leadMinutes,
          })
        : [],
    [leadMinutes, scheduleNow, selectedBranch, timeZone],
  );
  const effectiveRequestedTime = scheduleSlots.some((slot) => slot.value === requestedTime)
    ? requestedTime
    : (scheduleSlots[0]?.value ?? "");
  const selectedSlot = scheduleSlots.find((slot) => slot.value === effectiveRequestedTime);
  const slotsByDate = useMemo(() => {
    const groups = new Map<string, typeof scheduleSlots>();
    for (const slot of scheduleSlots) groups.set(slot.date, [...(groups.get(slot.date) ?? []), slot]);
    return groups;
  }, [scheduleSlots]);
  const deliveryFee = orderType === "delivery" ? Number(selectedBranch?.deliveryFee ?? 0) : 0;
  const estimatedTotal = Math.max(0, subtotal + deliveryFee + Number(tip || 0));
  const stepIndex = checkoutSteps.findIndex((entry) => entry.id === step);

  /** @summary Quita un producto de la revisión y sincroniza el carrito persistido. */
  function removeItem(index: number) {
    setItems((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      writeBrowserJson("laterne_carrito", next);
      return next;
    });
  }

  /**
   * @summary Valida los datos del cliente y la modalidad antes de continuar.
   */
  function validateDetails() {
    if (!items.length) return "Tu pedido está vacío.";
    if (!selectedBranch) return "Elegí una sucursal disponible.";
    if (customerName.trim().length < 2) return "Escribí tu nombre.";
    if (phone.trim().length < 6) return "Escribí un teléfono o WhatsApp válido.";
    if (email && !/^\S+@\S+\.\S+$/.test(email.trim())) return "Revisá el email ingresado.";
    if (orderType === "delivery" && address.trim().length < 5) return "Ingresá la dirección de entrega.";
    if (orderType === "delivery" && !deliveryLocation) {
      return "Confirmá el punto de entrega usando tu ubicación actual o el mapa.";
    }
    if (orderType === "dine_in" && !tableCode.trim()) return "Elegí la mesa desde la que vas a pedir.";
    if (orderType !== "dine_in" && !effectiveRequestedTime) {
      return "No hay horarios disponibles para esta modalidad. Elegí otra sucursal o consultá al local.";
    }
    return null;
  }

  /**
   * @summary Valida la disponibilidad del pedido y avanza al paso de pago.
   */
  function continueToPayment() {
    const problem = validateDetails();
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setStep("payment");
  }

  /** @summary Envía el pedido únicamente desde la confirmación final y abre su seguimiento privado. */
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step !== "review" || submitting) return;
    const problem = validateDetails();
    if (problem) {
      setError(problem);
      setStep("details");
      return;
    }
    setSubmitting(true);
    setError("");
    const needsGeofence =
      orderType === "dine_in" && Boolean(selectedBranch?.geofenceEnabled) && selectedBranch?.latitude != null;
    let geolocation: { latitude: number; longitude: number; accuracy: number } | null = null;
    if (needsGeofence) {
      geolocation = await requestGeolocation();
      if (!geolocation) {
        setSubmitting(false);
        await Swal.fire({
          title: "Verificá tu ubicación",
          text: "No pudimos verificar tu ubicación. Para realizar un pedido desde una mesa necesitamos confirmar que estás en el establecimiento.",
          icon: "warning",
          confirmButtonText: "Volver a intentar",
          background: "#18181b",
          color: "#fafafa",
          confirmButtonColor: "#ec4899",
        });
        return;
      }
    }
    const deliveryAddress =
      orderType === "delivery"
        ? `${address.trim()}${deliveryReference.trim() ? ` · Referencia: ${deliveryReference.trim()}` : ""}`
        : undefined;
    const payload = {
      customerName: customerName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      orderType,
      branchId: selectedBranch?.id,
      tableCode: orderType === "dine_in" ? tableCode.trim() : undefined,
      address: deliveryAddress,
      requestedTime: orderType === "dine_in" ? "" : effectiveRequestedTime,
      notes: notes.trim(),
      promotionCode: promotionCode.trim(),
      tip: Number(tip || 0),
      paymentMethod,
      website: "",
      loyaltyToken: readBrowserText("laterne_cliente_token") || undefined,
      idempotencyKey: idempotencyKey(),
      ...(geolocation ? { geolocation } : {}),
      ...(orderType === "delivery" && deliveryLocation
        ? {
            deliveryLocation: {
              ...deliveryLocation,
              source: deliveryLocationMode === "current" ? "current" : "map",
            },
          }
        : {}),
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
        title: "No pudimos confirmar el pedido",
        text: result.error ?? "Intentá nuevamente en unos instantes.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
        confirmButtonColor: "#ec4899",
      });
      return;
    }
    removeBrowserText("laterne_carrito");
    router.push(
      `${publicHrefForVisiblePath(pathname, tenantSlug, `/pedido/${result.reference}`, fixedBranchSlug)}?token=${encodeURIComponent(result.token)}`,
    );
  }

  if (!ready) return <div className="card p-10 text-center text-zinc-400">Preparando tu pedido…</div>;

  return (
    <form onSubmit={submit}>
      <ol className="mb-6 grid grid-cols-3 gap-2" aria-label="Pasos del checkout">
        {checkoutSteps.map((entry, index) => (
          <li className={index <= stepIndex ? "text-pink-300" : "text-zinc-600"} key={entry.id}>
            <span
              className={`mb-2 block h-1.5 rounded-full ${index <= stepIndex ? "bg-pink-500" : "bg-white/10"}`}
            />
            <span className="text-[10px] font-black uppercase sm:text-xs">{entry.label}</span>
          </li>
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {step === "details" && (
            <section className="card p-5 sm:p-7">
              <p className="section-eyebrow">Paso 1</p>
              <h2 className="mt-2 text-2xl font-black">¿Cómo querés recibir tu pedido?</h2>
              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ["dine_in", "Mesa"],
                    ["takeaway", "Retiro"],
                    ["delivery", "Delivery"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    className={`min-h-14 rounded-2xl border p-4 text-left font-bold ${orderType === value ? "border-pink-500 bg-pink-500/15 text-pink-200" : "border-white/10 bg-white/5"}`}
                    key={value}
                    onClick={() => setOrderType(value)}
                    type="button"
                  >
                    <span aria-hidden="true">{orderType === value ? "●" : "○"}</span> {label}
                  </button>
                ))}
              </div>

              {!fixedBranch && selectableBranches.length > 1 && orderType !== "dine_in" && (
                <label className="mt-5 block">
                  <span className="mb-2 block text-sm font-bold text-zinc-400">Sucursal</span>
                  <select
                    className="input"
                    value={selectedBranch?.id ?? 0}
                    onChange={(event) => {
                      setBranchId(Number(event.target.value));
                      setDeliveryLocationMode("");
                      setDeliveryLocation(null);
                      setDeliveryLocationError("");
                    }}
                  >
                    {selectableBranches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} · {branch.address}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {orderType === "dine_in" && (
                <label className="mt-5 block">
                  <span className="mb-2 block text-sm font-bold text-zinc-400">Mesa</span>
                  {selectedBranch?.tables?.length ? (
                    <select
                      className="input"
                      value={tableCode}
                      onChange={(event) => setTableCode(event.target.value)}
                    >
                      <option value="">Elegí tu mesa…</option>
                      {selectedBranch.tables.map((table) => (
                        <option value={table.code} key={table.id}>
                          {table.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input"
                      onChange={(event) => setTableCode(event.target.value)}
                      placeholder="Escribí el código de la mesa"
                      value={tableCode}
                    />
                  )}
                </label>
              )}

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-2 block text-sm font-bold text-zinc-400">Nombre</span>
                  <input
                    className="input"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    autoComplete="name"
                  />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-bold text-zinc-400">Teléfono / WhatsApp</span>
                  <input
                    className="input"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-2 block text-sm font-bold text-zinc-400">Email opcional</span>
                  <input
                    className="input"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    autoComplete="email"
                  />
                </label>
              </div>

              {orderType === "delivery" && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="mb-2 block text-sm font-bold text-zinc-400">Dirección</span>
                    <input
                      className="input"
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      autoComplete="street-address"
                      placeholder="Calle y número"
                    />
                  </label>
                  <label>
                    <span className="mb-2 block text-sm font-bold text-zinc-400">Referencia</span>
                    <input
                      className="input"
                      value={deliveryReference}
                      onChange={(event) => setDeliveryReference(event.target.value)}
                      placeholder="Piso, timbre, entre calles…"
                    />
                  </label>
                  <fieldset className="sm:col-span-2">
                    <legend className="text-sm font-bold text-zinc-300">Punto exacto de entrega</legend>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      Lo usamos para que el repartidor encuentre tu ubicación. El GPS solo se solicita si elegís usarlo.
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        className={`min-h-14 rounded-2xl border p-4 text-left text-sm font-black transition ${
                          deliveryLocationMode === "current"
                            ? "border-pink-500 bg-pink-500/15 text-pink-100"
                            : "border-white/10 bg-white/[.03] text-zinc-200 hover:bg-white/[.06]"
                        }`}
                        onClick={() => void requestCurrentDeliveryLocation()}
                        disabled={requestingDeliveryLocation}
                      >
                        {requestingDeliveryLocation ? "Buscando ubicación…" : "Usar mi ubicación actual"}
                      </button>
                      <button
                        type="button"
                        className={`min-h-14 rounded-2xl border p-4 text-left text-sm font-black transition ${
                          deliveryLocationMode === "map"
                            ? "border-pink-500 bg-pink-500/15 text-pink-100"
                            : "border-white/10 bg-white/[.03] text-zinc-200 hover:bg-white/[.06]"
                        }`}
                        onClick={chooseAnotherDeliveryLocation}
                      >
                        Elegir otro punto en el mapa
                      </button>
                    </div>
                    {deliveryLocationMode === "current" && deliveryLocation && (
                      <p className="mt-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300">
                        Ubicación actual confirmada
                        {deliveryLocation.accuracy ? ` · precisión aproximada ${Math.round(deliveryLocation.accuracy)} m` : ""}
                      </p>
                    )}
                    {deliveryLocationError && (
                      <p className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-200">
                        {deliveryLocationError}
                      </p>
                    )}
                    {deliveryLocationMode === "map" && (
                      <div className="mt-3">
                        <DeliveryLocationPicker
                          branch={selectedBranch}
                          value={deliveryLocation}
                          onChange={setDeliveryLocation}
                        />
                      </div>
                    )}
                  </fieldset>
                </div>
              )}

              {orderType !== "dine_in" && (
                <section className="mt-6 rounded-2xl border border-white/10 bg-white/[.03] p-4">
                  <h3 className="font-black">Horario</h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    Franjas de la sucursal · anticipación mínima {leadMinutes} min.
                  </p>
                  {scheduleSlots.length ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label>
                        <span className="mb-2 block text-xs font-bold text-zinc-400">Día</span>
                        <select
                          className="input"
                          value={selectedSlot?.date ?? ""}
                          onChange={(event) =>
                            setRequestedTime(slotsByDate.get(event.target.value)?.[0]?.value ?? "")
                          }
                        >
                          {[...slotsByDate.keys()].map((date) => (
                            <option value={date} key={date}>
                              {date === scheduleSlots[0]?.date ? "Próxima disponibilidad · " : ""}
                              {new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, {
                                weekday: "long",
                                day: "numeric",
                                month: "long",
                                timeZone: "UTC",
                              })}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span className="mb-2 block text-xs font-bold text-zinc-400">Hora</span>
                        <select
                          className="input"
                          value={effectiveRequestedTime}
                          onChange={(event) => setRequestedTime(event.target.value)}
                        >
                          {(slotsByDate.get(selectedSlot?.date ?? "") ?? []).map((slot) => (
                            <option value={slot.value} key={slot.value}>
                              {slot.time}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : (
                    <p className="mt-4 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-200">
                      Ya no quedan horarios disponibles en los próximos 30 días. Consultá al local.
                    </p>
                  )}
                </section>
              )}

              <label className="mt-5 block">
                <span className="mb-2 block text-sm font-bold text-zinc-400">Observaciones</span>
                <textarea
                  className="input min-h-24"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={1500}
                />
              </label>
              {error && (
                <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-300" role="alert">
                  {error}
                </p>
              )}
              <button className="btn mt-6 w-full sm:w-auto" onClick={continueToPayment} type="button">
                Continuar →
              </button>
            </section>
          )}

          {step === "payment" && (
            <section className="card p-5 sm:p-7">
              <p className="section-eyebrow">Paso 2</p>
              <h2 className="mt-2 text-2xl font-black">¿Cómo vas a pagar?</h2>
              <div className="mt-5 grid gap-2">
                {[
                  ["cash", "Efectivo"],
                  ["transfer", "Transferencia"],
                  ["card_on_delivery", "Tarjeta al retirar/recibir"],
                  ["on_delivery", "A coordinar con el local"],
                ].map(([value, label]) => (
                  <label
                    className={`flex min-h-14 items-center gap-3 rounded-2xl border p-4 font-bold ${paymentMethod === value ? "border-pink-500 bg-pink-500/15" : "border-white/10 bg-white/5"}`}
                    key={value}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={value}
                      checked={paymentMethod === value}
                      onChange={(event) => setPaymentMethod(event.target.value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-2 block text-sm font-bold text-zinc-400">Código promocional</span>
                  <input
                    className="input"
                    value={promotionCode}
                    onChange={(event) => setPromotionCode(event.target.value)}
                    placeholder="Si tenés uno"
                  />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-bold text-zinc-400">Propina opcional</span>
                  <input
                    className="input"
                    value={tip || ""}
                    onChange={(event) => setTip(Math.max(0, Number(event.target.value) || 0))}
                    type="number"
                    min={0}
                    step={100}
                    placeholder="0"
                  />
                </label>
              </div>
              <div className="mt-6 flex flex-wrap justify-between gap-3">
                <button className="btn btn-secondary" onClick={() => setStep("details")} type="button">
                  ← Volver
                </button>
                <button className="btn" onClick={() => setStep("review")} type="button">
                  Revisar pedido →
                </button>
              </div>
            </section>
          )}

          {step === "review" && (
            <section className="card p-5 sm:p-7">
              <p className="section-eyebrow">Paso 3</p>
              <h2 className="mt-2 text-3xl font-black">Revisá tu pedido</h2>
              <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  ["Modalidad", orderTypeLabels[orderType]],
                  ["Cliente", customerName],
                  ["Teléfono", phone],
                  ["Sucursal", selectedBranch?.name ?? "—"],
                  [
                    "Horario",
                    orderType === "dine_in"
                      ? `Mesa ${tableCode}`
                      : selectedSlot
                        ? `${selectedSlot.date} · ${selectedSlot.time}`
                        : "—",
                  ],
                  ["Forma de pago", paymentLabels[paymentMethod] ?? paymentMethod],
                  ...(orderType === "delivery" ? [["Dirección", address]] : []),
                  ...(orderType === "delivery"
                    ? [["Punto de entrega", deliveryLocation ? "Ubicación confirmada" : "Sin confirmar"]]
                    : []),
                ].map(([label, value]) => (
                  <div className="rounded-xl bg-white/[.04] p-4" key={label}>
                    <dt className="text-xs font-black uppercase tracking-wider text-zinc-500">{label}</dt>
                    <dd className="mt-1 break-words font-bold">{value}</dd>
                  </div>
                ))}
              </dl>
              {notes && (
                <p className="mt-4 rounded-xl border border-white/10 p-4 text-sm text-zinc-400">
                  <strong className="text-white">Observaciones:</strong> {notes}
                </p>
              )}
              <button className="btn btn-secondary mt-6" onClick={() => setStep("payment")} type="button">
                ← Volver
              </button>
            </section>
          )}
        </div>

        <aside
          className={`${step === "review" ? "block" : "hidden lg:block"} card h-fit overflow-hidden lg:sticky lg:top-24`}
        >
          <header className="border-b border-white/10 p-5">
            <p className="section-eyebrow">Tu pedido</p>
            <h2 className="mt-2 text-2xl font-black">
              {items.reduce((sum, item) => sum + item.quantity, 0)} productos
            </h2>
          </header>
          <div className="max-h-[42vh] space-y-3 overflow-y-auto p-4">
            {items.length ? (
              items.map((item, index) => {
                const unitPrice =
                  item.price +
                  Number(item.variantPrice ?? 0) +
                  (item.extrasSelected?.reduce((sum, extra) => sum + extra.price, 0) ?? 0);
                return (
                  <article
                    className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
                    key={`${item.id}-${index}`}
                  >
                    <div className="relative h-16 w-16 shrink-0 rounded-xl bg-white/5">
                      <Image
                        src={item.image || PRODUCT_IMAGE_FALLBACK}
                        alt=""
                        fill
                        className="object-contain p-1"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        <h3 className="break-words font-black">
                          {item.quantity} × {item.name}
                        </h3>
                        {step !== "review" && (
                          <button
                            className="text-zinc-500 hover:text-red-300"
                            onClick={() => removeItem(index)}
                            type="button"
                            aria-label={`Quitar ${item.name}`}
                          >
                            ×
                          </button>
                        )}
                      </div>
                      {item.variantName && <p className="text-xs text-zinc-400">{item.variantName}</p>}
                      {!!item.extrasSelected?.length && (
                        <p className="text-xs text-zinc-500">
                          + {item.extrasSelected.map((extra) => extra.name).join(", ")}
                        </p>
                      )}
                      <div className="mt-2 flex justify-between gap-2 text-xs text-zinc-500">
                        <span>{formatPrice(unitPrice, currency, locale)} c/u</span>
                        <strong className="text-pink-300">
                          {formatPrice(unitPrice * item.quantity, currency, locale)}
                        </strong>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="p-8 text-center text-zinc-500">Tu pedido está vacío.</div>
            )}
          </div>
          <div className="space-y-2 border-t border-white/10 p-5 text-sm">
            <div className="flex justify-between text-zinc-400">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal, currency, locale)}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Delivery</span>
              <span>{formatPrice(deliveryFee, currency, locale)}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Descuento</span>
              <span>Se valida al confirmar</span>
            </div>
            {tip > 0 && (
              <div className="flex justify-between text-zinc-400">
                <span>Propina</span>
                <span>{formatPrice(tip, currency, locale)}</span>
              </div>
            )}
            <div className="mt-3 flex items-end justify-between border-t border-white/10 pt-4">
              <span className="font-black">Total estimado</span>
              <strong className="text-2xl">{formatPrice(estimatedTotal, currency, locale)}</strong>
            </div>
            {orderType === "delivery" && Number(selectedBranch?.minimumOrder ?? 0) > 0 && (
              <p className="pt-1 text-xs text-zinc-500">
                Pedido mínimo: {formatPrice(selectedBranch?.minimumOrder ?? 0, currency, locale)}
              </p>
            )}
            {step === "review" && (
              <>
                {error && (
                  <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-300" role="alert">
                    {error}
                  </p>
                )}
                <p className="pt-2 text-xs leading-relaxed text-zinc-500">
                  El pedido real se crea recién ahora. El servidor recalcula productos, precios, promociones,
                  stock, horario y total.
                </p>
                {orderType === "dine_in" && selectedBranch?.geofenceEnabled && (
                  <p className="mt-2 rounded-xl bg-pink-500/10 p-3 text-xs leading-relaxed text-pink-200">
                    Confirmaremos que estás dentro del área del local antes de generar el pedido.
                  </p>
                )}
                <button
                  className="btn mt-3 min-h-12 w-full disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!items.length || submitting}
                  type="submit"
                >
                  {submitting ? "Enviando…" : "CONFIRMAR PEDIDO"}
                </button>
              </>
            )}
          </div>
        </aside>
      </div>
      <Link
        className="mt-6 inline-block text-sm font-bold text-zinc-500 hover:text-pink-300"
        href={publicHrefForVisiblePath(pathname, tenantSlug, "/carta", fixedBranchSlug)}
      >
        ← Volver a la carta
      </Link>
    </form>
  );
}
