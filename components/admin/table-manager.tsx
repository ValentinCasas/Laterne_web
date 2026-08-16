"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { scopedFetch } from "@/lib/client-routing";

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
  const [editing, setEditing] = useState<DiningTableData | null>(null);
  const [query, setQuery] = useState("");
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

  /** @summary Crea una mesa o guarda la edición existente mediante la API administrativa. */
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      name: String(form.get("name") ?? ""),
      sector: String(form.get("sector") ?? ""),
      capacity: Number(form.get("capacity") ?? 4),
      active: form.get("active") === "on",
      branchId: Number(form.get("branchId")),
    };
    const response = await scopedFetch(editing ? `/api/admin/tables/${editing.id}` : "/api/admin/tables", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
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
    setTables((current) =>
      editing
        ? current.map((table) => (table.id === editing.id ? result.table! : table))
        : [result.table!, ...current],
    );
    setEditing(null);
    formElement.reset();
  }

  /** @summary Confirma la eliminación de una mesa y conserva sus pedidos como historial sin mesa activa. */
  async function remove(table: DiningTableData) {
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
  }

  /** @summary Rota el código de la mesa para invalidar el QR impreso y generar uno nuevo. */
  async function rotateCode(table: DiningTableData) {
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
  }

  /** @summary Descarga un código QR individual con un nombre de archivo reconocible. */
  function download(table: DiningTableData) {
    const anchor = document.createElement("a");
    anchor.href = qrCodes[table.code];
    anchor.download = `laterne-${table.code.toLocaleLowerCase()}.png`;
    anchor.click();
  }

  return (
    <section>
      <AdminPageHeader
        eyebrow="Salón y QR"
        title="Mesas"
        description="Cada QR reconoce la mesa y lleva al cliente directamente a la carta."
        section="mesas"
        actions={
          <button className="btn btn-secondary print:hidden" onClick={() => window.print()} type="button">
            Imprimir todos los carteles
          </button>
        }
      />

      <form
        className="card mb-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_140px_auto_auto] lg:items-end"
        onSubmit={save}
      >
        <label>
          <span className="label">Nombre o número</span>
          <input
            className="input"
            name="name"
            required
            defaultValue={editing?.name ?? ""}
            key={`name-${editing?.id ?? "new"}`}
          />
        </label>
        <label>
          <span className="label">Sector</span>
          <input
            className="input"
            name="sector"
            defaultValue={editing?.sector ?? ""}
            key={`sector-${editing?.id ?? "new"}`}
          />
        </label>
        <label>
          <span className="label">Sucursal</span>
          <select
            className="input"
            name="branchId"
            required
            defaultValue={editing?.branchId ?? branches[0]?.id}
            key={`branch-${editing?.id ?? "new"}`}
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Capacidad</span>
          <input
            className="input"
            name="capacity"
            type="number"
            min={1}
            max={100}
            required
            defaultValue={editing?.capacity ?? 4}
            key={`capacity-${editing?.id ?? "new"}`}
          />
        </label>
        <label className="flex min-h-12 items-center gap-2">
          <input
            name="active"
            type="checkbox"
            defaultChecked={editing?.active ?? true}
            key={`active-${editing?.id ?? "new"}`}
          />{" "}
          Activa
        </label>
        <div className="flex gap-2">
          <button className="btn flex-1">{editing ? "Guardar" : "Crear mesa"}</button>
          {editing && (
            <button className="btn btn-secondary" onClick={() => setEditing(null)} type="button">
              Cancelar
            </button>
          )}
        </div>
      </form>

      <label className="mb-5 block max-w-md print:hidden">
        <span className="sr-only">Buscar mesas</span>
        <input
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          type="search"
          placeholder="Buscar mesa o sector"
        />
      </label>
      <div className="qr-print-grid grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {visibleTables.map((table) => (
          <article
            className="qr-print-card min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-zinc-950"
            key={table.id}
          >
            <div className="grid min-w-0 grid-cols-[120px_1fr] gap-4 p-4 sm:grid-cols-[140px_1fr]">
              <div className="relative aspect-square w-full max-w-[140px] justify-self-center overflow-hidden rounded-2xl bg-white p-2">
                {qrCodes[table.code] ? (
                  <Image
                    src={qrCodes[table.code]}
                    alt={`QR de ${table.name}`}
                    fill
                    unoptimized
                    className="object-contain p-2"
                  />
                ) : (
                  <span className="grid h-full place-items-center text-center text-xs text-black">
                    Generando…
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-widest text-pink-300">Código de mesa</p>
                <h2 className="mt-1 truncate text-2xl font-black">{table.name}</h2>
                <p className="mt-1 break-words text-sm text-zinc-400">
                  {table.sector || "Sin sector"} · {table.capacity} personas
                </p>
                <p className={`mt-2 text-xs font-bold ${table.active ? "text-emerald-300" : "text-red-300"}`}>
                  {table.active ? "QR activo" : "Mesa desactivada"}
                </p>
                {table.currentOrder && (
                  <p className="mt-2 rounded-lg bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-200">
                    Pedido {table.currentOrder.reference} · {table.currentOrder.status.replaceAll("_", " ")}
                  </p>
                )}
                <p className="mt-2 truncate text-[10px] text-zinc-600">{table.code}</p>
              </div>
            </div>
            <p className="qr-instruction border-y border-white/10 px-4 py-3 text-center text-sm font-bold">
              Escaneá para ver la carta y pedir
            </p>
            <TableActions
              table={table}
              onDownload={() => download(table)}
              onRegenerate={() => void rotateCode(table)}
              onEdit={() => setEditing(table)}
              onRemove={() => remove(table)}
            />
          </article>
        ))}
      </div>
    </section>
  );
}

