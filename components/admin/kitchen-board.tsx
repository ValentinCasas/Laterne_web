"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import { PageHeader, EmptyState, Drawer, FilterPanel, StatusBadge, ActionMenu, ActiveFilterChip } from "@/components/admin/ui";
import { scopedFetch } from "@/lib/client-routing";
import type { KdsOrder, KdsPayload, KdsStation } from "@/lib/kds-data";
import { allowedTransitions, asOrderType, type OrderType } from "@/lib/order-status";
import { orderStatuses, orderStatusLabel, type OrderStatus } from "@/lib/orders";

/**
 * Monitor de cocina (KDS) de MenuClick.
 *
 * Pantalla grande pensada para tablets y monitores táctiles de la cocina:
 * columnas por estado, cronómetro en vivo con clasificación (a tiempo, demorado,
 * crítico), filtros por sector/estación/canal/origen y acciones de un toque.
 * Los datos llegan por polling sin recargar la página y el sonido (opcional)
 * se genera con la Web Audio API del navegador, sin archivos externos.
 */

type ColumnId = "nuevo" | "preparando" | "listo" | "entregado";

type KdsSettings = {
  columns: Record<ColumnId, boolean>;
  sound: boolean;
  onTimeMinutes: number;
  criticalMinutes: number;
};

const DEFAULT_SETTINGS: KdsSettings = {
  columns: { nuevo: true, preparando: true, listo: true, entregado: true },
  sound: false,
  onTimeMinutes: 8,
  criticalMinutes: 15,
};

const SETTINGS_KEY = "menuclick.kds.settings.v1";

const COLUMNS: Array<{
  id: ColumnId;
  label: string;
  statuses: string[];
  dot: string;
  border: string;
  action?: { target: OrderStatus; label: string };
}> = [
  {
    id: "nuevo",
    label: "Nuevo",
    statuses: ["received", "confirmed"],
    dot: "bg-sky-400",
    border: "border-sky-500/30",
    action: { target: "preparing", label: "EMPEZAR" },
  },
  {
    id: "preparando",
    label: "Preparando",
    statuses: ["preparing"],
    dot: "bg-amber-400",
    border: "border-amber-500/30",
    action: { target: "ready", label: "LISTO" },
  },
  {
    id: "listo",
    label: "Listo",
    statuses: ["ready"],
    dot: "bg-emerald-400",
    border: "border-emerald-500/30",
    action: { target: "delivered", label: "ENTREGAR" },
  },
  {
    id: "entregado",
    label: "Entregado",
    statuses: ["delivered"],
    dot: "bg-zinc-500",
    border: "border-zinc-500/20",
  },
];

const modalityLabel: Record<string, string> = {
  dine_in: "Mesa",
  takeaway: "Retiro",
  delivery: "Delivery",
};

const modalityIcon: Record<string, string> = {
  dine_in: "🍽",
  takeaway: "🛍",
  delivery: "🛵",
};

/** @summary Etiquetas legibles para los tipos de estación de cocina. */
const stationTypeLabel: Record<string, string> = {
  KITCHEN: "Cocina",
  BAR: "Barra",
  COFFEE: "Cafetería",
  OTHER: "Otra",
};

const stationTypeIcon: Record<string, string> = {
  KITCHEN: "🍳",
  BAR: "🍸",
  COFFEE: "☕",
  OTHER: "🧰",
};

const sourceLabel: Record<string, string> = {
  website: "Web",
  admin: "Panel",
  pos: "POS",
};

/** @summary Traduce el origen técnico de un pedido a una etiqueta operativa. */
function sourceName(source: string) {
  if (sourceLabel[source]) return sourceLabel[source];
  if (source.startsWith("table:")) return "Mesa QR";
  if (source.startsWith("salon:")) return "Salón";
  return source || "Web";
}

const statusBadge: Record<string, string> = {
  received: "bg-sky-500/15 text-sky-300",
  confirmed: "bg-indigo-500/15 text-indigo-300",
  preparing: "bg-amber-500/15 text-amber-300",
  ready: "bg-emerald-500/15 text-emerald-300",
  delivered: "bg-zinc-500/15 text-zinc-300",
  cancelled: "bg-red-500/15 text-red-300",
};

type TimerLevel = "ontime" | "delayed" | "critical";

/** @summary Clasifica el tiempo transcurrido según los umbrales configurados. */
function timerLevel(minutes: number, settings: KdsSettings): TimerLevel {
  if (minutes >= settings.criticalMinutes) return "critical";
  if (minutes >= settings.onTimeMinutes) return "delayed";
  return "ontime";
}

const timerStyle: Record<TimerLevel, { text: string; card: string; badge: string }> = {
  ontime: { text: "text-zinc-300", card: "", badge: "bg-white/5 text-zinc-300" },
  delayed: { text: "text-amber-300", card: "ring-2 ring-amber-500/40", badge: "bg-amber-500/15 text-amber-300" },
  critical: {
    text: "text-red-300",
    card: "ring-2 ring-red-500/60 animate-pulse",
    badge: "bg-red-500/15 text-red-300",
  },
};

