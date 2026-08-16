"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import QRCode from "qrcode";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { scopedFetch } from "@/lib/client-routing";
import { adminHrefFromPathname } from "@/lib/routes";
import { allowedTransitions, asOrderType } from "@/lib/order-status";
import { orderStatusLabel, type OrderStatus } from "@/lib/orders";
import { tableStatusLabel, tableStatusOrder, tableStatusStyles } from "@/lib/table-status";
import type { SalonOrder, SalonPayload, SalonProduct, SalonTable } from "@/lib/salon-data";

export type SalonBoardProps = {
  initial: SalonPayload;
  canManageOrders: boolean;
};

type ModalName =
  | "open"
  | "order"
  | "bill"
  | "move"
  | "transfer"
  | "split"
  | "merge"
  | "sectors"
  | "newTable";

/** @summary Formatea un importe con la moneda de la sucursal activa. */
function money(value: number, currency: string) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(
    value || 0,
  );
}

/** @summary Describe el tiempo transcurrido desde una fecha ISO en lenguaje operativo. */
function elapsedLabel(iso: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `hace ${hours} h ${rest} min` : `hace ${hours} h`;
}

/** @summary Estado operativo de una mesa: el de su sesión abierta o "free". */
function tableStatus(table: SalonTable) {
  return table.session ? table.session.status : "free";
}

/** @summary Ejecuta una petición de API y devuelve el cuerpo parseado o lanza el error del servidor. */
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await scopedFetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body?.error ?? "No se pudo completar la operación");
  return body;
}

/** @summary Muestra un error de operación en el panel sin romper la pantalla. */
async function showError(title: string, reason: unknown) {
  await Swal.fire({
    title,
    text: reason instanceof Error ? reason.message : "Intentá nuevamente.",
    icon: "error",
    background: "#18181b",
    color: "#fafafa",
  });
}