/** @summary Acciones de una mesa: botones en escritorio y menú ⋯ compacto en móvil. */
function TableActions({
  table,
  onDownload,
  onRegenerate,
  onEdit,
  onRemove,
}: {
  table: DiningTableData;
  onDownload: () => void;
  onRegenerate: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const actions = [
    { label: "Descargar QR", action: onDownload },
    { label: "Regenerar", action: onRegenerate, warn: true },
    { label: "Editar", action: onEdit },
    { label: "Imprimir", action: () => window.print() },
    { label: "Eliminar", action: onRemove, danger: true },
  ];
  return (
    <>
      <footer className="hidden flex-wrap gap-2 p-3 sm:flex print:hidden">
        <button className="btn btn-secondary flex-1 px-2 text-xs" onClick={onDownload} type="button">
          Descargar QR
        </button>
        <button className="btn btn-secondary px-2 text-xs" onClick={onRegenerate} type="button">
          Regenerar
        </button>
        <button className="btn btn-secondary px-2 text-xs" onClick={onEdit} type="button">
          Editar
        </button>
        <button className="btn btn-secondary px-2 text-xs" onClick={() => window.print()} type="button">
          Imprimir
        </button>
        <button
          className="rounded-xl border border-red-500/20 px-2 text-sm text-red-300 hover:bg-red-500/10"
          onClick={onRemove}
          type="button"
          aria-label={`Eliminar ${table.name}`}
        >
          ×
        </button>
      </footer>
      <div className="relative p-3 sm:hidden print:hidden">
        <button
          className="btn w-full"
          onClick={() => setOpen((current) => !current)}
          type="button"
          aria-expanded={open}
        >
          Acciones ⋯
        </button>
        {open && (
          <div className="absolute inset-x-3 bottom-full z-30 mb-2 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl">
            {actions.map((action) => (
              <button
                className={`block w-full border-b border-white/5 px-4 py-3 text-left text-sm font-bold transition last:border-0 ${
                  action.danger
                    ? "text-red-300"
                    : action.warn
                      ? "text-amber-300"
                      : "text-zinc-200 hover:bg-white/5"
                }`}
                key={action.label}
                onClick={() => {
                  setOpen(false);
                  action.action();
                }}
                type="button"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