/** @summary Muestra el tiempo transcurrido en lenguaje operativo, con reloj si es corto. */
function elapsedLabel(createdAt: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60_000));
  if (minutes < 1) return "recién";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** @summary Convierte el JSON de agregados de una línea en texto legible. */
function extrasText(value: unknown) {
  if (!Array.isArray(value) || !value.length) return "";
  return value
    .map((extra) =>
      typeof extra === "object" && extra && typeof (extra as { name?: unknown }).name === "string"
        ? (extra as { name: string }).name
        : "",
    )
    .filter(Boolean)
    .join(", ");
}

/** @summary Formatea un valor de fecha ISO para mostrarlo en el monitor. */
function hourLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

/** @summary Lee la configuración del monitor desde localStorage con valores seguros. */
function loadSettings(): KdsSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<KdsSettings>;
    const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
      const number = Number(value);
      return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
    };
    return {
      columns: { ...DEFAULT_SETTINGS.columns, ...(parsed.columns ?? {}) },
      sound: typeof parsed.sound === "boolean" ? parsed.sound : DEFAULT_SETTINGS.sound,
      onTimeMinutes: clampInt(parsed.onTimeMinutes, 1, 60, DEFAULT_SETTINGS.onTimeMinutes),
      criticalMinutes: clampInt(parsed.criticalMinutes, 1, 120, DEFAULT_SETTINGS.criticalMinutes),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** @summary Calcula el camino de estados permitidos desde uno dado hasta el objetivo. */
function buildPath(from: OrderStatus, orderType: OrderType, target: OrderStatus): OrderStatus[] {
  const path: OrderStatus[] = [];
  let current = from;
  for (let step = 0; step < orderStatuses.length; step += 1) {
    if (current === target) return path;
    const candidates = allowedTransitions(current, orderType);
    const direct = candidates.find((candidate) => candidate === target);
    const next = direct ?? candidates.find((candidate) => candidate !== "cancelled");
    if (!next) break;
    path.push(next);
    current = next;
  }
  return current === target ? path : [];
}

/** @summary Reloj en vivo que refresca el monitor sin recargar la página. */
function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date().getTime()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** @summary Campana opcional generada con Web Audio, sin archivos externos. */
function useChime(enabled: boolean) {
  const contextRef = useRef<{ ctx: AudioContext | null }>({ ctx: null });

  /** @summary Crea o recupera el contexto de audio (se activa con el primer gesto). */
  const ensureContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!contextRef.current.ctx) {
      const AudioContextClass =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;
      contextRef.current.ctx = new AudioContextClass();
    }
    return contextRef.current.ctx;
  }, []);

  /** @summary Reproduce un patrón corto de tonos; `new` es agudo y `critical` descendente. */
  const chime = useCallback(
    (pattern: "new" | "critical") => {
      if (!enabled) return;
      const ctx = ensureContext();
      if (!ctx) return;
      if (ctx.state === "suspended") void ctx.resume();
      const notes = pattern === "new" ? [880, 1320] : [660, 440];
      notes.forEach((freq, index) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = freq;
        const start = ctx.currentTime + index * 0.16;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
        oscillator.connect(gain).connect(ctx.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.16);
      });
    },
    [enabled, ensureContext],
  );

  return { chime, ensureContext };
}

