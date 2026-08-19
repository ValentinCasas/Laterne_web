"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import Swal from "sweetalert2";
import { PageHeader, SearchBox, ActionMenu, EmptyState, Drawer } from "@/components/admin/ui";
import { scopedFetch } from "@/lib/client-routing";
import { useViewMode, ViewModeToggle } from "@/components/admin/view-mode-toggle";


export type DiningTableData = {
  id: number;
  code: string;
  name: string;
  sector: string | null;
  capacity: number;
  active: boolean;
  branchId: number | null;
  currentOrder?: { reference: string; status: string } | null;
};

type BranchOption = { id: number; name: string };

/** @summary Construye la dirección absoluta que se codifica para identificar una mesa. */
function tableUrl(code: string) {
  return `${window.location.origin}/mesa/${encodeURIComponent(code)}`;
}

/** @summary Estado visual de la mesa. */
function tableStatus(table: DiningTableData) {
  if (!table.active) return { label: "Inactiva", color: "text-zinc-500" };
  if (table.currentOrder) return { label: "Ocupada", color: "text-amber-300" };
  return { label: "Libre", color: "text-emerald-300" };
}

/** @summary Administra mesas y genera sus materiales QR descargables e imprimibles. */
export function TableManager({
  initialTables,
  branches,
}: {
  initialTables: DiningTableData[];
  branches: BranchOption[];
}) {
  const [tables, setTables] = useState(initialTables);
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [view, setView] = useViewMode("mesas");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<DiningTableData | null>(null);

  const visibleTables = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return normalized
      ? tables.filter((table) =>
          `${table.name} ${table.sector ?? ""}`.toLocaleLowerCase("es").includes(normalized),
        )
      : tables;
  }, [query, tables]);

  useEffect(() => {
    let active = true;
    /** @summary Renderiza localmente los QR activos para evitar enviar sus URLs a servicios externos. */
    async function renderCodes() {
      const entries = await Promise.all(
        tables.map(
          async (table) =>
            [
              table.code,
              await QRCode.toDataURL(tableUrl(table.code), {
                width: 640,
                margin: 2,
                errorCorrectionLevel: "H",
                color: { dark: "#09090b", light: "#ffffff" },
              }),
            ] as const,
        ),
      );
      if (active) setQrCodes(Object.fromEntries(entries));
    }
    void renderCodes();
    return () => {
      active = false;
    };
  }, [tables]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setDrawerOpen(true);
  }, []);

  const openEdit = useCallback((table: DiningTableData) => {
    setEditing(table);
    setDrawerOpen(true);
  }, []);

  /** @summary Elimina una mesa con confirmación. */
  const remove = useCallback(async (table: DiningTableData) => {
    const confirmation = await Swal.fire({
      title: `¿Eliminar ${table.name}?`,
      text: "Sus pedidos históricos se conservarán, pero el QR dejará de funcionar.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmation.isConfirmed) return;
    const response = await scopedFetch(`/api/admin/tables/${table.id}`, { method: "DELETE" });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      await Swal.fire({
        title: "No se pudo eliminar",
        text: result.error ?? "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setTables((current) => current.filter((item) => item.id !== table.id));
  }, []);

  /** @summary Rota el código de la mesa para invalidar el QR impreso y generar uno nuevo. */
  const rotateCode = useCallback(async (table: DiningTableData) => {
    const confirmation = await Swal.fire({
      title: `¿Regenerar el QR de ${table.name}?`,
      text: "El QR impreso dejará de funcionar y tendrás que colocar el nuevo.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Regenerar QR",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ec4899",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmation.isConfirmed) return;
    const response = await scopedFetch(`/api/admin/tables/${table.id}`, { method: "POST" });
    const result = (await response.json().catch(() => ({}))) as { table?: DiningTableData; error?: string };
    if (!response.ok || !result.table) {
      await Swal.fire({
        title: "No se pudo regenerar",
        text: result.error ?? "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setTables((current) => current.map((item) => (item.id === table.id ? result.table! : item)));
    await Swal.fire({
      title: "QR regenerado",
      text: "Descargá o imprimí el cartel nuevo.",
      icon: "success",
      timer: 1400,
      showConfirmButton: false,
      background: "#18181b",
      color: "#fafafa",
    });
  }, []);

  /** @summary Descarga un código QR individual con un nombre de archivo reconocible. */
  const download = useCallback(
    (table: DiningTableData) => {
      const anchor = document.createElement("a");
      anchor.href = qrCodes[table.code];
      anchor.download = `menuclick-${table.code.toLocaleLowerCase()}.png`;
      anchor.click();
    },
    [qrCodes],
  );

  const isCompact = view === "list-compact" || view === "cards-compact";
  const isCards = view === "cards" || view === "cards-compact";

  return (
    <section>
      <PageHeader
        eyebrow="Salón y QR"
        title="Mesas"
        description="Cada QR reconoce la mesa y lleva al cliente directamente a la carta."
        section="mesas"
        actions={
          <div className="flex items-center gap-2 print:hidden">
            <button className="btn btn-secondary text-xs" onClick={() => window.print()} type="button">
              Imprimir todos
            </button>
            <button className="btn text-xs" onClick={openCreate} type="button">
              + Nueva mesa
            </button>
          </div>
        }
      />

      {/* Toolbar compacta */}
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <SearchBox
          className="min-w-[200px] flex-1"
          value={query}
          onChange={setQuery}
          placeholder="Buscar mesa o sector…"
        />
        <ViewModeToggle value={view} onChange={setView} />
      </div>

      {/* Estado vacío */}
      {visibleTables.length === 0 && (
        <EmptyState
          title={tables.length > 0 ? "No se encontraron mesas" : "Todavía no tenés mesas"}
          description={tables.length > 0 ? "Probá con otra búsqueda." : "Creá la primera mesa para generar su QR."}
          action={
            tables.length > 0 ? (
              <button className="btn btn-secondary" onClick={() => setQuery("")}>
                Limpiar búsqueda
              </button>
            ) : (
              <button className="btn" onClick={openCreate}>
                + Nueva mesa
              </button>
            )
          }
        />
      )}

      {/* Vista Tarjetas */}
      {isCards && visibleTables.length > 0 && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 ${isCompact ? "gap-2.5" : "gap-4"}`}>
          {visibleTables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              qr={qrCodes[table.code]}
              compact={isCompact}
              onEdit={() => openEdit(table)}
              onRemove={() => void remove(table)}
              onRegenerate={() => void rotateCode(table)}
              onDownload={() => download(table)}
            />
          ))}
        </div>
      )}

      {/* Vista Lista */}
      {!isCards && visibleTables.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="overflow-x-auto">
            <table className={`w-full text-left text-sm ${isCompact ? "text-xs" : ""}`}>
              <thead>
                <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
                  <th className={`${isCompact ? "px-3 py-2" : "px-4 py-3"}`}>Mesa</th>
                  <th className={`${isCompact ? "px-3 py-2" : "px-4 py-3"}`}>Sector</th>
                  <th className={`${isCompact ? "px-3 py-2" : "px-4 py-3"}`}>Sucursal</th>
                  <th className={`${isCompact ? "px-3 py-2" : "px-4 py-3"} text-center`}>Capacidad</th>
                  <th className={`${isCompact ? "px-3 py-2" : "px-4 py-3"}`}>Estado</th>
                  <th className={`${isCompact ? "px-3 py-2" : "px-4 py-3"}`}>QR</th>
                  <th className={`${isCompact ? "px-3 py-2" : "px-4 py-3"}`}>Pedido</th>
                  <th className={`${isCompact ? "px-3 py-2" : "px-4 py-3"} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]/70">
                {visibleTables.map((table) => {
                  const status = tableStatus(table);
                  return (
                    <tr
                      key={table.id}
                      className="transition-colors hover:bg-white/[0.02] cursor-pointer"
                      onClick={() => openEdit(table)}
                    >
                      <td className={`${isCompact ? "px-3 py-2" : "px-4 py-3"} font-bold`}>{table.name}</td>
                      <td className={`${isCompact ? "px-3 py-2" : "px-4 py-3"} text-[var(--admin-muted)]`}>
                        {table.sector || "—"}
                      </td>
                      <td className={`${isCompact ? "px-3 py-2" : "px-4 py-3"} text-[var(--admin-muted)]`}>
                        {branches.find((b) => b.id === table.branchId)?.name ?? "—"}
                      </td>
                      <td className={`${isCompact ? "px-3 py-2" : "px-4 py-3"} text-center`}>{table.capacity}</td>
                      <td className={`${isCompact ? "px-3 py-2" : "px-4 py-3"}`}>
                        <span className={`text-xs font-bold ${status.color}`}>{status.label}</span>
                      </td>
                      <td className={`${isCompact ? "px-3 py-2" : "px-4 py-3"}`}>
                        <span className={`text-xs font-bold ${table.active ? "text-emerald-300" : "text-zinc-500"}`}>
                          {table.active ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className={`${isCompact ? "px-3 py-2" : "px-4 py-3"} text-xs text-[var(--admin-muted)]`}>
                        {table.currentOrder
                          ? `${table.currentOrder.reference}`
                          : "—"}
                      </td>
                      <td
                        className={`${isCompact ? "px-3 py-2" : "px-4 py-3"} text-right`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ActionMenu
                          align="right"
                          items={[
                            { label: "Descargar QR", onClick: () => download(table) },
                            { label: "Regenerar QR", onClick: () => void rotateCode(table) },
                            { label: "Editar", onClick: () => openEdit(table) },
                            { label: "Imprimir", onClick: () => window.print() },
                            { label: "Eliminar", tone: "danger", onClick: () => void remove(table) },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drawer crear/editar mesa */}
      {drawerOpen && (
        <TableDrawer
          table={editing}
          branches={branches}
          onClose={() => {
            setDrawerOpen(false);
            setEditing(null);
          }}
          onSaved={(saved) => {
            setTables((current) =>
              editing
                ? current.map((t) => (t.id === saved.id ? saved : t))
                : [saved, ...current],
            );
            setDrawerOpen(false);
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}

/** @summary Tarjeta de mesa compacta con QR, estado y acciones. */
function TableCard({
  table,
  qr,
  compact,
  onEdit,
  onRemove,
  onRegenerate,
  onDownload,
}: {
  table: DiningTableData;
  qr: string | undefined;
  compact: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onRegenerate: () => void;
  onDownload: () => void;
}) {
  const status = tableStatus(table);
  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] transition-all hover:-translate-y-0.5 hover:shadow-lg ${
        compact ? "p-3" : "p-4"
      }`}
    >
      {/* Header con QR y acciones */}
      <div className="flex items-start gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white p-1.5">
          {qr ? (
            <Image src={qr} alt={`QR de ${table.name}`} fill unoptimized className="object-contain p-1" />
          ) : (
            <span className="grid h-full place-items-center text-[9px] text-black">...</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className={`truncate font-black ${compact ? "text-sm" : "text-base"}`}>{table.name}</h3>
              <p className="text-xs text-[var(--admin-muted)]">
                {table.sector || "Sin sector"} · {table.capacity} personas
              </p>
            </div>
            <ActionMenu
              align="right"
              items={[
                { label: "Descargar QR", onClick: onDownload },
                { label: "Regenerar", onClick: onRegenerate },
                { label: "Editar", onClick: onEdit },
                { label: "Imprimir", onClick: () => window.print() },
                { label: "Eliminar", tone: "danger", onClick: onRemove },
              ]}
            />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className={`text-[10px] font-bold ${status.color}`}>{status.label}</span>
            <span className={`text-[10px] font-bold ${table.active ? "text-emerald-300" : "text-zinc-500"}`}>
              QR {table.active ? "activo" : "inactivo"}
            </span>
          </div>
          {table.currentOrder && (
            <p className="mt-1.5 truncate rounded-lg bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-200">
              Pedido {table.currentOrder.reference}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

/** @summary Drawer lateral para crear o editar una mesa. */
function TableDrawer({
  table,
  branches,
  onClose,
  onSaved,
}: {
  table: DiningTableData | null;
  branches: BranchOption[];
  onClose: () => void;
  onSaved: (table: DiningTableData) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      sector: String(form.get("sector") ?? ""),
      capacity: Number(form.get("capacity") ?? 4),
      active: form.get("active") === "on",
      branchId: Number(form.get("branchId")),
    };
    try {
      const response = await scopedFetch(
        table ? `/api/admin/tables/${table.id}` : "/api/admin/tables",
        {
          method: table ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json().catch(() => ({}))) as { table?: DiningTableData; error?: string };
      if (!response.ok || !result.table) {
        await Swal.fire({
          title: "No se pudo guardar",
          text: result.error ?? "Intentá nuevamente.",
          icon: "error",
          background: "#18181b",
          color: "#fafafa",
        });
        return;
      }
      onSaved(result.table);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open onClose={onClose} title={table ? "Editar mesa" : "Nueva mesa"}>
      <form onSubmit={void handleSubmit} className="space-y-5">

        <label className="block">
          <span className="mb-1 block text-sm text-zinc-400">Nombre o número</span>
          <input className="input w-full" name="name" required defaultValue={table?.name ?? ""} />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-zinc-400">Sector</span>
          <input className="input w-full" name="sector" defaultValue={table?.sector ?? ""} />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-zinc-400">Sucursal</span>
          <select className="input w-full" name="branchId" required defaultValue={table?.branchId ?? branches[0]?.id}>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-zinc-400">Capacidad</span>
          <input className="input w-full" name="capacity" type="number" min={1} max={100} required defaultValue={table?.capacity ?? 4} />
        </label>

        <label className="flex items-center gap-2">
          <input name="active" type="checkbox" defaultChecked={table?.active ?? true} className="accent-pink-500" />
          <span className="text-sm text-zinc-300">Activa</span>
        </label>

        <div className="flex gap-2 pt-2">
          <button className="btn flex-1" type="submit" disabled={saving}>
            {saving ? "Guardando..." : table ? "Guardar cambios" : "Crear mesa"}
          </button>
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </Drawer>
  );
}
