"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import QRCode from "qrcode";
import Swal from "sweetalert2";
import type { Route } from "next";
import { PageHeader, EmptyState, SearchBox, StatusBadge, NumberFlow, Timeline } from "@/components/admin/ui";
import { scopedFetch } from "@/lib/client-routing";
import { adminHrefFromPathname } from "@/lib/routes";
import { allowedTransitions, asOrderType } from "@/lib/order-status";
import { orderStatusLabel, type OrderStatus } from "@/lib/orders";
import {
  tableStatusGlowColor,
  tableStatusLabel,
  tableStatusOrder,
  tableStatusStyles,
} from "@/lib/table-status";
import {
  clampToFloor,
  gridPositions,
  gridPositionsAvoiding,
  isValidTablePosition,
  type Point,
} from "@/lib/table-layout";
import type { SalonOrder, SalonPayload, SalonProduct, SalonTable } from "@/lib/salon-data";

export type SalonBoardProps = {
  initial: SalonPayload;
  canManageOrders: boolean;
};

type ModalName = "open" | "order" | "bill" | "move" | "transfer" | "split" | "merge" | "sectors" | "newTable";

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

/** @summary Cronómetro compacto de una mesa abierta en formato HH:MM. */
function tableClock(iso: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/** @summary Cronómetro en vivo que se actualiza cada 30 segundos sin recargar el tablero. */
function SessionTime({ iso }: { iso: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return <>{tableClock(iso)}</>;
}

/** @summary Menú compacto "⋯" con las acciones secundarias del salón. */
function MoreMenu({
  mesasHref,
  onSectors,
  onRefresh,
  refreshing,
}: {
  mesasHref: Route;
  onSectors: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);
  return (
    <div className="relative" ref={containerRef}>
      <button
        className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-[var(--admin-surface-elevated)] text-lg font-black leading-none text-zinc-300 transition hover:border-white/25 hover:text-white"
        type="button"
        aria-label="Más acciones"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        ⋯
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-white/10 bg-[var(--admin-surface)] p-1.5 shadow-2xl shadow-black/50"
          role="menu"
          aria-label="Acciones del salón"
        >
          <Link
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold text-zinc-300 transition hover:bg-white/5 hover:text-white"
            href={mesasHref}
            onClick={() => setOpen(false)}
            role="menuitem"
          >
            <svg
              aria-hidden
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Zm4 2v6m4-6v6m4-6v6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Mesas y QR
          </Link>
          <button
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-zinc-300 transition hover:bg-white/5 hover:text-white"
            type="button"
            onClick={() => {
              setOpen(false);
              onSectors();
            }}
            role="menuitem"
          >
            <svg
              aria-hidden
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
            Sectores
          </button>
          <button
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-zinc-300 transition hover:bg-white/5 hover:text-white"
            type="button"
            onClick={() => {
              setOpen(false);
              onRefresh();
            }}
            role="menuitem"
          >
            <svg
              aria-hidden
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M20 11a8 8 0 1 0-.5 4.5M20 4v7h-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {refreshing ? "Actualizando…" : "Refrescar"}
          </button>
        </div>
      )}
    </div>
  );
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
  const [overrides, setOverrides] = useState<Record<number, Point>>({});

  /** @summary En mobile la vista por defecto es la lista: el plano chico no es operativo. */
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const apply = () => {
      if (media.matches) setView((current) => (current === "map" ? "list" : current));
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  /** @summary Refresca el salón desde el servidor conservando la mesa seleccionada. */
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const payload = await api<SalonPayload>("/api/admin/salon", { method: "GET" });
      setData(payload);
      setSelected((current) => (current ? (payload.tables.find((t) => t.id === current.id) ?? null) : null));
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
      return `${table.name} ${table.sector ?? ""} ${table.code}`.toLocaleLowerCase("es").includes(normalized);
    });
  }, [data.tables, query, sectorFilter, statusFilter]);

  const sectorOptions = useMemo(() => {
    const seen = new Set<number>();
    const options = data.sectors.filter(
      (sector) => sector.active && !seen.has(sector.id) && seen.add(sector.id),
    );
    return options.sort((a, b) => a.branchId - b.branchId || a.sortOrder - b.sortOrder);
  }, [data.sectors]);

  /** @summary Nombre del sector visible en el plano, para el indicador de orientación. */
  const activeSectorName = useMemo(() => {
    if (sectorFilter === "all") return "Todos los sectores";
    if (sectorFilter === "none") return "Sin sector";
    return sectorOptions.find((sector) => sector.id === Number(sectorFilter))?.name ?? "Sector";
  }, [sectorFilter, sectorOptions]);

  /** @summary Sector sobre el que se ofrece crear la primera mesa cuando el empty state lo pide. */
  const emptySectorId =
    sectorFilter !== "all" && sectorFilter !== "none" && data.tables.length > 0 ? Number(sectorFilter) : null;

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

  /** @summary Aplica posiciones temporales (para "Ordenar automáticamente") sin persistir. */
  function applyOverrides(positions: Record<number, Point>) {
    setOverrides((current) => ({ ...current, ...positions }));
  }

  /** @summary Descarta las posiciones temporales y vuelve a las guardadas. */
  function clearOverrides() {
    setOverrides({});
  }

  /** @summary Guarda un lote de posiciones y refresca el tablero. */
  async function persistPositions(positions: Record<number, Point>) {
    try {
      await Promise.all(
        Object.entries(positions).map(([id, point]) =>
          api(`/api/admin/tables/${id}/position`, {
            method: "POST",
            body: JSON.stringify(point),
          }),
        ),
      );
      await load();
    } catch (reason) {
      await showError("No se pudo guardar el orden", reason);
    }
  }

  return (
    <section>
      <PageHeader
        eyebrow="Salón"
        title="Salón"
        description="Estado del salón en tiempo real"
        section="salon"
        actions={
          <div className="flex items-center gap-2">
            {view === "map" && (
              <button
                className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-bold transition ${
                  layoutMode
                    ? "border-amber-400/60 bg-amber-400/10 text-amber-300"
                    : "border-white/10 bg-[var(--admin-surface-elevated)] text-zinc-300 hover:border-white/25 hover:text-white"
                }`}
                onClick={() => setLayoutMode((current) => !current)}
                type="button"
                aria-pressed={layoutMode}
              >
                {layoutMode ? "Finalizar edición" : "Editar plano"}
              </button>
            )}
            <button className="btn h-10 px-4" onClick={() => setModal("newTable")} type="button">
              + Mesa
            </button>
            <MoreMenu
              mesasHref={adminHrefFromPathname(pathname, "/admin/mesas")}
              onSectors={() => setModal("sectors")}
              onRefresh={() => void load()}
              refreshing={loading}
            />
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-1.5 overflow-x-auto pb-1">
        {tableStatusOrder.map((status) => {
          const count = counters[status] ?? 0;
          const active = statusFilter === status;
          const dimmed = !active && count === 0;
          return (
            <button
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                active
                  ? "border-white/25 bg-white/10 text-white"
                  : dimmed
                    ? "border-white/5 bg-white/[.02] text-zinc-600 hover:text-zinc-400"
                    : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"
              }`}
              key={status}
              onClick={() => setStatusFilter(active ? "all" : status)}
              type="button"
              aria-pressed={active}
            >
              <span
                className={`h-2 w-2 rounded-full ${tableStatusStyles[status].dot} ${active ? "" : "opacity-60"}`}
              />
              {tableStatusLabel(status)}
              <span
                className={`ml-0.5 rounded-full bg-black/25 px-1.5 py-px text-[10px] font-black ${
                  count > 0 ? "" : "opacity-50"
                }`}
              >
                <NumberFlow value={count} />
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <SearchBox value={query} onChange={setQuery} placeholder="Buscar mesa…" className="w-full sm:w-64" />
        <select
          className="input w-full sm:w-56"
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
        <div
          className="ml-auto flex rounded-xl border border-white/10 bg-white/5 p-1"
          role="group"
          aria-label="Vista del salón"
        >
          {(["map", "list"] as const).map((option) => (
            <button
              className={`rounded-lg px-3.5 py-1.5 text-sm font-bold transition ${
                view === option
                  ? "bg-[var(--admin-primary-strong)] text-white"
                  : "text-zinc-500 hover:text-zinc-200"
              }`}
              key={option}
              onClick={() => {
                setView(option);
                if (option === "list") setLayoutMode(false);
              }}
              type="button"
            >
              {option === "map" ? "Plano" : "Lista"}
            </button>
          ))}
        </div>
      </div>

      {visibleTables.length === 0 ? (
        data.tables.length === 0 ? (
          <EmptyState
            title="Todavía no hay mesas"
            description="Creá tu primera mesa para que aparezca en el plano, o generá las mesas con su QR desde 'Mesas y QR'."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <button className="btn" onClick={() => setModal("newTable")} type="button">
                  + Agregar primera mesa
                </button>
                <Link className="btn btn-secondary" href={adminHrefFromPathname(pathname, "/admin/mesas")}>
                  Mesas y QR
                </Link>
              </div>
            }
          />
        ) : (
          <EmptyState
            title={
              emptySectorId
                ? "Todavía no hay mesas en este sector"
                : "No hay mesas que coincidan con esta vista"
            }
            description={
              emptySectorId
                ? "Agregá una mesa a este sector o explorá el resto del salón."
                : "Probá con otra búsqueda o quitá los filtros para ver todas las mesas."
            }
            action={
              emptySectorId ? (
                <button className="btn" onClick={() => setModal("newTable")} type="button">
                  + Agregar mesa en este sector
                </button>
              ) : (
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setQuery("");
                    setSectorFilter("all");
                    setStatusFilter("all");
                  }}
                  type="button"
                >
                  Limpiar filtros
                </button>
              )
            }
          />
        )
      ) : view === "map" ? (
        <FloorMap
          tables={visibleTables}
          overrides={overrides}
          layoutMode={layoutMode}
          currency={data.currency}
          sectorLabel={activeSectorName}
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
          onPositionCommit={commitPosition}
          onApplyOverrides={applyOverrides}
          onClearOverrides={clearOverrides}
          onPersistPositions={persistPositions}
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
            void closeSession(
              selected.session.id,
              selected.name,
              selected.session.orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length,
            );
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
            void closeSession(
              selected.session.id,
              selected.name,
              selected.session.orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length,
            );
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
          defaultSectorId={emptySectorId}
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

/** @summary Plano del salón: mesas como tarjetas, arrastre solo en modo edición y auto-orden. */
function FloorMap({
  tables,
  overrides,
  layoutMode,
  currency,
  sectorLabel,
  selectedId,
  onSelect,
  onPositionCommit,
  onApplyOverrides,
  onClearOverrides,
  onPersistPositions,
}: {
  tables: SalonTable[];
  overrides: Record<number, Point>;
  layoutMode: boolean;
  currency: string;
  sectorLabel: string;
  selectedId: number | null;
  onSelect: (table: SalonTable) => void;
  onPositionCommit: (tableId: number, x: number, y: number) => void;
  onApplyOverrides: (positions: Record<number, Point>) => void;
  onClearOverrides: () => void;
  onPersistPositions: (positions: Record<number, Point>) => Promise<void>;
}) {
  const floorRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ tableId: number; x: number; y: number } | null>(null);
  const [moved, setMoved] = useState(false);
  const dragOffset = useRef({ dx: 0, dy: 0 });
  const dragSize = useRef({ width: 120, height: 84 });
  const [viewport, setViewport] = useState({ zoom: 1, x: 0, y: 0 });
  const panStart = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!layoutMode) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViewport({ zoom: 1, x: 0, y: 0 });
  }, [layoutMode]);

  /** @summary Grilla por defecto: solo mesas sin coordenadas, evitando las ya posicionadas. */
  const gridForMissing = useMemo(() => {
    const missing = tables.filter(
      (candidate) =>
        !overrides[candidate.id] && !isValidTablePosition(candidate.positionX, candidate.positionY),
    );
    if (missing.length === 0) return {};
    const positioned = tables.filter((candidate) => !missing.includes(candidate));
    const occupied = positioned.map((candidate) => {
      const candidateOverride = overrides[candidate.id];
      return candidateOverride ?? { x: candidate.positionX!, y: candidate.positionY! };
    });
    return gridPositionsAvoiding(
      missing.map((candidate) => candidate.id),
      occupied,
    );
  }, [overrides, tables]);

  /** @summary Posición efectiva: override de arrastre, guardada válida o grilla por defecto. */
  const positionOf = useCallback(
    (table: SalonTable): Point => {
      const override = overrides[table.id];
      if (override) return override;
      if (isValidTablePosition(table.positionX, table.positionY)) {
        return { x: table.positionX!, y: table.positionY! };
      }
      return gridForMissing[table.id] ?? { x: 500, y: 500 };
    },
    [overrides, gridForMissing],
  );

  /** @summary Inicia el arrastre solo en modo edición y mide la mesa para mantenerla dentro del plano. */
  function startDrag(event: React.PointerEvent, table: SalonTable) {
    if (!layoutMode || !floorRef.current) return;
    event.preventDefault();
    const element = event.currentTarget as HTMLElement;
    const elementRect = element.getBoundingClientRect();
    dragSize.current = {
      width: elementRect.width || 120,
      height: elementRect.height || 84,
    };
    const rect = floorRef.current.getBoundingClientRect();
    const position = positionOf(table);
    const currentX = rect.left + (rect.width * position.x) / 1000;
    const currentY = rect.top + (rect.height * position.y) / 1000;
    dragOffset.current = { dx: event.clientX - currentX, dy: event.clientY - currentY };
    setDrag({ tableId: table.id, x: position.x, y: position.y });
    setMoved(false);
    element.setPointerCapture(event.pointerId);
  }

  /** @summary Mueve la mesa siguiendo el puntero, con clamp para que nunca quede fuera del canvas. */
  function moveDrag(event: React.PointerEvent) {
    if (!drag || !floorRef.current) return;
    const rect = floorRef.current.getBoundingClientRect();
    const raw = {
      x: ((event.clientX - dragOffset.current.dx - rect.left) / rect.width) * 1000,
      y: ((event.clientY - dragOffset.current.dy - rect.top) / rect.height) * 1000,
    };
    const clamped = clampToFloor(
      raw,
      dragSize.current.width / 2 / rect.width,
      dragSize.current.height / 2 / rect.height,
    );
    if (Math.abs(clamped.x - drag.x) > 3 || Math.abs(clamped.y - drag.y) > 3) setMoved(true);
    setDrag({ tableId: drag.tableId, x: clamped.x, y: clamped.y });
  }

  /** @summary Termina el arrastre y guarda la posición si realmente se movió. */
  function endDrag() {
    if (drag && moved) onPositionCommit(drag.tableId, drag.x, drag.y);
    setDrag(null);
    setMoved(false);
  }

  /** @summary Distribuye todas las mesas en una grilla prolija, con confirmación de guardado. */
  async function autoArrange() {
    const positions = gridPositions(tables.map((table) => table.id));
    onApplyOverrides(positions);
    const confirmation = await Swal.fire({
      title: "¿Guardar este orden?",
      text: "Las mesas quedan distribuidas en una grilla prolija dentro del plano. Podés descartar para conservar el orden actual.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Guardar orden",
      cancelButtonText: "Descartar",
      confirmButtonColor: "#ec4899",
      background: "#18181b",
      color: "#fafafa",
    });
    if (confirmation.isConfirmed) {
      await onPersistPositions(positions);
    } else {
      onClearOverrides();
    }
  }

  /** @summary Ajusta el zoom del plano manteniéndolo dentro de un rango operativo. */
  function changeZoom(delta: number) {
    setViewport((current) => ({ ...current, zoom: Math.min(1.55, Math.max(0.75, current.zoom + delta)) }));
  }

  /** @summary Inicia el desplazamiento del plano cuando el puntero parte del fondo. */
  function startPan(event: React.PointerEvent<HTMLDivElement>) {
    if (layoutMode || (event.target as HTMLElement).closest("button")) return;
    panStart.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: viewport.x,
      y: viewport.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePan(event: React.PointerEvent<HTMLDivElement>) {
    if (!panStart.current) return;
    const nextX = panStart.current.x + event.clientX - panStart.current.pointerX;
    const nextY = panStart.current.y + event.clientY - panStart.current.pointerY;
    setViewport((current) => ({
      ...current,
      x: Math.min(180, Math.max(-180, nextX)),
      y: Math.min(140, Math.max(-140, nextY)),
    }));
  }

  function endPan() {
    panStart.current = null;
  }

  return (
    <div
      className={`salon-floor relative h-[calc(100dvh-330px)] min-h-[400px] w-full overflow-hidden rounded-3xl border border-white/10 ${
        layoutMode ? "is-editing touch-none" : ""
      }`}
      ref={floorRef}
      role="group"
      aria-label="Plano del salón"
      onWheel={(event) => {
        if (layoutMode) return;
        event.preventDefault();
        changeZoom(event.deltaY < 0 ? 0.08 : -0.08);
      }}
    >
      <div className="pointer-events-none absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-xs font-bold text-zinc-300 backdrop-blur">
        <span className="h-2 w-2 rounded-full bg-[var(--admin-primary)]" />
        {sectorLabel}
        <span className="font-black text-zinc-500">· {tables.length}</span>
      </div>

      {layoutMode && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-400/30 bg-black/70 px-4 py-1.5 text-xs font-black text-amber-300 shadow-lg backdrop-blur">
          Modo edición: arrastrá las mesas para acomodar el plano
        </div>
      )}

      <div
        className={`absolute inset-0 origin-center transition-transform duration-200 ${layoutMode ? "" : "cursor-grab active:cursor-grabbing"}`}
        style={{ transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})` }}
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        {tables.map((table) => {
          const position = drag?.tableId === table.id ? drag : positionOf(table);
          const status = tableStatus(table);
          const styles = tableStatusStyles[status] ?? tableStatusStyles.free;
          const glow = tableStatusGlowColor(status);
          const isSelected = selectedId === table.id;
          const sizeClass =
            table.capacity <= 2 ? "w-[96px]" : table.capacity <= 6 ? "w-[116px]" : "w-[136px]";
          const shadows = `0 10px 24px rgba(0,0,0,.45), 0 0 26px ${glow}40${
            drag?.tableId === table.id
              ? ", 0 0 0 2px rgba(255,255,255,.65)"
              : isSelected
                ? ", 0 0 0 2px var(--admin-primary)"
                : ""
          }`;
          return (
            <button
              className={`absolute z-10 flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2 bg-[var(--admin-surface)]/95 px-2 py-2 backdrop-blur-sm transition ${
                layoutMode ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
              } ${sizeClass} ${styles.chip} ${drag?.tableId === table.id ? "z-30 scale-110" : ""} ${
                isSelected && !layoutMode ? "z-30 scale-105" : ""
              }`}
              style={{
                left: `${position.x / 10}%`,
                top: `${position.y / 10}%`,
                transform: "translate(-50%, -50%)",
                boxShadow: shadows,
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
              <span className="flex w-full items-center justify-center gap-1.5">
                <span className="text-base font-black leading-none sm:text-lg">{table.name}</span>
                <span className={`h-2 w-2 shrink-0 rounded-full ${styles.dot}`} />
              </span>
              {table.session ? (
                <>
                  <span className="text-[11px] font-bold leading-tight text-white/80">
                    <NumberFlow value={table.session.partySize} />{" "}
                    {table.session.partySize === 1 ? "comensal" : "comensales"}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-black leading-tight text-white">
                    <SessionTime iso={table.session.openedAt} />
                    {table.session.totals.total > 0 && (
                      <>
                        <span className="text-white/30">·</span>
                        <span>{money(table.session.totals.total, currency)}</span>
                      </>
                    )}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[11px] font-bold leading-tight text-white/50">
                    {table.capacity} {table.capacity === 1 ? "persona" : "personas"}
                  </span>
                  <span className="text-[10px] font-black uppercase leading-tight tracking-wide">
                    {tableStatusLabel(status)}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {!layoutMode && (
        <div className="absolute bottom-4 left-4 z-20 flex items-center rounded-lg border border-[var(--admin-border)] bg-black/60 p-1 shadow-lg backdrop-blur">
          <button
            type="button"
            onClick={() => changeZoom(-0.1)}
            className="grid h-8 w-8 place-items-center rounded-md text-sm font-bold text-zinc-300 hover:bg-white/10"
            aria-label="Alejar plano"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setViewport({ zoom: 1, x: 0, y: 0 })}
            className="min-w-12 rounded-md px-2 py-1.5 text-[10px] font-bold tabular-nums text-zinc-400 hover:bg-white/10 hover:text-white"
            aria-label="Restablecer vista"
          >
            {Math.round(viewport.zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => changeZoom(0.1)}
            className="grid h-8 w-8 place-items-center rounded-md text-sm font-bold text-zinc-300 hover:bg-white/10"
            aria-label="Acercar plano"
          >
            +
          </button>
        </div>
      )}

      {layoutMode && (
        <button
          className="absolute bottom-4 right-4 z-20 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/60 px-3.5 py-2 text-xs font-bold text-zinc-300 backdrop-blur transition hover:border-white/25 hover:text-white"
          type="button"
          onClick={() => void autoArrange()}
        >
          <svg
            aria-hidden
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
          Ordenar automáticamente
        </button>
      )}

      {!layoutMode && (
        <p className="pointer-events-none absolute bottom-3 right-4 z-10 text-xs text-zinc-600">
          {tables.length} mesa{tables.length === 1 ? "" : "s"} · usá “Editar plano” para moverlas
        </p>
      )}
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
                    <div className="mt-4 space-y-1.5 border-t border-white/10 pt-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate font-bold text-zinc-200">
                          {table.session.customerName || `Mesa ${table.name}`}
                          {table.session.partySize > 1 ? ` · ${table.session.partySize} personas` : ""}
                        </p>
                        <strong className="shrink-0">
                          {money(table.session.totals.total, table.session.orders[0]?.currency ?? currency)}
                        </strong>
                      </div>
                      <p className="flex items-center gap-2 text-xs text-zinc-500">
                        <SessionTime iso={table.session.openedAt} />
                        <span className="h-0.5 w-0.5 rounded-full bg-zinc-600" />
                        {table.session.orders.length} comanda{table.session.orders.length === 1 ? "" : "s"}
                        {table.session.waiter ? (
                          <>
                            <span className="h-0.5 w-0.5 rounded-full bg-zinc-600" />
                            {table.session.waiter.name}
                          </>
                        ) : null}
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

/** @summary Panel lateral de una mesa: estado, consumos, comandas, historial y acciones contextuales. */
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

  const openOrders = session
    ? session.orders.filter((order) => !["delivered", "cancelled"].includes(order.status))
    : [];

  return (
    <div className="salon-fade fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="salon-drawer absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col border-l border-white/10 bg-[var(--admin-background)] shadow-2xl shadow-black/60"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Mesa ${table.name}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-7">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="section-eyebrow">
                {table.sector || "Sin sector"} · {table.capacity} personas
              </p>
              <StatusBadge status={status} />
            </div>
            <h2 className="mt-1.5 text-2xl font-black sm:text-3xl">{table.name}</h2>
            {session && (
              <p className="mt-1 text-sm text-zinc-400">
                Abierta <SessionTime iso={session.openedAt} /> ·{" "}
                {new Date(session.openedAt).toLocaleTimeString("es-AR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden h-16 w-16 overflow-hidden rounded-xl bg-white p-0.5 sm:block">
              {qr ? (
                <Image src={qr} alt={`QR de ${table.name}`} width={64} height={64} unoptimized />
              ) : (
                <span className="grid h-full place-items-center text-[9px] text-black">QR</span>
              )}
            </div>
            <button
              className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-xl transition hover:bg-white/10"
              onClick={onClose}
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {!session ? (
            <div className="flex flex-col items-start gap-5">
              <p className="text-sm leading-relaxed text-zinc-400">
                Esta mesa está libre. El código QR sigue asociado a esta mesa: los clientes que lo escaneen
                llegan directo a la carta de esta sucursal.
              </p>
              {canManageOrders ? (
                <button className="btn" onClick={() => onOpenModal("open")} type="button">
                  Abrir mesa
                </button>
              ) : (
                <p className="text-sm font-bold text-emerald-300">Mesa disponible</p>
              )}
            </div>
          ) : (
            <>
              <section className="grid gap-4 lg:grid-cols-2">
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
                  <button className="btn btn-secondary" onClick={() => onOpenModal("bill")} type="button">
                    Precuenta
                  </button>
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
                <Timeline
                  className="mt-3"
                  items={session.events.map((event) => ({
                    id: event.id,
                    date: event.createdAt,
                    title: event.note || eventLabel(event.eventType),
                    actor: event.userName,
                    tone: event.eventType.includes("close") ? "warning" : "info",
                  }))}
                />
              </section>
            </>
          )}
        </div>

        {session && (
          <footer className="border-t border-white/10 px-5 py-4 sm:px-7">
            <div className="grid gap-2.5 sm:grid-cols-2">
              {canManageOrders && (
                <button className="btn" onClick={() => onOpenModal("order")} type="button">
                  + Agregar consumo
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => onOpenModal("move")} type="button">
                Trasladar mesa
              </button>
              {openOrders.length > 0 && (
                <button className="btn btn-secondary" onClick={() => onOpenModal("transfer")} type="button">
                  Mover comandas
                </button>
              )}
              {openOrders.length > 0 && (
                <button className="btn btn-secondary" onClick={() => onOpenModal("split")} type="button">
                  Separar comandas
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => onOpenModal("merge")} type="button">
                Unir con otra mesa
              </button>
              {canManageOrders && (
                <button
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--admin-danger)] px-4 text-sm font-bold text-white transition hover:brightness-90"
                  onClick={onCloseSession}
                  type="button"
                >
                  Cerrar mesa
                </button>
              )}
            </div>
          </footer>
        )}
      </aside>
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
          <input
            className="input"
            name="notes"
            maxLength={2000}
            placeholder="Ej.: mesa cerca de la ventana"
          />
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
        <p className="text-xs text-zinc-600">
          La mesa quedará asociada a {table.code} · {currency}.
        </p>
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
  onSaved: (
    items: Array<{
      productId: number;
      quantity: number;
      variantId: number | null;
      extraIds: number[];
      notes?: string;
    }>,
  ) => Promise<void>;
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
    setExtraIds((current) =>
      current.includes(extraId) ? current.filter((id) => id !== extraId) : [...current, extraId],
    );
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
        extrasTotal:
          unitPrice -
          (detail.promotionalPrice ?? detail.price) -
          (detail.variants.find((item) => item.id === variantId)?.priceAdjustment ?? 0),
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
                <strong className="shrink-0">
                  {money(product.promotionalPrice ?? product.price, currency)}
                </strong>
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
                <button
                  className="text-zinc-500"
                  onClick={() => setDetail(null)}
                  type="button"
                  aria-label="Volver"
                >
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
                <input
                  className="input"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={500}
                  placeholder="Ej.: sin cebolla"
                />
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
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Comanda ({cart.length})
            </h3>
            <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
              {cart.map((item, index) => (
                <p
                  className="flex items-start justify-between gap-2 text-sm"
                  key={`${item.productId}-${index}`}
                >
                  <span className="min-w-0">
                    <strong>
                      {item.quantity} × {item.name}
                    </strong>
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
            <button
              className="btn mt-3 w-full"
              disabled={cart.length === 0 || submitting}
              onClick={() => void confirm()}
              type="button"
            >
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
          <button
            className="btn btn-secondary"
            disabled
            title="Dividir cuenta estará disponible próximamente."
            type="button"
          >
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
      <select
        className="input mb-4"
        value={targetId ?? ""}
        onChange={(event) => setTargetId(event.target.value ? Number(event.target.value) : null)}
      >
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
        <button
          className="btn"
          disabled={!targetId || submitting}
          onClick={() => void confirm()}
          type="button"
        >
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
    setSelected((current) =>
      current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId],
    );
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
          <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-zinc-500">
            Comandas a mover
          </h3>
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
                  <span className="ml-2 text-zinc-500">
                    {order.items.reduce((n, item) => n + item.quantity, 0)} productos
                  </span>
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
    setSelected((current) =>
      current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId],
    );
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
        Las comandas seleccionadas pasan a una mesa libre como una nueva sesión. Ideal para separar cuentas de
        un grupo.
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-zinc-500">
            Comandas a separar
          </h3>
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
          <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-zinc-500">
            Mesa libre destino
          </h3>
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
        <button
          className="btn"
          disabled={!targetSessionId || submitting}
          onClick={() => void confirm()}
          type="button"
        >
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
              <button
                className="rounded-lg bg-white/5 px-2 py-1 text-xs"
                onClick={() => void reorder(sector, -1)}
                type="button"
                aria-label="Subir"
              >
                ↑
              </button>
              <button
                className="rounded-lg bg-white/5 px-2 py-1 text-xs"
                onClick={() => void reorder(sector, 1)}
                type="button"
                aria-label="Bajar"
              >
                ↓
              </button>
              <button
                className="rounded-lg bg-white/5 px-2 py-1 text-xs"
                onClick={() => void rename(sector)}
                type="button"
              >
                Renombrar
              </button>
              <button
                className="rounded-lg bg-white/5 px-2 py-1 text-xs"
                onClick={() => void toggle(sector)}
                type="button"
              >
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
  defaultSectorId,
  onClose,
  onSaved,
}: {
  branches: SalonPayload["branches"];
  sectors: SalonPayload["sectors"];
  defaultBranchId: number | null;
  defaultSectorId?: number | null;
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
  const [sectorId, setSectorId] = useState<number | null>(defaultSectorId ?? null);
  const [submitting, setSubmitting] = useState(false);
  const branchSectors = sectors.filter((sector) => sector.branchId === branchId && sector.active);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!branchId) return;
    const form = new FormData(event.currentTarget);
    const resolvedSectorId =
      sectorId && branchSectors.some((sector) => sector.id === sectorId) ? sectorId : null;
    const sectorName = resolvedSectorId
      ? (branchSectors.find((sector) => sector.id === resolvedSectorId)?.name ?? "")
      : "";
    setSubmitting(true);
    try {
      await onSaved({
        name: String(form.get("name") ?? ""),
        sector: sectorName,
        sectorId: resolvedSectorId,
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
              onChange={(event) => {
                const next = event.target.value ? Number(event.target.value) : null;
                setBranchId(next);
                if (next && !sectors.some((sector) => sector.id === sectorId && sector.branchId === next)) {
                  setSectorId(null);
                }
              }}
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
            <select
              className="input"
              value={sectorId ?? ""}
              onChange={(event) => setSectorId(event.target.value ? Number(event.target.value) : null)}
            >
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
            <input
              className="input"
              name="capacity"
              type="number"
              min={1}
              max={100}
              defaultValue={4}
              required
            />
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
    <div
      className="fixed inset-0 z-[130] grid place-items-center bg-black/80 p-4 backdrop-blur"
      onClick={onClose}
    >
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