/** @summary Monitor de cocina: columnas por estado, cronómetro, filtros y acciones de un toque. */
export function KitchenBoard({ initial, userName }: { initial: KdsPayload; userName: string }) {
  const [data, setData] = useState<KdsPayload>(initial);
  const [settings, setSettings] = useState<KdsSettings>(loadSettings);
  const now = useNow(15_000);
  const [sectorFilter, setSectorFilter] = useState("all");
  const [stationFilter, setStationFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selected, setSelected] = useState<KdsOrder | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showStations, setShowStations] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const { chime } = useChime(settings.sound);
  const knownIds = useRef<Set<number>>(new Set(initial.orders.map((order) => order.id)));
  const criticalAlerted = useRef<Set<number>>(new Set());

  /** @summary Refresca el tablero desde el servidor y emite alertas si hay novedades. */
  const load = useCallback(async () => {
    try {
      const response = await scopedFetch("/api/admin/cocina", { method: "GET" });
      if (!response.ok) return;
      const payload = (await response.json()) as KdsPayload;
      setData(payload);
      setSelected((current) =>
        current ? (payload.orders.find((order) => order.id === current.id) ?? null) : null,
      );
      // El conjunto inicial ya se conoce, así que solo alerta por pedidos nuevos.
      const incoming = payload.orders.filter(
        (order) =>
          !knownIds.current.has(order.id) && ["received", "confirmed", "preparing"].includes(order.status),
      );
      for (const order of payload.orders) knownIds.current.add(order.id);
      if (incoming.length > 0) chime("new");
    } catch {
      /* si el refresco falla se conserva la vista actual */
    }
  }, [chime]);

  /** @summary Refresco periódico para mantener el monitor al día sin recargar la página. */
  useEffect(() => {
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  /** @summary Avisa con sonido cuando un pedido activo entra en estado crítico. */
  useEffect(() => {
    const minutes = new Date().getTime();
    for (const order of data.orders) {
      if (!["received", "confirmed", "preparing"].includes(order.status)) continue;
      if (criticalAlerted.current.has(order.id)) continue;
      const elapsed = Math.floor((minutes - new Date(order.createdAt).getTime()) / 60_000);
      if (elapsed >= settings.criticalMinutes) {
        criticalAlerted.current.add(order.id);
        chime("critical");
      }
    }
  }, [data.orders, settings.criticalMinutes, chime]);

  /** @summary Guarda la configuración del monitor y la persiste en este dispositivo. */
  function updateSettings(next: KdsSettings) {
    setSettings(next);
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      /* sin almacenamiento local se mantiene la configuración en memoria */
    }
  }

  /** @summary Avanza un pedido por los estados permitidos y sincroniza todas las vistas. */
  async function advanceOrder(order: KdsOrder, target: OrderStatus) {
    if (order.status === target) return;
    const path = buildPath(order.status as OrderStatus, asOrderType(order.orderType), target);
    if (!path.length) return;
    try {
      for (const hop of path) {
        const response = await scopedFetch(`/api/admin/orders/${order.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: hop }),
        });
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) throw new Error(body.error ?? "No se pudo actualizar el pedido");
      }
      const now = new Date().toISOString();
      const updated: KdsOrder = {
        ...order,
        status: target,
        history: [
          ...order.history,
          {
            id: new Date().getTime(),
            fromStatus: order.status,
            toStatus: target,
            note: null,
            createdAt: now,
            userName,
          },
        ],
      };
      setData((current) => ({
        ...current,
        orders: current.orders.map((item) => (item.id === order.id ? updated : item)),
      }));
      setSelected((current) => (current?.id === order.id ? updated : current));
    } catch (reason) {
      await Swal.fire({
        title: "No se pudo actualizar",
        text: reason instanceof Error ? reason.message : "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
    }
  }

  /** @summary Pide la cancelación del pedido con confirmación previa. */
  async function cancelOrder(order: KdsOrder) {
    const confirmation = await Swal.fire({
      title: "¿Cancelar el pedido?",
      text: "La preparación se detiene y las unidades vuelven al inventario cuando corresponda.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Cancelar pedido",
      cancelButtonText: "Volver",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmation.isConfirmed) return;
    await advanceOrder(order, "cancelled");
  }

  const visibleOrders = useMemo(() => {
    return data.orders.filter((order) => {
      if (sectorFilter === "none" && order.table?.sector) return false;
      if (sectorFilter !== "all" && sectorFilter !== "none" && order.table?.sector !== sectorFilter) {
        return false;
      }
      if (stationFilter === "none" && order.items.some((item) => item.stationName)) return false;
      if (
        stationFilter !== "all" &&
        stationFilter !== "none" &&
        !order.items.some((item) => item.stationName === stationFilter)
      ) {
        return false;
      }
      if (channelFilter !== "all" && order.orderType !== channelFilter) return false;
      if (sourceFilter !== "all" && order.source !== sourceFilter) return false;
      return true;
    });
  }, [data.orders, sectorFilter, stationFilter, channelFilter, sourceFilter]);

  const activeOrders = data.orders.filter((order) => order.status !== "delivered");
  const delayedCount = activeOrders.filter(
    (order) => timerLevel(Math.floor((now - new Date(order.createdAt).getTime()) / 60_000), settings) !== "ontime",
  ).length;

  const activeStations = data.stations.filter((station) => station.active);

  return (
    <section className="flex min-h-0 flex-col">
      <PageHeader
        eyebrow="Operación"
        title="Cocina"
        description="Monitor de preparaciones: avanzá los pedidos por estado, seguí los tiempos y filtrá por sector, estación o canal."
        section="cocina"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn btn-secondary"
              onClick={() => setShowStations(true)}
              type="button"
              aria-label="Estaciones de cocina"
            >
              Estaciones
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setShowSettings(true)}
              type="button"
              aria-label="Configuración del monitor"
            >
              Ajustes
            </button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          className="btn btn-secondary"
          onClick={() => setShowFilters(true)}
          type="button"
          aria-label="Filtros avanzados"
        >
          Filtros
        </button>
        {(sectorFilter !== "all" ||
          stationFilter !== "all" ||
          channelFilter !== "all" ||
          sourceFilter !== "all") && (
          <div className="flex flex-wrap items-center gap-1.5">
            {sectorFilter !== "all" && (
              <ActiveFilterChip label={`Sector: ${sectorFilter === "none" ? "Sin mesa" : sectorFilter}`} onRemove={() => setSectorFilter("all")} />
            )}
            {stationFilter !== "all" && (
              <ActiveFilterChip label={`Estación: ${stationFilter === "none" ? "Sin estación" : stationFilter}`} onRemove={() => setStationFilter("all")} />
            )}
            {channelFilter !== "all" && (
              <ActiveFilterChip label={`Canal: ${modalityLabel[channelFilter] ?? channelFilter}`} onRemove={() => setChannelFilter("all")} />
            )}
            {sourceFilter !== "all" && (
              <ActiveFilterChip label={`Origen: ${sourceName(sourceFilter)}`} onRemove={() => setSourceFilter("all")} />
            )}
            <button
              className="text-xs font-bold text-zinc-400 hover:text-white"
              onClick={() => {
                setSectorFilter("all");
                setStationFilter("all");
                setChannelFilter("all");
                setSourceFilter("all");
              }}
              type="button"
            >
              Limpiar
            </button>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2 text-sm text-zinc-500">
          {delayedCount > 0 && (
            <span className="rounded-full bg-amber-500/15 px-3 py-1 font-black text-amber-300">
              {delayedCount} demorad{delayedCount === 1 ? "o" : "os"}
            </span>
          )}
          <span className="rounded-full bg-white/5 px-3 py-1 font-bold">
            {activeOrders.length} activo{activeOrders.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <Drawer open={showFilters} onClose={() => setShowFilters(false)} title="Filtros del monitor">
        <FilterPanel title="Filtros activos" actions={
          <button type="button" className="text-xs font-semibold text-zinc-400 hover:text-zinc-200" onClick={() => {
            setSectorFilter("all");
            setStationFilter("all");
            setChannelFilter("all");
            setSourceFilter("all");
          }}>Limpiar todo</button>
        }>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-bold text-zinc-300">Sector</label>
              <select
                className="input mt-1 w-full"
                value={sectorFilter}
                onChange={(event) => setSectorFilter(event.target.value)}
                aria-label="Filtrar por sector"
              >
                <option value="all">Todos los sectores</option>
                <option value="none">Sin mesa</option>
                {data.sectors.map((sector) => (
                  <option key={sector} value={sector}>
                    {sector}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-zinc-300">Estación</label>
              <select
                className="input mt-1 w-full"
                value={stationFilter}
                onChange={(event) => setStationFilter(event.target.value)}
                aria-label="Filtrar por estación"
              >
                <option value="all">Todas las estaciones</option>
                <option value="none">Sin estación</option>
                {activeStations.map((station) => (
                  <option key={station.id} value={station.name}>
                    {stationTypeIcon[station.type] ?? ""} {station.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-zinc-300">Canal</label>
              <select
                className="input mt-1 w-full"
                value={channelFilter}
                onChange={(event) => setChannelFilter(event.target.value)}
                aria-label="Filtrar por canal"
              >
                <option value="all">Todos los canales</option>
                <option value="dine_in">Mesa</option>
                <option value="takeaway">Retiro</option>
                <option value="delivery">Delivery</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-zinc-300">Origen</label>
              <select
                className="input mt-1 w-full"
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
                aria-label="Filtrar por origen"
              >
                <option value="all">Todos los orígenes</option>
                {data.sources.map((source) => (
                  <option key={source} value={source}>
                    {sourceName(source)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </FilterPanel>
      </Drawer>

      {data.orders.length === 0 ? (
        <EmptyState
          title="No hay pedidos para preparar"
          description="Los pedidos confirmados aparecerán acá cuando entren. Podés seguir atendiendo desde la vista de Pedidos o el Salón."
        />
      ) : (
        <div className="flex min-h-0 flex-1 snap-x gap-5 overflow-x-auto pb-5 [scrollbar-color:var(--admin-primary)_transparent] lg:h-[calc(100dvh-430px)] lg:min-h-[420px]">
          {COLUMNS.filter((column) => settings.columns[column.id]).map((column) => {
            const columnOrders = visibleOrders.filter((order) => column.statuses.includes(order.status));
            return (
              <section
                className={`w-[min(88vw,340px)] shrink-0 snap-start rounded-3xl border p-4 lg:w-auto lg:flex-1 ${column.border}`}
                key={column.id}
              >
                <header className="mb-3 flex items-center justify-between px-1 py-1">
                  <h2 className="flex items-center gap-2 font-black">
                    <span className={`h-2.5 w-2.5 rounded-full ${column.dot}`} />
                    {column.label}
                  </h2>
                  <span className="rounded-full bg-black/30 px-2.5 py-1 text-xs font-bold">
                    {columnOrders.length}
                  </span>
                </header>
                <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1 lg:max-h-[calc(100dvh-520px)] lg:min-h-[360px]">
                  {columnOrders.map((order) => (
                    <KitchenCard
                      key={order.id}
                      order={order}
                      settings={settings}
                      now={now}
                      onOpen={() => setSelected(order)}
                      onAdvance={() =>
                        column.action && void advanceOrder(order, column.action.target)
                      }
                      actionLabel={column.action?.label}
                      onCancel={() => void cancelOrder(order)}
                    />
                  ))}
                  {!columnOrders.length && (
                    <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs text-zinc-600">
                      No hay pedidos {column.label.toLocaleLowerCase("es")}.
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {selected && (
        <OrderDetailModal
          order={selected}
          userName={userName}
          onClose={() => setSelected(null)}
          onAdvance={(target) => void advanceOrder(selected, target)}
          onCancel={() => void cancelOrder(selected)}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          onChange={updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showStations && (
        <StationsModal
          stations={data.stations}
          branches={data.branches}
          activeBranchId={data.activeBranch?.id ?? null}
          onClose={() => setShowStations(false)}
          onChanged={() => void load()}
        />
      )}
    </section>
  );
}

/** @summary Tarjeta grande y táctil con la información operativa de un pedido. */
function KitchenCard({
  order,
  settings,
  now,
  onOpen,
  onAdvance,
  onCancel,
  actionLabel,
}: {
  order: KdsOrder;
  settings: KdsSettings;
  now: number;
  onOpen: () => void;
  onAdvance: () => void;
  onCancel: () => void;
  actionLabel?: string;
}) {
  const minutes = Math.max(0, Math.floor((now - new Date(order.createdAt).getTime()) / 60_000));
  const level = timerLevel(minutes, settings);
  const styles = timerStyle[level];
  const modality = modalityLabel[order.orderType] ?? order.orderType;
  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const stations = [...new Set(order.items.map((item) => item.stationName).filter(Boolean))] as string[];
  const importantNote = order.notes?.trim();

  return (
    <article
      className={`relative rounded-3xl border border-white/10 bg-zinc-950 p-5 shadow-2xl shadow-black/30 ${styles.card}`}
    >
      <button className="block w-full text-left" onClick={onOpen} type="button" aria-label={`Abrir ${order.reference}`}>
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-widest text-[var(--admin-primary)]">
              {order.reference}
            </p>
            <p className="mt-1 truncate text-lg font-black">{order.customerName}</p>
          </div>
          <span
            className={`shrink-0 rounded-xl px-3 py-1.5 text-base font-black tabular-nums ${styles.badge}`}
          >
            {elapsedLabel(order.createdAt, now)}
          </span>
        </header>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-400">
          <span className="font-bold text-zinc-200">
            {modalityIcon[order.orderType] ?? ""} {modality}
            {order.table ? ` · ${order.table.name}` : ""}
          </span>
          {order.table?.sector && <span>{order.table.sector}</span>}
          {order.waiterName && <span>· Camarero: {order.waiterName}</span>}
        </div>

        <div className="mt-3 space-y-2">
          {order.items.slice(0, 4).map((item) => {
            const extras = extrasText(item.extras);
            return (
              <div className="flex items-start gap-2.5" key={item.id}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-sm font-black">
                  {item.quantity}
                </span>
                <div className="min-w-0">
                  <p className="text-base font-bold leading-tight">{item.productName}</p>
                  {item.variantName && <p className="text-sm text-zinc-300">{item.variantName}</p>}
                  {extras && <p className="text-sm text-zinc-400">+ {extras}</p>}
                  {item.notes && <p className="text-sm italic text-amber-200/80">{item.notes}</p>}
                </div>
              </div>
            );
          })}
          {order.items.length > 4 && (
            <p className="text-sm font-bold text-zinc-500">+{order.items.length - 4} productos más</p>
          )}
          {stations.length > 0 && (
            <p className="flex flex-wrap gap-1.5 pt-0.5">
              {stations.map((station) => (
                <span
                  className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-bold text-zinc-400"
                  key={station}
                >
                  ⚙ {station}
                </span>
              ))}
            </p>
          )}
        </div>

        <p className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
          <span>{sourceName(order.source)}</span>
          <span>·</span>
          <span>{totalItems} {totalItems === 1 ? "ítem" : "ítems"}</span>
          <span>·</span>
          <span>{hourLabel(order.createdAt)}</span>
          <StatusBadge status={order.status} tone={order.status === "cancelled" ? "danger" : order.status === "delivered" ? "success" : "warning"} />
        </p>

        {importantNote && (
          <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/10 px-2.5 py-1.5 text-sm font-bold text-amber-200">
            ⚠ {importantNote.slice(0, 90)}
            {importantNote.length > 90 ? "…" : ""}
          </p>
        )}
      </button>

      <div className="mt-4 flex gap-2">
        {actionLabel && (
          <button className="btn flex-1 py-4 text-lg font-black" onClick={onAdvance} type="button">
            {actionLabel}
          </button>
        )}
        <ActionMenu
          align="right"
          items={[
            { label: "Detalle", onClick: onOpen },
            ...(order.status !== "cancelled" && order.status !== "delivered"
              ? [{ label: "Cancelar pedido", tone: "danger" as const, onClick: onCancel }]
              : []),
          ]}
        />
      </div>
    </article>
  );
}

/** @summary Detalle completo del pedido: productos, modificadores, notas, modalidad y línea de tiempo. */
function OrderDetailModal({
  order,
  userName,
  onClose,
  onAdvance,
  onCancel,
}: {
  order: KdsOrder;
  userName: string;
  onClose: () => void;
  onAdvance: (target: OrderStatus) => void;
  onCancel: () => void;
}) {
  const modality = modalityLabel[order.orderType] ?? order.orderType;
  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const current = order.status as OrderStatus;
  const canCancel = allowedTransitions(current, asOrderType(order.orderType)).includes("cancelled");

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-black/85 p-4"
      onClick={onClose}
    >
      <article
        className="w-full max-w-3xl rounded-[2rem] border border-white/10 bg-zinc-950 p-6 sm:p-8"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Pedido ${order.reference}`}
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div className="min-w-0">
            <p className="section-eyebrow">{order.reference}</p>
            <h2 className="mt-1 text-3xl font-black">{order.customerName}</h2>
            <p className="mt-1 text-sm text-zinc-400">
              {modality}
              {order.table ? ` · Mesa ${order.table.name}` : ""}
              {order.table?.sector ? ` · ${order.table.sector}` : ""} ·{" "}
              {new Date(order.createdAt).toLocaleTimeString("es-AR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-black ${statusBadge[order.status]}`}>
              {orderStatusLabel(order.status)}
            </span>
            <button
              className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-xl"
              onClick={onClose}
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
          <section className="min-w-0">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Productos · {totalItems} {totalItems === 1 ? "ítem" : "ítems"}
            </h3>
            <div className="mt-3 space-y-3">
              {order.items.map((item) => {
                const extras = extrasText(item.extras);
                return (
                  <div className="rounded-xl bg-white/[.03] p-3" key={item.id}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-base font-bold">
                        {item.quantity} × {item.productName}
                      </p>
                      <span className="shrink-0 rounded-lg bg-white/10 px-2 py-1 text-sm font-black">
                        ×{item.quantity}
                      </span>
                    </div>
                    {item.variantName && <p className="mt-1 text-sm text-zinc-300">{item.variantName}</p>}
                    {extras && <p className="mt-1 text-sm text-zinc-400">+ {extras}</p>}
                    {item.notes && <p className="mt-1 text-sm italic text-amber-200/80">{item.notes}</p>}
                    {item.stationName && (
                      <p className="mt-1 text-xs font-bold text-zinc-500">⚙ {item.stationName}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-2xl bg-white/[.03] p-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">Entrega</h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Modalidad</dt>
                  <dd className="text-right font-bold">{modality}</dd>
                </div>
                {order.table && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Mesa</dt>
                    <dd className="text-right font-bold">{order.table.name}</dd>
                  </div>
                )}
                {order.table?.sector && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Sector</dt>
                    <dd className="text-right font-bold">{order.table.sector}</dd>
                  </div>
                )}
                {order.waiterName && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Camarero</dt>
                    <dd className="text-right font-bold">{order.waiterName}</dd>
                  </div>
                )}
                {order.phone && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Teléfono</dt>
                    <dd className="text-right font-bold">{order.phone}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Origen</dt>
                  <dd className="text-right font-bold">{sourceName(order.source)}</dd>
                </div>
                {order.requestedAt && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Para</dt>
                    <dd className="text-right font-bold">{hourLabel(order.requestedAt)}</dd>
                  </div>
                )}
              </dl>
            </section>

            {order.notes && (
              <section className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-amber-300">
                  Observación del pedido
                </h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-amber-100">{order.notes}</p>
              </section>
            )}
          </aside>
        </div>

        <section className="mt-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">
            Historial de cambios
          </h3>
          {order.history.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">Sin movimientos registrados.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {order.history.map((entry) => (
                <li className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" key={entry.id}>
                  <span className="grid h-2 w-2 shrink-0 rounded-full bg-pink-500" />
                  <span className="font-bold">{orderStatusLabel(entry.toStatus)}</span>
                  <span className="text-zinc-500">{hourLabel(entry.createdAt)}</span>
                  <span className="text-zinc-600">por {entry.userName ?? "sistema"}</span>
                  {entry.note && <span className="text-zinc-400">· {entry.note}</span>}
                </li>
              ))}
            </ol>
          )}
          <p className="mt-2 text-xs text-zinc-600">
            Los próximos cambios de este dispositivo se registran con {userName}.
          </p>
        </section>

        <footer className="mt-7 grid gap-3 sm:grid-cols-2">
          {current === "received" || current === "confirmed" ? (
            <button className="btn py-4 text-lg font-black" onClick={() => onAdvance("preparing")} type="button">
              EMPEZAR PREPARACIÓN
            </button>
          ) : null}
          {current === "preparing" ? (
            <button className="btn py-4 text-lg font-black" onClick={() => onAdvance("ready")} type="button">
              MARCAR LISTO
            </button>
          ) : null}
          {current === "ready" ? (
            <button className="btn py-4 text-lg font-black" onClick={() => onAdvance("delivered")} type="button">
              ENTREGAR
            </button>
          ) : null}
          {canCancel && (
            <button
              className="btn btn-secondary py-4 text-lg font-bold text-red-300"
              onClick={onCancel}
              type="button"
            >
              Cancelar pedido
            </button>
          )}
        </footer>
      </article>
    </div>
  );
}

/** @summary Configuración del monitor: columnas visibles, sonido y umbrales de tiempo. */
function SettingsModal({
  settings,
  onChange,
  onClose,
}: {
  settings: KdsSettings;
  onChange: (settings: KdsSettings) => void;
  onClose: () => void;
}) {
  const { chime, ensureContext } = useChime(true);
  const [sound, setSound] = useState(settings.sound);
  const [onTimeMinutes, setOnTimeMinutes] = useState(settings.onTimeMinutes);
  const [criticalMinutes, setCriticalMinutes] = useState(settings.criticalMinutes);

  /** @summary Guarda los cambios y los persiste en el dispositivo. */
  function save() {
    onChange({
      columns: settings.columns,
      sound,
      onTimeMinutes: Math.min(60, Math.max(1, Math.round(onTimeMinutes || 1))),
      criticalMinutes: Math.min(120, Math.max(2, Math.round(criticalMinutes || 2))),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/85 p-4" onClick={onClose}>
      <article
        className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-zinc-950 p-6 sm:p-8"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Ajustes del monitor"
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="section-eyebrow">Monitor de cocina</p>
            <h2 className="mt-1 text-3xl font-black">Ajustes</h2>
            <p className="mt-1 text-sm text-zinc-400">
              La configuración se guarda en este dispositivo (monitor o tablet).
            </p>
          </div>
          <button
            className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-xl"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        <section className="mt-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">Columnas</h3>
          <div className="mt-3 space-y-2">
            {COLUMNS.map((column) => (
              <label
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3"
                key={column.id}
              >
                <input
                  className="h-5 w-5 accent-pink-500"
                  type="checkbox"
                  checked={settings.columns[column.id]}
                  onChange={(event) =>
                    onChange({ ...settings, columns: { ...settings.columns, [column.id]: event.target.checked } })
                  }
                />
                <span className={`h-2.5 w-2.5 rounded-full ${column.dot}`} />
                <span className="font-bold">{column.label}</span>
                <small className="ml-auto text-zinc-600">
                  {column.statuses.map(orderStatusLabel).join(" / ")}
                </small>
              </label>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">Tiempos</h3>
          <p className="mt-1 text-sm text-zinc-400">
            Desde el ingreso del pedido: a tiempo hasta el umbral de demora y crítico desde el segundo umbral.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label>
              <span className="text-sm font-bold text-zinc-300">Demorado desde</span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={60}
                  value={onTimeMinutes}
                  onChange={(event) => setOnTimeMinutes(Number(event.target.value))}
                />
                <span className="text-sm text-zinc-500">min</span>
              </div>
            </label>
            <label>
              <span className="text-sm font-bold text-zinc-300">Crítico desde</span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  className="input"
                  type="number"
                  min={2}
                  max={120}
                  value={criticalMinutes}
                  onChange={(event) => setCriticalMinutes(Number(event.target.value))}
                />
                <span className="text-sm text-zinc-500">min</span>
              </div>
            </label>
          </div>
        </section>

        <section className="mt-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">Sonido</h3>
          <p className="mt-1 text-sm text-zinc-400">
            Avisos breves generados por el navegador cuando entra un pedido o algo pasa a crítico.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3">
              <input
                className="h-5 w-5 accent-pink-500"
                type="checkbox"
                checked={sound}
                onChange={(event) => setSound(event.target.checked)}
              />
              <span className="font-bold">Activar sonido</span>
            </label>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => {
                ensureContext();
                chime("new");
                window.setTimeout(() => chime("critical"), 400);
              }}
            >
              Probar sonido
            </button>
          </div>
        </section>

        <div className="mt-7 flex gap-3">
          <button className="btn flex-1 py-4 text-lg font-black" onClick={save} type="button">
            Guardar
          </button>
          <button className="btn btn-secondary px-5" onClick={onClose} type="button">
            Cancelar
          </button>
        </div>
      </article>
    </div>
  );
}

/** @summary Gestión de estaciones de cocina: alta, edición, activación y borrado por sucursal. */
function StationsModal({
  stations,
  branches,
  activeBranchId,
  onClose,
  onChanged,
}: {
  stations: KdsStation[];
  branches: Array<{ id: number; name: string }>;
  activeBranchId: number | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [list, setList] = useState<KdsStation[]>(stations);
  const [name, setName] = useState("");
  const [type, setType] = useState("KITCHEN");
  const [busy, setBusy] = useState(false);

  const branchId = activeBranchId ?? branches[0]?.id ?? null;

  /** @summary Refresca la lista de estaciones desde el servidor. */
  async function refresh() {
    try {
      const response = await scopedFetch("/api/admin/cocina/stations", { method: "GET" });
      if (!response.ok) return;
      const body = (await response.json()) as { stations?: KdsStation[] };
      if (Array.isArray(body.stations)) setList(body.stations);
    } catch {
      /* se conserva la lista actual */
    }
  }

  /** @summary Crea una estación nueva para la sucursal activa. */
  async function create() {
    const trimmed = name.trim();
    if (!trimmed || !branchId) return;
    setBusy(true);
    try {
      const response = await scopedFetch("/api/admin/cocina/stations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId, name: trimmed, type }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudo crear la estación");
      setName("");
      setType("KITCHEN");
      await refresh();
      onChanged();
    } catch (reason) {
      await Swal.fire({
        title: "No se pudo crear",
        text: reason instanceof Error ? reason.message : "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
    } finally {
      setBusy(false);
    }
  }

  /** @summary Permite renombrar una estación desde un diálogo simple. */
  async function rename(station: KdsStation) {
    const result = await Swal.fire({
      title: "Renombrar estación",
      input: "text",
      inputValue: station.name,
      inputValidator: (value) => (value?.trim() ? null : "Ingresá un nombre"),
      showCancelButton: true,
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ec4899",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!result.isConfirmed || !result.value?.trim()) return;
    const trimmed = result.value.trim();
    if (trimmed === station.name) return;
    const response = await scopedFetch(`/api/admin/cocina/stations/${station.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      await Swal.fire({ title: "No se pudo renombrar", text: body.error ?? "Intentá nuevamente.", icon: "error", background: "#18181b", color: "#fafafa" });
      return;
    }
    await refresh();
    onChanged();
  }

  /** @summary Activa o desactiva una estación según el interruptor. */
  async function toggleActive(station: KdsStation) {
    const response = await scopedFetch(`/api/admin/cocina/stations/${station.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !station.active }),
    });
    if (response.ok) {
      await refresh();
      onChanged();
    }
  }

  /** @summary Elimina una estación después de una confirmación explícita. */
  async function remove(station: KdsStation) {
    const confirmation = await Swal.fire({
      title: `¿Eliminar ${station.name}?`,
      text: "Los productos asignados quedan sin estación; los pedidos en curso no se pierden.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmation.isConfirmed) return;
    const response = await scopedFetch(`/api/admin/cocina/stations/${station.id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      await refresh();
      onChanged();
    } else {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      await Swal.fire({ title: "No se pudo eliminar", text: body.error ?? "Intentá nuevamente.", icon: "error", background: "#18181b", color: "#fafafa" });
    }
  }

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-black/85 p-4" onClick={onClose}>
      <article
        className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-zinc-950 p-6 sm:p-8"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Estaciones de cocina"
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="section-eyebrow">Monitor de cocina</p>
            <h2 className="mt-1 text-3xl font-black">Estaciones</h2>
            <p className="mt-1 max-w-md text-sm leading-relaxed text-zinc-400">
              Cada estación agrupa las preparaciones de un sector (cocina, barra, cafetería). Los productos se
              asignan a una estación desde <strong>Productos</strong> y este monitor las usa para filtrar y, a
              futuro, rutear a impresoras o monitores dedicados.
            </p>
          </div>
          <button
            className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-xl"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.03] p-4">
          <p className="text-sm font-black text-zinc-300">
            {branches.find((branch) => branch.id === branchId)?.name ?? "Elegí una sucursal en la URL"}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <input
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nombre de la estación (ej. Parrilla)"
              maxLength={100}
              disabled={!branchId || busy}
              aria-label="Nombre de la nueva estación"
            />
            <select
              className="input sm:w-44"
              value={type}
              onChange={(event) => setType(event.target.value)}
              disabled={!branchId || busy}
              aria-label="Tipo de estación"
            >
              {Object.entries(stationTypeLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              className="btn px-5"
              onClick={() => void create()}
              type="button"
              disabled={!branchId || busy || !name.trim()}
            >
              {busy ? "Creando…" : "+ Crear"}
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          {list.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-600">
              Todavía no hay estaciones para esta sucursal. Creá la primera arriba.
            </p>
          ) : (
            list.map((station) => (
              <div
                className={`flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4 ${
                  station.active ? "" : "opacity-60"
                }`}
                key={station.id}
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/5 text-xl">
                  {stationTypeIcon[station.type] ?? "🧰"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black">{station.name}</p>
                  <p className="text-xs text-zinc-500">
                    {stationTypeLabel[station.type] ?? station.type} · {station.productCount}{" "}
                    {station.productCount === 1 ? "producto" : "productos"}
                  </p>
                </div>
                <button
                  className="btn btn-secondary px-3 py-2 text-sm"
                  onClick={() => void rename(station)}
                  type="button"
                >
                  Renombrar
                </button>
                <button
                  className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                    station.active
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-white/5 text-zinc-500 hover:text-white"
                  }`}
                  onClick={() => void toggleActive(station)}
                  type="button"
                  aria-pressed={station.active}
                >
                  {station.active ? "Activa" : "Inactiva"}
                </button>
                <button
                  className="rounded-xl bg-red-500/10 px-3 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/20"
                  onClick={() => void remove(station)}
                  type="button"
                >
                  Eliminar
                </button>
              </div>
            ))
          )}
        </div>

        <button className="btn btn-secondary mt-6 w-full" onClick={onClose} type="button">
          Cerrar
        </button>
      </article>
    </div>
  );
}