/** @summary Tablero operativo del salón: plano con arrastre, lista, estados y flujo de mesa completo. */
export function SalonBoard({ initial, canManageOrders }: SalonBoardProps) {
  const pathname = usePathname();
  const [data, setData] = useState<SalonPayload>(initial);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"map" | "list">("map");
  const [query, setQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [layoutMode, setLayoutMode] = useState(false);
  const [selected, setSelected] = useState<SalonTable | null>(null);
  const [modal, setModal] = useState<ModalName | null>(null);
  const [overrides, setOverrides] = useState<Record<number, { x: number; y: number }>>({});

  /** @summary Refresca el salón desde el servidor conservando la mesa seleccionada. */
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const payload = await api<SalonPayload>("/api/admin/salon", { method: "GET" });
      setData(payload);
      setSelected((current) => (current ? payload.tables.find((t) => t.id === current.id) ?? null : null));
    } catch {
      /* si el refresco falla se conserva la vista actual */
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => void load(true), 20_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const counters = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const status of tableStatusOrder) counts[status] = 0;
    for (const table of data.tables) {
      const status = tableStatus(table);
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return counts;
  }, [data.tables]);

  const visibleTables = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return data.tables.filter((table) => {
      if (sectorFilter === "none" && table.sectorId !== null) return false;
      if (sectorFilter !== "all" && sectorFilter !== "none" && table.sectorId !== Number(sectorFilter)) {
        return false;
      }
      if (statusFilter !== "all" && tableStatus(table) !== statusFilter) return false;
      if (!normalized) return true;
      return `${table.name} ${table.sector ?? ""} ${table.code}`
        .toLocaleLowerCase("es")
        .includes(normalized);
    });
  }, [data.tables, query, sectorFilter, statusFilter]);

  const sectorOptions = useMemo(() => {
    const seen = new Set<number>();
    const options = data.sectors.filter((sector) => sector.active && !seen.has(sector.id) && seen.add(sector.id));
    return options.sort((a, b) => a.branchId - b.branchId || a.sortOrder - b.sortOrder);
  }, [data.sectors]);

  /** @summary Reejecuta una acción y refresca el tablero, mostrando el resultado. */
  async function runAction(action: () => Promise<unknown>, successTitle?: string) {
    try {
      await action();
      if (successTitle) {
        await Swal.fire({
          title: successTitle,
          icon: "success",
          timer: 1200,
          showConfirmButton: false,
          background: "#18181b",
          color: "#fafafa",
        });
      }
      await load();
    } catch (reason) {
      await showError("No se pudo completar", reason);
    }
  }

  /** @summary Guarda la posición de una mesa arrastrada en el plano. */
  async function commitPosition(tableId: number, x: number, y: number) {
    setOverrides((current) => ({ ...current, [tableId]: { x, y } }));
    try {
      await api(`/api/admin/tables/${tableId}/position`, {
        method: "POST",
        body: JSON.stringify({ x, y }),
      });
    } catch (reason) {
      await showError("No se pudo guardar la posición", reason);
    }
  }

  /** @summary Cambia el estado operativo manual de una sesión de mesa. */
  async function changeSessionStatus(sessionId: number, status: string) {
    await runAction(async () => {
      await api(`/api/admin/table-sessions/${sessionId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    }, "Estado actualizado");
  }

  /** @summary Avanza el estado de una comanda reutilizando el flujo de pedidos existente. */
  async function changeOrderStatus(orderId: number, status: string) {
    await runAction(async () => {
      await api(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    });
  }

  /** @summary Cierra la mesa entregando los consumos abiertos, con confirmación previa. */
  async function closeSession(sessionId: number, tableName: string, orderCount: number) {
    const confirmation = await Swal.fire({
      title: `¿Cerrar la mesa ${tableName}?`,
      text:
        orderCount > 0
          ? `${orderCount} comanda(s) en curso se marcarán como entregadas y podrás facturarlas desde Pedidos o Facturación.`
          : "La mesa quedará libre sin consumos en curso.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Cerrar mesa",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ec4899",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmation.isConfirmed) return;
    await runAction(async () => {
      await api(`/api/admin/table-sessions/${sessionId}/close`, { method: "POST" });
    }, "Mesa cerrada");
  }

  return (
    <section>
      <AdminPageHeader
        eyebrow="Operación · Salón"
        title="Salón"
        description="El plano de tus mesas con su estado en vivo: abrí mesas, cargá consumos, trasladá comensales y cerrá la cuenta desde un solo lugar."
        section="salon"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link className="btn btn-secondary" href={adminHrefFromPathname(pathname, "/admin/mesas")}>
              Mesas y QR
            </Link>
            <button
              className="btn btn-secondary"
              onClick={() => void load()}
              type="button"
              aria-label="Refrescar salón"
            >
              {loading ? "Actualizando…" : "Refrescar"}
            </button>
            <button className="btn btn-secondary" onClick={() => setModal("sectors")} type="button">
              Sectores
            </button>
            <button className="btn btn-secondary" onClick={() => setModal("newTable")} type="button">
              + Mesa
            </button>
            <button
              className={`btn ${layoutMode ? "" : "btn-secondary"}`}
              onClick={() => setLayoutMode((current) => !current)}
              type="button"
              aria-pressed={layoutMode}
            >
              {layoutMode ? "Terminar plano" : "Editar plano"}
            </button>
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {tableStatusOrder.map((status) => (
          <button
            className={`rounded-xl border px-3 py-2 text-sm font-bold transition sm:px-4 ${
              statusFilter === status
                ? "border-[var(--admin-primary)] bg-[var(--admin-primary)]/15 text-[var(--admin-primary-strong)]"
                : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"
            }`}
            key={status}
            onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
            type="button"
          >
            <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${tableStatusStyles[status].dot}`} />
            {tableStatusLabel(status)}
            <span className="ml-2 rounded-full bg-black/30 px-2 py-0.5 text-xs">{counters[status] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="block min-w-[220px] flex-1">
          <span className="sr-only">Buscar mesa</span>
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar mesa, sector o código"
            type="search"
          />
        </label>
        <select
          className="input max-w-[240px]"
          value={sectorFilter}
          onChange={(event) => setSectorFilter(event.target.value)}
          aria-label="Filtrar por sector"
        >
          <option value="all">Todos los sectores</option>
          <option value="none">Sin sector</option>
          {sectorOptions.map((sector) => (
            <option key={sector.id} value={sector.id}>
              {sector.name}
            </option>
          ))}
        </select>
        <div className="flex rounded-xl bg-white/5 p-1" role="group" aria-label="Vista del salón">
          {(["map", "list"] as const).map((option) => (
            <button
              className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                view === option ? "bg-pink-500 text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
              key={option}
              onClick={() => setView(option)}
              type="button"
            >
              {option === "map" ? "Plano" : "Lista"}
            </button>
          ))}
        </div>
      </div>

      {visibleTables.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[.02] p-10 text-center">
          <p className="text-xl font-black">No hay mesas en esta vista</p>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-500">
            Creá tus mesas desde “Mesas y QR” o con el botón “+ Mesa”, y asignales un sector para que aparezcan
            en el plano.
          </p>
          <Link className="btn mt-6" href={adminHrefFromPathname(pathname, "/admin/mesas")}>
            Ir a Mesas y QR
          </Link>
        </div>
      ) : view === "map" ? (
        <FloorMap
          tables={visibleTables}
          overrides={overrides}
          layoutMode={layoutMode}
          onSelect={setSelected}
          onPositionCommit={commitPosition}
        />
      ) : (
        <TableView
          tables={visibleTables}
          currency={data.currency}
          canManageOrders={canManageOrders}
          onSelect={setSelected}
        />
      )}

      {selected && (
        <TablePanel
          table={selected}
          currency={data.currency}
          canManageOrders={canManageOrders}
          onClose={() => setSelected(null)}
          onOpenModal={setModal}
          onChangeSessionStatus={(status) =>
            selected.session && void changeSessionStatus(selected.session.id, status)
          }
          onChangeOrderStatus={(orderId, status) => void changeOrderStatus(orderId, status)}
          onCloseSession={() => {
            if (!selected.session) return;
            void closeSession(selected.session.id, selected.name, selected.session.orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length);
          }}
        />
      )}

      {modal === "open" && selected && !selected.session && (
        <OpenTableModal
          table={selected}
          waiters={data.waiters}
          currency={data.currency}
          onClose={() => setModal(null)}
          onSaved={async (payload) => {
            await runAction(async () => {
              await api("/api/admin/table-sessions", {
                method: "POST",
                body: JSON.stringify(payload),
              });
            }, "Mesa abierta");
            setModal(null);
          }}
        />
      )}

      {modal === "order" && selected?.session && (
        <AddOrderModal
          table={selected}
          products={data.products}
          currency={data.currency}
          onClose={() => setModal(null)}
          onSaved={async (items) => {
            await runAction(async () => {
              await api(`/api/admin/table-sessions/${selected.session!.id}/orders`, {
                method: "POST",
                body: JSON.stringify({ items }),
              });
            }, "Consumo agregado");
            setModal(null);
          }}
        />
      )}

      {modal === "bill" && selected?.session && (
        <BillModal
          table={selected}
          currency={data.currency}
          canManageOrders={canManageOrders}
          onClose={() => setModal(null)}
          onCreateInvoice={() => {
            setModal(null);
            window.location.href = adminHrefFromPathname(pathname, "/admin/pedidos");
          }}
          onCloseSession={() => {
            if (!selected.session) return;
            setModal(null);
            void closeSession(selected.session.id, selected.name, selected.session.orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length);
          }}
        />
      )}

      {modal === "move" && selected?.session && (
        <MoveTableModal
          table={selected}
          tables={data.tables}
          onClose={() => setModal(null)}
          onSaved={async (targetTableId) => {
            await runAction(async () => {
              await api(`/api/admin/table-sessions/${selected.session!.id}/move`, {
                method: "POST",
                body: JSON.stringify({ targetTableId }),
              });
            }, "Mesa trasladada");
            setModal(null);
          }}
        />
      )}

      {modal === "transfer" && selected?.session && (
        <TransferOrdersModal
          table={selected}
          tables={data.tables}
          onClose={() => setModal(null)}
          onSaved={async (orderIds, targetSessionId) => {
            await runAction(async () => {
              await api(`/api/admin/table-sessions/${selected.session!.id}/transfer-orders`, {
                method: "POST",
                body: JSON.stringify({ orderIds, targetSessionId }),
              });
            }, "Comandas movidas");
            setModal(null);
          }}
        />
      )}

      {modal === "split" && selected?.session && (
        <SplitOrdersModal
          table={selected}
          tables={data.tables}
          onClose={() => setModal(null)}
          onSaved={async (orderIds, targetTableId) => {
            await runAction(async () => {
              await api(`/api/admin/table-sessions/${selected.session!.id}/split`, {
                method: "POST",
                body: JSON.stringify({ orderIds, targetTableId }),
              });
            }, "Cuenta separada");
            setModal(null);
          }}
        />
      )}

      {modal === "merge" && selected?.session && (
        <MergeTablesModal
          table={selected}
          tables={data.tables}
          onClose={() => setModal(null)}
          onSaved={async (targetSessionId) => {
            await runAction(async () => {
              await api(`/api/admin/table-sessions/${selected.session!.id}/merge`, {
                method: "POST",
                body: JSON.stringify({ targetSessionId }),
              });
            }, "Mesas unidas");
            setModal(null);
          }}
        />
      )}

      {modal === "sectors" && (
        <SectorsModal
          sectors={data.sectors}
          branches={data.branches}
          activeBranchId={data.activeBranch?.id ?? null}
          onClose={() => setModal(null)}
          onRefresh={load}
        />
      )}

      {modal === "newTable" && (
        <NewTableModal
          branches={data.branches}
          sectors={data.sectors}
          defaultBranchId={data.activeBranch?.id ?? data.tables[0]?.branchId ?? data.branches[0]?.id ?? null}
          onClose={() => setModal(null)}
          onSaved={async (payload) => {
            await runAction(async () => {
              await api("/api/admin/tables", { method: "POST", body: JSON.stringify(payload) });
            }, "Mesa creada");
            setModal(null);
          }}
        />
      )}
    </section>
  );
}

/** @summary Plano del salón: mesas posicionadas con arrastre simple en modo edición. */
function FloorMap({
  tables,
  overrides,
  layoutMode,
  onSelect,
  onPositionCommit,
}: {
  tables: SalonTable[];
  overrides: Record<number, { x: number; y: number }>;
  layoutMode: boolean;
  onSelect: (table: SalonTable) => void;
  onPositionCommit: (tableId: number, x: number, y: number) => void;
}) {
  const floorRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ tableId: number; x: number; y: number } | null>(null);
  const [moved, setMoved] = useState(false);
  const dragOffset = useRef({ dx: 0, dy: 0 });

  /** @summary Posición de la mesa: override de arrastre, guardada o grilla por defecto. */
  function positionOf(table: SalonTable) {
    const override = overrides[table.id];
    if (override) return override;
    if (table.positionX !== null && table.positionY !== null) {
      return { x: table.positionX, y: table.positionY };
    }
    const index = tables.findIndex((candidate) => candidate.id === table.id);
    const columns = 5;
    const col = index % columns;
    const row = Math.floor(index / columns);
    return { x: 12 + col * 18, y: 12 + row * 18 };
  }

  /** @summary Inicia el arrastre de una mesa en modo edición del plano. */
  function startDrag(event: React.PointerEvent, table: SalonTable) {
    if (!layoutMode || !floorRef.current) return;
    event.preventDefault();
    const rect = floorRef.current.getBoundingClientRect();
    const position = positionOf(table);
    const currentX = (rect.width * position.x) / 1000;
    const currentY = (rect.height * position.y) / 1000;
    dragOffset.current = { dx: event.clientX - currentX, dy: event.clientY - currentY };
    setDrag({ tableId: table.id, x: position.x, y: position.y });
    setMoved(false);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  /** @summary Mueve la mesa siguiendo el puntero dentro del plano. */
  function moveDrag(event: React.PointerEvent) {
    if (!drag || !floorRef.current) return;
    const rect = floorRef.current.getBoundingClientRect();
    const x = Math.min(96, Math.max(4, ((event.clientX - dragOffset.current.dx - rect.left) / rect.width) * 1000));
    const y = Math.min(96, Math.max(4, ((event.clientY - dragOffset.current.dy - rect.top) / rect.height) * 1000));
    if (Math.abs(x - drag.x) > 3 || Math.abs(y - drag.y) > 3) setMoved(true);
    setDrag({ tableId: drag.tableId, x: Math.round(x), y: Math.round(y) });
  }

  /** @summary Termina el arrastre y guarda la posición si realmente cambió. */
  function endDrag() {
    if (drag && moved) onPositionCommit(drag.tableId, drag.x, drag.y);
    setDrag(null);
    setMoved(false);
  }

  return (
    <div
      className={`relative min-h-[540px] w-full overflow-hidden rounded-3xl border border-white/10 bg-white/[.02] p-6 ${
        layoutMode ? "touch-none" : ""
      }`}
      ref={floorRef}
      role="group"
      aria-label="Plano del salón"
    >
      {layoutMode && (
        <p className="absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-black text-zinc-300 shadow-lg">
          Arrastrá las mesas para acomodar el plano
        </p>
      )}
      {tables.map((table) => {
        const position = drag?.tableId === table.id ? drag : positionOf(table);
        const status = tableStatus(table);
        const styles = tableStatusStyles[status] ?? tableStatusStyles.free;
        return (
          <button
            className={`absolute z-10 min-w-[84px] max-w-[150px] rounded-2xl border-2 px-3 py-2 text-center shadow-xl transition ${
              layoutMode ? "cursor-grab active:cursor-grabbing" : "hover:z-20 hover:scale-105"
            } ${styles.chip} ${drag?.tableId === table.id ? "ring-2 ring-white/60" : ""}`}
            style={{
              left: `${position.x / 10}%`,
              top: `${position.y / 10}%`,
              transform: "translate(-50%, -50%)",
            }}
            key={table.id}
            onClick={() => {
              if (!layoutMode) onSelect(table);
            }}
            onPointerDown={(event) => startDrag(event, table)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            type="button"
            aria-label={`Mesa ${table.name} · ${tableStatusLabel(status)}`}
          >
            <span className="block text-xl font-black leading-none">{table.name}</span>
            <span className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-wide">
              <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
              {tableStatusLabel(status)}
            </span>
            {table.session && (
              <span className="mt-1 block truncate text-[11px] font-bold text-white/70">
                {table.session.orders.length} comanda{table.session.orders.length === 1 ? "" : "s"}
                {table.session.totals.total > 0 ? ` · ${money(table.session.totals.total, "ARS")}` : ""}
              </span>
            )}
          </button>
        );
      })}
      <p className="absolute bottom-3 right-4 z-0 text-xs text-zinc-700">
        {tables.length} mesa{tables.length === 1 ? "" : "s"} en esta vista
      </p>
    </div>
  );
}

/** @summary Vista de lista alternativa con el detalle operativo de cada mesa. */
function TableView({
  tables,
  currency,
  canManageOrders,
  onSelect,
}: {
  tables: SalonTable[];
  currency: string;
  canManageOrders: boolean;
  onSelect: (table: SalonTable) => void;
}) {
  const grouped = useMemo(() => {
    const groups = new Map<string, SalonTable[]>();
    for (const table of tables) {
      const key = table.sector || "Sin sector";
      const list = groups.get(key) ?? [];
      list.push(table);
      groups.set(key, list);
    }
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right, "es"));
  }, [tables]);

  return (
    <div className="space-y-6">
      {grouped.map(([sector, sectorTables]) => (
        <section key={sector}>
          <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-zinc-500">{sector}</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sectorTables.map((table) => {
              const status = tableStatus(table);
              const styles = tableStatusStyles[status] ?? tableStatusStyles.free;
              return (
                <button
                  className="rounded-3xl border border-white/10 bg-zinc-950 p-5 text-left shadow-xl transition hover:border-white/25"
                  key={table.id}
                  onClick={() => onSelect(table)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-2xl font-black">{table.name}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {table.capacity} personas · {table.code}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${styles.chip}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
                      {tableStatusLabel(status)}
                    </span>
                  </div>
                  {table.session ? (
                    <div className="mt-4 space-y-1 border-t border-white/10 pt-3 text-sm">
                      <p className="font-bold text-zinc-200">
                        {table.session.customerName || `Mesa ${table.name}`}
                        {table.session.partySize > 1 ? ` · ${table.session.partySize} personas` : ""}
                      </p>
                      <p className="text-zinc-500">
                        {table.session.orders.length} comanda{table.session.orders.length === 1 ? "" : "s"} ·{" "}
                        {money(table.session.totals.total, table.session.orders[0]?.currency ?? currency)}
                      </p>
                      <p className="text-xs text-zinc-600">
                        Abierta {elapsedLabel(table.session.openedAt)}
                        {table.session.waiter ? ` · ${table.session.waiter.name}` : ""}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-4 border-t border-white/10 pt-3 text-sm font-bold text-emerald-300">
                      {canManageOrders ? "Tocá para abrir la mesa" : "Mesa disponible"}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/** @summary Panel de una mesa: abrir, gestionar consumos, traslados, precuenta, cierre y timeline. */
function TablePanel({
  table,
  currency,
  canManageOrders,
  onClose,
  onOpenModal,
  onChangeSessionStatus,
  onChangeOrderStatus,
  onCloseSession,
}: {
  table: SalonTable;
  currency: string;
  canManageOrders: boolean;
  onClose: () => void;
  onOpenModal: (modal: ModalName) => void;
  onChangeSessionStatus: (status: string) => void;
  onChangeOrderStatus: (orderId: number, status: string) => void;
  onCloseSession: () => void;
}) {
  const session = table.session;
  const status = tableStatus(table);
  const [qr, setQr] = useState("");
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(`${window.location.origin}/mesa/${encodeURIComponent(table.code)}`, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: "H",
      color: { dark: "#09090b", light: "#ffffff" },
    }).then((url) => {
      if (active) setQr(url);
    });
    return () => {
      active = false;
    };
  }, [table.code]);

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-black/80 p-4 backdrop-blur"
      onClick={onClose}
    >
      <article
        className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Mesa ${table.name}`}
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="section-eyebrow">
                {table.sector || "Sin sector"} · {table.capacity} personas
              </p>
              <StatusBadge status={status} />
            </div>
            <h2 className="mt-2 text-3xl font-black">{table.name}</h2>
            {session && (
              <p className="mt-1 text-sm text-zinc-400">
                Abierta {elapsedLabel(session.openedAt)} · {new Date(session.openedAt).toLocaleString("es-AR")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden h-20 w-20 overflow-hidden rounded-xl bg-white p-1 sm:block">
              {qr ? (
                <Image src={qr} alt={`QR de ${table.name}`} width={80} height={80} unoptimized />
              ) : (
                <span className="grid h-full place-items-center text-[10px] text-black">QR</span>
              )}
            </div>
            <button
              className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-xl"
              onClick={onClose}
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        </header>

        {!session ? (
          <div className="mt-6">
            <p className="text-sm leading-relaxed text-zinc-400">
              Esta mesa está libre. El código QR sigue asociado a esta mesa: los clientes que lo escaneen
              llegan directo a la carta de esta sucursal.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="btn" onClick={() => onOpenModal("open")} type="button">
                Abrir mesa
              </button>
            </div>
          </div>
        ) : (
          <>
            <section className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl bg-white/5 p-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">Comensales</h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Cliente</dt>
                    <dd className="text-right font-bold">{session.customerName || "Sin asignar"}</dd>
                  </div>
                  {session.phone && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-zinc-500">Teléfono</dt>
                      <dd className="text-right font-bold">{session.phone}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Comensales</dt>
                    <dd className="text-right font-bold">{session.partySize}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Camarero</dt>
                    <dd className="text-right font-bold">{session.waiter?.name ?? "Sin asignar"}</dd>
                  </div>
                  {session.notes && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-zinc-500">Nota</dt>
                      <dd className="text-right font-bold">{session.notes}</dd>
                    </div>
                  )}
                </dl>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">Consumo</h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Comandas</dt>
                    <dd className="text-right font-bold">{session.orders.length}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Productos</dt>
                    <dd className="text-right font-bold">{session.totals.itemCount}</dd>
                  </div>
                  <div className="flex justify-between gap-4 text-lg">
                    <dt className="text-zinc-400">Total</dt>
                    <dd className="font-black">{money(session.totals.total, currency)}</dd>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <label className="text-xs text-zinc-500" htmlFor="session-status">
                      Estado manual:
                    </label>
                    <select
                      className="input flex-1 py-1.5 text-sm"
                      id="session-status"
                      value={session.status}
                      onChange={(event) => onChangeSessionStatus(event.target.value)}
                    >
                      {["reserved", "occupied", "awaiting_order", "preparing", "ready_to_bill"].map(
                        (candidate) => (
                          <option key={candidate} value={candidate}>
                            {tableStatusLabel(candidate)}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                </dl>
              </div>
            </section>

            <section className="mt-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">
                  Comandas ({session.orders.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {canManageOrders && (
                    <button className="btn" onClick={() => onOpenModal("order")} type="button">
                      + Agregar consumo
                    </button>
                  )}
                  <button className="btn btn-secondary" onClick={() => onOpenModal("bill")} type="button">
                    Precuenta
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-3">
                {session.orders.map((order) => (
                  <ComandaCard
                    key={order.id}
                    order={order}
                    currency={order.currency || currency}
                    canManageOrders={canManageOrders}
                    onStatusChange={(status) => onChangeOrderStatus(order.id, status)}
                  />
                ))}
              </div>
            </section>

            <section className="mt-7">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">Historial</h3>
              <ol className="mt-3 space-y-0">
                {session.events.map((event, index) => (
                  <li className="relative flex gap-3 pb-4 pl-5 last:pb-0" key={event.id}>
                    <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--admin-primary)]" />
                    {index < session.events.length - 1 && (
                      <span className="absolute left-[4px] top-4 h-full w-px bg-white/10" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{event.note || eventLabel(event.eventType)}</p>
                      <p className="text-xs text-zinc-500">
                        {new Date(event.createdAt).toLocaleTimeString("es-AR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {event.userName ? ` · ${event.userName}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <footer className="mt-7 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-2 lg:grid-cols-3">
              <button className="btn btn-secondary" onClick={() => onOpenModal("move")} type="button">
                Trasladar mesa
              </button>
              <button className="btn btn-secondary" onClick={() => onOpenModal("transfer")} type="button">
                Mover comandas
              </button>
              <button className="btn btn-secondary" onClick={() => onOpenModal("split")} type="button">
                Separar comandas
              </button>
              <button className="btn btn-secondary" onClick={() => onOpenModal("merge")} type="button">
                Unir con otra mesa
              </button>
              <button
                className="btn btn-secondary"
                disabled
                title="Dividir cuenta por producto o comensal estará disponible próximamente."
                type="button"
              >
                Dividir cuenta · Próximamente
              </button>
              {canManageOrders && (
                <button className="btn" onClick={onCloseSession} type="button">
                  Cerrar mesa
                </button>
              )}
            </footer>
          </>
        )}
      </article>
    </div>
  );
}

/** @summary Etiquetas humanas de los eventos del timeline de una mesa. */
function eventLabel(eventType: string) {
  const labels: Record<string, string> = {
    opened: "Mesa abierta",
    reserved: "Mesa reservada",
    order_added: "Consumo agregado",
    order_status: "Cambio de estado de comanda",
    status_changed: "Estado cambiado",
    updated: "Datos actualizados",
    table_moved: "Mesa trasladada",
    orders_moved_out: "Comandas movidas a otra mesa",
    orders_moved_in: "Comandas recibidas de otra mesa",
    split_from: "Cuenta separada",
    merged: "Mesa unida",
    merged_into: "Unida a otra mesa",
    closed: "Mesa cerrada",
  };
  return labels[eventType] ?? eventType;
}

/** @summary Insignia de estado de mesa con su color operativo. */
function StatusBadge({ status }: { status: string }) {
  const styles = tableStatusStyles[status] ?? tableStatusStyles.free;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${styles.chip}`}
    >
      <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
      {tableStatusLabel(status)}
    </span>
  );
}

/** @summary Tarjeta de una comanda con sus productos y avance de estado. */
function ComandaCard({
  order,
  currency,
  canManageOrders,
  onStatusChange,
}: {
  order: SalonOrder;
  currency: string;
  canManageOrders: boolean;
  onStatusChange: (status: string) => void;
}) {
  const next = allowedTransitions(order.status as OrderStatus, asOrderType("dine_in")).find(
    (status) => status !== "cancelled",
  );
  return (
    <div className="rounded-2xl bg-white/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-black uppercase tracking-wider text-[var(--admin-primary)]">
            {order.reference}
          </p>
          <StatusBadge status={order.status} />
          <span className="text-xs text-zinc-500">{elapsedLabel(order.createdAt)}</span>
        </div>
        <strong>{money(order.total, currency)}</strong>
      </div>
      <div className="mt-3 space-y-1.5">
        {order.items.map((item) => (
          <p className="text-sm" key={item.id}>
            <strong>
              {item.quantity} × {item.productName}
            </strong>
            {item.variantName ? <span className="text-zinc-400"> · {item.variantName}</span> : null}
            {Array.isArray(item.extras) && item.extras.length > 0 ? (
              <span className="text-zinc-500">
                {" "}
                · +{" "}
                {(item.extras as Array<{ name?: string }>)
                  .map((extra) => extra.name ?? "")
                  .filter(Boolean)
                  .join(", ")}
              </span>
            ) : null}
            {item.notes ? <span className="italic text-zinc-500"> · {item.notes}</span> : null}
          </p>
        ))}
      </div>
      {canManageOrders && order.status !== "delivered" && order.status !== "cancelled" && (
        <div className="mt-3 flex gap-2">
          {next && (
            <button className="btn flex-1 py-1.5 text-xs" onClick={() => onStatusChange(next)} type="button">
              {next === "confirmed"
                ? "Confirmar"
                : next === "preparing"
                  ? "Empezar"
                  : next === "ready"
                    ? "Marcar listo"
                    : "Entregar"}
            </button>
          )}
          <select
            className="input flex-1 py-1.5 text-xs"
            value={order.status}
            onChange={(event) => onStatusChange(event.target.value)}
            aria-label={`Estado de ${order.reference}`}
          >
            <option value={order.status}>{orderStatusLabel(order.status)}</option>
            {allowedTransitions(order.status as OrderStatus, asOrderType("dine_in")).map((candidate) => (
              <option key={candidate} value={candidate}>
                {orderStatusLabel(candidate)}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

/** @summary Formulario para abrir una mesa con cliente, comensales y camarero opcionales. */
function OpenTableModal({
  table,
  waiters,
  currency,
  onClose,
  onSaved,
}: {
  table: SalonTable;
  waiters: SalonPayload["waiters"];
  currency: string;
  onClose: () => void;
  onSaved: (payload: {
    tableId: number;
    customerName: string;
    phone: string;
    partySize: number;
    waiterUserId: number | null;
    notes: string;
    reserved: boolean;
  }) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      await onSaved({
        tableId: table.id,
        customerName: String(form.get("customerName") ?? ""),
        phone: String(form.get("phone") ?? ""),
        partySize: Number(form.get("partySize") ?? 1),
        waiterUserId: Number(form.get("waiterUserId")) || null,
        notes: String(form.get("notes") ?? ""),
        reserved: form.get("reserved") === "on",
      });
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <Overlay title={`Abrir mesa ${table.name}`} onClose={onClose} wide={false}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">Cliente (opcional)</span>
            <input className="input" name="customerName" maxLength={160} placeholder="Nombre del cliente" />
          </label>
          <label>
            <span className="label">Teléfono (opcional)</span>
            <input className="input" name="phone" maxLength={60} placeholder="+54 ..." />
          </label>
          <label>
            <span className="label">Comensales</span>
            <input
              className="input"
              name="partySize"
              type="number"
              min={1}
              max={100}
              defaultValue={1}
              required
            />
          </label>
          <label>
            <span className="label">Camarero responsable</span>
            <select className="input" name="waiterUserId" defaultValue="">
              <option value="">Sin asignar</option>
              {waiters.map((waiter) => (
                <option key={waiter.id} value={waiter.id}>
                  {waiter.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          <span className="label">Nota interna</span>
          <input className="input" name="notes" maxLength={2000} placeholder="Ej.: mesa cerca de la ventana" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input name="reserved" type="checkbox" /> Marcar como reservada (la mesa queda apartada)
        </label>
        <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
          <button className="btn btn-secondary" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="btn" disabled={submitting} type="submit">
            {submitting ? "Abriendo…" : "Abrir mesa"}
          </button>
        </div>
        <p className="text-xs text-zinc-600">La mesa quedará asociada a {table.code} · {currency}.</p>
      </form>
    </Overlay>
  );
}

/** @summary Modal para cargar un consumo a la mesa con búsqueda de productos y opciones. */
function AddOrderModal({
  table,
  products,
  currency,
  onClose,
  onSaved,
}: {
  table: SalonTable;
  products: SalonPayload["products"];
  currency: string;
  onClose: () => void;
  onSaved: (items: Array<{
    productId: number;
    quantity: number;
    variantId: number | null;
    extraIds: number[];
    notes?: string;
  }>) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<SalonProduct | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [variantId, setVariantId] = useState<number | null>(null);
  const [extraIds, setExtraIds] = useState<number[]>([]);
  const [note, setNote] = useState("");
  const [cart, setCart] = useState<
    Array<{
      productId: number;
      name: string;
      quantity: number;
      variantId: number | null;
      variantName: string | null;
      variantPrice: number;
      extraIds: number[];
      extrasTotal: number;
      lineTotal: number;
      note: string;
    }>
  >([]);
  const [submitting, setSubmitting] = useState(false);

  const branchProducts = useMemo(
    () => products.filter((product) => product.branchIds.includes(table.branchId ?? -1)),
    [products, table.branchId],
  );
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    const filtered = normalized
      ? branchProducts.filter((product) => product.name.toLocaleLowerCase("es").includes(normalized))
      : branchProducts;
    return filtered.slice(0, 60);
  }, [branchProducts, query]);

  function productPrice(product: SalonProduct, selectedVariantId: number | null, selectedExtras: number[]) {
    const base = product.promotionalPrice ?? product.price;
    const variant = product.variants.find((item) => item.id === selectedVariantId);
    const extrasTotal = product.extras
      .filter((extra) => selectedExtras.includes(extra.id))
      .reduce((sum, extra) => sum + extra.price, 0);
    return base + (variant?.priceAdjustment ?? 0) + extrasTotal;
  }

  function openDetail(product: SalonProduct) {
    setDetail(product);
    setQuantity(1);
    setVariantId(null);
    setExtraIds([]);
    setNote("");
  }

  function toggleExtra(extraId: number) {
    setExtraIds((current) => (current.includes(extraId) ? current.filter((id) => id !== extraId) : [...current, extraId]));
  }

  function addToCart() {
    if (!detail) return;
    const unitPrice = productPrice(detail, variantId, extraIds);
    setCart((current) => [
      ...current,
      {
        productId: detail.id,
        name: detail.name,
        quantity,
        variantId,
        variantName: detail.variants.find((item) => item.id === variantId)?.name ?? null,
        variantPrice: detail.variants.find((item) => item.id === variantId)?.priceAdjustment ?? 0,
        extraIds,
        extrasTotal: unitPrice - (detail.promotionalPrice ?? detail.price) - (detail.variants.find((item) => item.id === variantId)?.priceAdjustment ?? 0),
        lineTotal: unitPrice * quantity,
        note,
      },
    ]);
    setDetail(null);
  }

  async function confirm() {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      await onSaved(
        cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          variantId: item.variantId,
          extraIds: item.extraIds,
          notes: item.note || undefined,
        })),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);

  return (
    <Overlay title={`Consumo en ${table.name}`} onClose={onClose} wide>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <label className="mb-3 block">
            <span className="sr-only">Buscar productos</span>
            <input
              className="input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar producto de la carta…"
              type="search"
            />
          </label>
          <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
            {visible.map((product) => (
              <button
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-3 text-left transition hover:border-white/25"
                key={product.id}
                onClick={() => openDetail(product)}
                type="button"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold">{product.name}</p>
                  <p className="text-xs text-zinc-500">
                    {product.variants.length} variante{product.variants.length === 1 ? "" : "s"}
                    {product.extras.length > 0 ? ` · ${product.extras.length} agregados` : ""}
                  </p>
                </div>
                <strong className="shrink-0">{money(product.promotionalPrice ?? product.price, currency)}</strong>
              </button>
            ))}
            {visible.length === 0 && (
              <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-600">
                Sin resultados para esta búsqueda.
              </p>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          {detail ? (
            <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-black">{detail.name}</h3>
                <button className="text-zinc-500" onClick={() => setDetail(null)} type="button" aria-label="Volver">
                  ←
                </button>
              </div>
              {detail.variants.length > 0 && (
                <label className="mt-3 block">
                  <span className="label">Presentación</span>
                  <select
                    className="input"
                    value={variantId ?? ""}
                    onChange={(event) => setVariantId(event.target.value ? Number(event.target.value) : null)}
                  >
                    <option value="">Elegir…</option>
                    {detail.variants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.name}
                        {variant.priceAdjustment ? ` (+${money(variant.priceAdjustment, currency)})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {detail.extras.length > 0 && (
                <div className="mt-3">
                  <span className="label">Agregados</span>
                  <div className="mt-2 space-y-1.5">
                    {detail.extras.map((extra) => (
                      <label className="flex items-center gap-2 text-sm" key={extra.id}>
                        <input
                          type="checkbox"
                          checked={extraIds.includes(extra.id)}
                          onChange={() => toggleExtra(extra.id)}
                        />
                        {extra.name}
                        {extra.price > 0 ? ` (+${money(extra.price, currency)})` : ""}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-3 flex items-center gap-3">
                <label className="block">
                  <span className="label">Cantidad</span>
                  <input
                    className="input w-24"
                    type="number"
                    min={1}
                    max={30}
                    value={quantity}
                    onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                  />
                </label>
                <div className="ml-auto">
                  <p className="text-xs text-zinc-500">Subtotal</p>
                  <p className="text-lg font-black">
                    {money(productPrice(detail, variantId, extraIds) * quantity, currency)}
                  </p>
                </div>
              </div>
              <label className="mt-3 block">
                <span className="label">Nota (opcional)</span>
                <input className="input" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="Ej.: sin cebolla" />
              </label>
              <button className="btn mt-4 w-full" onClick={addToCart} type="button">
                Agregar a la comanda
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-sm text-zinc-500">
              Elegí un producto para configurar variantes y agregados.
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">Comanda ({cart.length})</h3>
            <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
              {cart.map((item, index) => (
                <p className="flex items-start justify-between gap-2 text-sm" key={`${item.productId}-${index}`}>
                  <span className="min-w-0">
                    <strong>{item.quantity} × {item.name}</strong>
                    {item.variantName ? <span className="text-zinc-400"> · {item.variantName}</span> : null}
                  </span>
                  <span className="shrink-0 font-bold">{money(item.lineTotal, currency)}</span>
                </p>
              ))}
              {cart.length === 0 && <p className="text-xs text-zinc-600">Todavía sin productos.</p>}
            </div>
            <p className="mt-3 flex justify-between border-t border-white/10 pt-3 text-lg">
              <span className="text-zinc-400">Total</span>
              <strong>{money(cartTotal, currency)}</strong>
            </p>
            <button className="btn mt-3 w-full" disabled={cart.length === 0 || submitting} onClick={() => void confirm()} type="button">
              {submitting ? "Cargando…" : "Confirmar comanda"}
            </button>
          </div>
        </aside>
      </div>
    </Overlay>
  );
}

/** @summary Precuenta digital de la mesa con las comandas y el total, sin facturación fiscal. */
function BillModal({
  table,
  currency,
  canManageOrders,
  onClose,
  onCreateInvoice,
  onCloseSession,
}: {
  table: SalonTable;
  currency: string;
  canManageOrders: boolean;
  onClose: () => void;
  onCreateInvoice: () => void;
  onCloseSession: () => void;
}) {
  const session = table.session!;
  const openOrders = session.orders.filter((order) => !["delivered", "cancelled"].includes(order.status));
  return (
    <Overlay title={`Precuenta · ${table.name}`} onClose={onClose} wide={false}>
      <div className="space-y-4">
        <div className="space-y-3">
          {session.orders.map((order) => (
            <div className="rounded-2xl bg-white/5 p-4" key={order.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-wider text-[var(--admin-primary)]">
                  {order.reference}
                </p>
                <StatusBadge status={order.status} />
              </div>
              <div className="mt-2 space-y-1 text-sm">
                {order.items.map((item) => (
                  <p className="flex justify-between gap-3" key={item.id}>
                    <span>
                      {item.quantity} × {item.productName}
                    </span>
                    <span className="font-bold">{money(item.lineTotal, order.currency || currency)}</span>
                  </p>
                ))}
              </div>
              <p className="mt-2 flex justify-between border-t border-white/10 pt-2 font-bold">
                <span>Comanda</span>
                <span>{money(order.total, order.currency || currency)}</span>
              </p>
            </div>
          ))}
          {session.orders.length === 0 && (
            <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">
              Todavía no hay consumos en esta mesa.
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-white/5 p-4 text-sm">
          <p className="flex justify-between">
            <span className="text-zinc-500">Productos</span>
            <strong>{session.totals.itemCount}</strong>
          </p>
          <p className="mt-2 flex justify-between border-t border-white/10 pt-2 text-lg">
            <span className="text-zinc-400">Total a cobrar</span>
            <strong>{money(session.totals.total, currency)}</strong>
          </p>
          <p className="mt-2 text-xs text-zinc-600">
            Esta es una precuenta en pantalla. La facturación fiscal no está incluida; podés generar el
            comprobante interno desde Pedidos o Facturación.
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn btn-secondary" onClick={onCreateInvoice} type="button">
            Ir a Pedidos
          </button>
          <button className="btn btn-secondary" disabled title="Dividir cuenta estará disponible próximamente." type="button">
            Dividir cuenta
          </button>
          {canManageOrders && (
            <button className="btn" onClick={onCloseSession} type="button">
              {openOrders.length > 0 ? "Entregar y cerrar mesa" : "Cerrar mesa"}
            </button>
          )}
        </div>
      </div>
    </Overlay>
  );
}

/** @summary Traslada la mesa (sesión + consumos) a otra mesa libre de la misma sucursal. */
function MoveTableModal({
  table,
  tables,
  onClose,
  onSaved,
}: {
  table: SalonTable;
  tables: SalonTable[];
  onClose: () => void;
  onSaved: (targetTableId: number) => Promise<void>;
}) {
  const [targetId, setTargetId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const candidates = tables.filter(
    (candidate) => !candidate.session && candidate.id !== table.id && candidate.branchId === table.branchId,
  );
  async function confirm() {
    if (!targetId) return;
    setSubmitting(true);
    try {
      await onSaved(targetId);
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <Overlay title={`Trasladar ${table.name}`} onClose={onClose} wide={false}>
      <p className="mb-4 text-sm text-zinc-400">
        La sesión y sus comandas abiertas pasan a la mesa elegida. El destino debe estar libre y pertenecer a
        la misma sucursal.
      </p>
      <select className="input mb-4" value={targetId ?? ""} onChange={(event) => setTargetId(event.target.value ? Number(event.target.value) : null)}>
        <option value="">Elegí la mesa destino…</option>
        {candidates.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.name} · {candidate.sector || "Sin sector"}
          </option>
        ))}
      </select>
      {candidates.length === 0 && (
        <p className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-sm text-zinc-500">
          No hay mesas libres en esta sucursal para trasladar.
        </p>
      )}
      <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
        <button className="btn btn-secondary" onClick={onClose} type="button">
          Cancelar
        </button>
        <button className="btn" disabled={!targetId || submitting} onClick={() => void confirm()} type="button">
          {submitting ? "Trasladando…" : "Trasladar mesa"}
        </button>
      </div>
    </Overlay>
  );
}

/** @summary Mueve comandas seleccionadas a otra mesa abierta de la misma sucursal. */
function TransferOrdersModal({
  table,
  tables,
  onClose,
  onSaved,
}: {
  table: SalonTable;
  tables: SalonTable[];
  onClose: () => void;
  onSaved: (orderIds: number[], targetSessionId: number) => Promise<void>;
}) {
  const session = table.session!;
  const openOrders = session.orders.filter((order) => !["delivered", "cancelled"].includes(order.status));
  const [selected, setSelected] = useState<number[]>([]);
  const [targetSessionId, setTargetSessionId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const targets = tables.flatMap((candidate) =>
    candidate.session && candidate.session.id !== session.id && candidate.branchId === table.branchId
      ? [{ tableId: candidate.id, tableName: candidate.name, sessionId: candidate.session.id }]
      : [],
  );
  function toggle(orderId: number) {
    setSelected((current) => (current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId]));
  }
  async function confirm() {
    if (selected.length === 0 || !targetSessionId) return;
    setSubmitting(true);
    try {
      await onSaved(selected, targetSessionId);
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <Overlay title={`Mover comandas de ${table.name}`} onClose={onClose} wide>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-zinc-500">Comandas a mover</h3>
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {openOrders.map((order) => (
              <label
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-3 text-sm"
                key={order.id}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(order.id)}
                  onChange={() => toggle(order.id)}
                />
                <span className="min-w-0">
                  <strong>{order.reference}</strong>
                  <span className="ml-2 text-zinc-500">{order.items.reduce((n, item) => n + item.quantity, 0)} productos</span>
                </span>
              </label>
            ))}
            {openOrders.length === 0 && (
              <p className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-sm text-zinc-500">
                No hay comandas abiertas para mover.
              </p>
            )}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-zinc-500">Mesa destino</h3>
          <select
            className="input"
            value={targetSessionId ?? ""}
            onChange={(event) => setTargetSessionId(event.target.value ? Number(event.target.value) : null)}
          >
            <option value="">Elegí la mesa destino…</option>
            {targets.map((target) => (
              <option key={target.sessionId} value={target.sessionId}>
                {target.tableName}
              </option>
            ))}
          </select>
          {targets.length === 0 && (
            <p className="mt-3 rounded-2xl border border-dashed border-white/10 p-4 text-center text-sm text-zinc-500">
              No hay otras mesas abiertas en esta sucursal.
            </p>
          )}
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2 border-t border-white/10 pt-4">
        <button className="btn btn-secondary" onClick={onClose} type="button">
          Cancelar
        </button>
        <button
          className="btn"
          disabled={selected.length === 0 || !targetSessionId || submitting}
          onClick={() => void confirm()}
          type="button"
        >
          {submitting ? "Moviendo…" : `Mover ${selected.length} comanda${selected.length === 1 ? "" : "s"}`}
        </button>
      </div>
    </Overlay>
  );
}

/** @summary Separa la cuenta moviendo comandas a una mesa libre de la misma sucursal. */
function SplitOrdersModal({
  table,
  tables,
  onClose,
  onSaved,
}: {
  table: SalonTable;
  tables: SalonTable[];
  onClose: () => void;
  onSaved: (orderIds: number[], targetTableId: number) => Promise<void>;
}) {
  const session = table.session!;
  const openOrders = session.orders.filter((order) => !["delivered", "cancelled"].includes(order.status));
  const [selected, setSelected] = useState<number[]>([]);
  const [targetTableId, setTargetTableId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const candidates = tables.filter(
    (candidate) => !candidate.session && candidate.id !== table.id && candidate.branchId === table.branchId,
  );
  function toggle(orderId: number) {
    setSelected((current) => (current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId]));
  }
  async function confirm() {
    if (selected.length === 0 || !targetTableId) return;
    setSubmitting(true);
    try {
      await onSaved(selected, targetTableId);
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <Overlay title={`Separar comandas de ${table.name}`} onClose={onClose} wide>
      <p className="mb-4 text-sm text-zinc-400">
        Las comandas seleccionadas pasan a una mesa libre como una nueva sesión. Ideal para separar cuentas
        de un grupo.
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-zinc-500">Comandas a separar</h3>
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {openOrders.map((order) => (
              <label
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-3 text-sm"
                key={order.id}
              >
                <input type="checkbox" checked={selected.includes(order.id)} onChange={() => toggle(order.id)} />
                <span className="min-w-0">
                  <strong>{order.reference}</strong>
                  <span className="ml-2 text-zinc-500">{money(order.total, order.currency)}</span>
                </span>
              </label>
            ))}
            {openOrders.length === 0 && (
              <p className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-sm text-zinc-500">
                No hay comandas abiertas para separar.
              </p>
            )}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-zinc-500">Mesa libre destino</h3>
          <select
            className="input"
            value={targetTableId ?? ""}
            onChange={(event) => setTargetTableId(event.target.value ? Number(event.target.value) : null)}
          >
            <option value="">Elegí la mesa libre…</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} · {candidate.sector || "Sin sector"}
              </option>
            ))}
          </select>
          {candidates.length === 0 && (
            <p className="mt-3 rounded-2xl border border-dashed border-white/10 p-4 text-center text-sm text-zinc-500">
              No hay mesas libres en esta sucursal para separar.
            </p>
          )}
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2 border-t border-white/10 pt-4">
        <button className="btn btn-secondary" onClick={onClose} type="button">
          Cancelar
        </button>
        <button
          className="btn"
          disabled={selected.length === 0 || !targetTableId || submitting}
          onClick={() => void confirm()}
          type="button"
        >
          {submitting ? "Separando…" : "Separar cuenta"}
        </button>
      </div>
    </Overlay>
  );
}

/** @summary Une la mesa con otra abierta: los consumos pasan al destino y esta se cierra. */
function MergeTablesModal({
  table,
  tables,
  onClose,
  onSaved,
}: {
  table: SalonTable;
  tables: SalonTable[];
  onClose: () => void;
  onSaved: (targetSessionId: number) => Promise<void>;
}) {
  const session = table.session!;
  const [targetSessionId, setTargetSessionId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const targets = tables.flatMap((candidate) =>
    candidate.session && candidate.session.id !== session.id && candidate.branchId === table.branchId
      ? [{ tableName: candidate.name, sessionId: candidate.session.id }]
      : [],
  );
  async function confirm() {
    if (!targetSessionId) return;
    setSubmitting(true);
    try {
      await onSaved(targetSessionId);
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <Overlay title={`Unir ${table.name} con otra mesa`} onClose={onClose} wide={false}>
      <p className="mb-4 text-sm text-zinc-400">
        Todos los consumos de {table.name} pasan a la mesa elegida y esta queda libre. La cuenta se junta en
        un solo lugar.
      </p>
      <select
        className="input mb-4"
        value={targetSessionId ?? ""}
        onChange={(event) => setTargetSessionId(event.target.value ? Number(event.target.value) : null)}
      >
        <option value="">Elegí la mesa que junta la cuenta…</option>
        {targets.map((target) => (
          <option key={target.sessionId} value={target.sessionId}>
            {target.tableName}
          </option>
        ))}
      </select>
      {targets.length === 0 && (
        <p className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-sm text-zinc-500">
          No hay otras mesas abiertas en esta sucursal para unir.
        </p>
      )}
      <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
        <button className="btn btn-secondary" onClick={onClose} type="button">
          Cancelar
        </button>
        <button className="btn" disabled={!targetSessionId || submitting} onClick={() => void confirm()} type="button">
          {submitting ? "Uniendo…" : "Unir mesas"}
        </button>
      </div>
    </Overlay>
  );
}

/** @summary Administra los sectores configurables del salón por sucursal. */
function SectorsModal({
  sectors,
  branches,
  activeBranchId,
  onClose,
  onRefresh,
}: {
  sectors: SalonPayload["sectors"];
  branches: SalonPayload["branches"];
  activeBranchId: number | null;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [branchId, setBranchId] = useState<number | null>(activeBranchId ?? branches[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const branchName = (id: number) => branches.find((branch) => branch.id === id)?.name ?? `Sucursal ${id}`;

  async function run(action: () => Promise<unknown>, success?: string) {
    setBusy(true);
    try {
      await action();
      await onRefresh();
      if (success) {
        await Swal.fire({
          title: success,
          icon: "success",
          timer: 1000,
          showConfirmButton: false,
          background: "#18181b",
          color: "#fafafa",
        });
      }
    } catch (reason) {
      await showError("No se pudo completar", reason);
    } finally {
      setBusy(false);
    }
  }

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!branchId) return;
    await run(async () => {
      await api("/api/admin/table-sectors", { method: "POST", body: JSON.stringify({ branchId, name }) });
    }, "Sector creado");
    setName("");
  }

  async function rename(sector: SalonPayload["sectors"][number]) {
    const result = await Swal.fire({
      title: "Renombrar sector",
      input: "text",
      inputValue: sector.name,
      showCancelButton: true,
      confirmButtonText: "Guardar",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!result.value || result.value === sector.name) return;
    await run(async () => {
      await api(`/api/admin/table-sectors/${sector.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: result.value }),
      });
    }, "Sector actualizado");
  }

  async function toggle(sector: SalonPayload["sectors"][number]) {
    await run(async () => {
      await api(`/api/admin/table-sectors/${sector.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !sector.active }),
      });
    });
  }

  async function remove(sector: SalonPayload["sectors"][number]) {
    const confirmation = await Swal.fire({
      title: `¿Eliminar ${sector.name}?`,
      text: "Las mesas del sector se conservan pero quedan sin sector asignado.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmation.isConfirmed) return;
    await run(async () => {
      await api(`/api/admin/table-sectors/${sector.id}`, { method: "DELETE" });
    }, "Sector eliminado");
  }

  async function reorder(sector: SalonPayload["sectors"][number], direction: -1 | 1) {
    const siblings = [...sectors]
      .filter((candidate) => candidate.branchId === sector.branchId && candidate.active)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const index = siblings.findIndex((candidate) => candidate.id === sector.id);
    const neighbor = siblings[index + direction];
    if (!neighbor) return;
    await run(async () => {
      await Promise.all([
        api(`/api/admin/table-sectors/${sector.id}`, {
          method: "PATCH",
          body: JSON.stringify({ sortOrder: neighbor.sortOrder }),
        }),
        api(`/api/admin/table-sectors/${neighbor.id}`, {
          method: "PATCH",
          body: JSON.stringify({ sortOrder: sector.sortOrder }),
        }),
      ]);
    });
  }

  return (
    <Overlay title="Sectores del salón" onClose={onClose} wide>
      <form className="mb-6 grid gap-3 sm:grid-cols-[1fr_220px_auto]" onSubmit={add}>
        <label>
          <span className="label">Nombre del sector</span>
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej.: Terraza, Barra, Salón"
            maxLength={100}
            required
          />
        </label>
        <label>
          <span className="label">Sucursal</span>
          <select className="input" value={branchId ?? ""} onChange={(event) => setBranchId(event.target.value ? Number(event.target.value) : null)}>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn self-end" disabled={busy || !branchId} type="submit">
          Agregar
        </button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2">
        {sectors.map((sector) => (
          <div
            className={`flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4 ${
              sector.active ? "" : "opacity-50"
            }`}
            key={sector.id}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-black">{sector.name}</p>
              <p className="text-xs text-zinc-500">
                {branchName(sector.branchId)} · Orden {sector.sortOrder}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button className="rounded-lg bg-white/5 px-2 py-1 text-xs" onClick={() => void reorder(sector, -1)} type="button" aria-label="Subir">
                ↑
              </button>
              <button className="rounded-lg bg-white/5 px-2 py-1 text-xs" onClick={() => void reorder(sector, 1)} type="button" aria-label="Bajar">
                ↓
              </button>
              <button className="rounded-lg bg-white/5 px-2 py-1 text-xs" onClick={() => void rename(sector)} type="button">
                Renombrar
              </button>
              <button className="rounded-lg bg-white/5 px-2 py-1 text-xs" onClick={() => void toggle(sector)} type="button">
                {sector.active ? "Ocultar" : "Activar"}
              </button>
              <button
                className="rounded-lg bg-red-500/10 px-2 py-1 text-xs text-red-300"
                onClick={() => void remove(sector)}
                type="button"
              >
                ×
              </button>
            </div>
          </div>
        ))}
        {sectors.length === 0 && (
          <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500 sm:col-span-2">
            Todavía no hay sectores. Creá “Salón”, “Terraza”, “Barra” y asigná tus mesas.
          </p>
        )}
      </div>
    </Overlay>
  );
}

/** @summary Crea una mesa nueva vinculada a una sucursal y, opcionalmente, a un sector. */
function NewTableModal({
  branches,
  sectors,
  defaultBranchId,
  onClose,
  onSaved,
}: {
  branches: SalonPayload["branches"];
  sectors: SalonPayload["sectors"];
  defaultBranchId: number | null;
  onClose: () => void;
  onSaved: (payload: {
    name: string;
    sector: string;
    sectorId: number | null;
    capacity: number;
    active: boolean;
    branchId: number;
  }) => Promise<void>;
}) {
  const [branchId, setBranchId] = useState<number | null>(defaultBranchId ?? branches[0]?.id ?? null);
  const [submitting, setSubmitting] = useState(false);
  const branchSectors = sectors.filter((sector) => sector.branchId === branchId && sector.active);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!branchId) return;
    const form = new FormData(event.currentTarget);
    const sectorId = Number(form.get("sectorId")) || null;
    const sectorName = sectorId ? branchSectors.find((sector) => sector.id === sectorId)?.name ?? "" : "";
    setSubmitting(true);
    try {
      await onSaved({
        name: String(form.get("name") ?? ""),
        sector: sectorName,
        sectorId,
        capacity: Number(form.get("capacity") ?? 4),
        active: form.get("active") === "on",
        branchId,
      });
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <Overlay title="Crear mesa" onClose={onClose} wide={false}>
      <form className="space-y-4" onSubmit={submit}>
        <label>
          <span className="label">Nombre o número</span>
          <input className="input" name="name" maxLength={100} placeholder="Ej.: 12" required />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">Sucursal</span>
            <select
              className="input"
              value={branchId ?? ""}
              onChange={(event) => setBranchId(event.target.value ? Number(event.target.value) : null)}
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Sector</span>
            <select className="input" name="sectorId" defaultValue="">
              <option value="">Sin sector</option>
              {branchSectors.map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">Capacidad</span>
            <input className="input" name="capacity" type="number" min={1} max={100} defaultValue={4} required />
          </label>
          <label className="flex min-h-12 items-center gap-2 text-sm">
            <input name="active" type="checkbox" defaultChecked /> Activa (QR disponible)
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
          <button className="btn btn-secondary" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="btn" disabled={submitting || !branchId} type="submit">
            {submitting ? "Creando…" : "Crear mesa"}
          </button>
        </div>
      </form>
    </Overlay>
  );
}

/** @summary Contenedor de modales del salón con cabecera y cierre por clic en el fondo. */
function Overlay({
  title,
  onClose,
  wide,
  children,
}: {
  title: string;
  onClose: () => void;
  wide: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[130] grid place-items-center bg-black/80 p-4 backdrop-blur" onClick={onClose}>
      <div
        className={`max-h-[92vh] w-full ${wide ? "max-w-4xl" : "max-w-xl"} overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="mb-5 flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <h2 className="text-2xl font-black">{title}</h2>
          <button
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/5 text-xl"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
