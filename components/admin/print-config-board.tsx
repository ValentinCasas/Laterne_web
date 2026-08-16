"use client";

import { useCallback, useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { scopedFetch } from "@/lib/client-routing";
import type { PrintAreaView, PrintingPayload } from "@/lib/printing-data";
import {
  printDestinationTypeLabel,
  printJobStatuses,
  printJobStatusLabel,
  type PrintDestinationType,
} from "@/lib/print-provider";

/**
 * Configuración de impresión de MenuClick.
 *
 * Pantalla de PREPARACIÓN: define las áreas de impresión, las asociaciones con
 * productos/categorías y los destinos declarativos (impresoras). No imprime nada
 * y no hay conexiones reales todavía: la cola de comandas queda en espera hasta
 * que se integre un proveedor de impresión.
 */

/** @summary Muestra el estado declarativo de un destino de impresión. */
function destinationStatusLabel(status: string) {
  if (status === "available") return "Disponible";
  if (status === "unavailable") return "No disponible";
  return "Sin conexión (próximamente)";
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

/** @summary Tablero de configuración de impresión en etapa de preparación. */
export function PrintConfigBoard({ initial }: { initial: PrintingPayload }) {
  const [data, setData] = useState<PrintingPayload>(initial);
  const [busy, setBusy] = useState(false);
  const [areaName, setAreaName] = useState("");
  const [assignArea, setAssignArea] = useState<PrintAreaView | null>(null);
  const [destName, setDestName] = useState("");
  const [destType, setDestType] = useState<PrintDestinationType>("ETHERNET");
  const [destConnection, setDestConnection] = useState("");
  const [destAreaId, setDestAreaId] = useState("");

  const branchId = data.activeBranch?.id ?? data.branches[0]?.id ?? null;
  const activeAreas = data.areas.filter((area) => area.active);
  const totalJobs = printJobStatuses.reduce((sum, status) => sum + (data.jobs[status] ?? 0), 0);

  /** @summary Refresca la configuración desde el servidor conservando el estado de la pantalla. */
  const refresh = useCallback(async () => {
    try {
      const payload = await api<PrintingPayload>("/api/admin/printing", { method: "GET" });
      setData(payload);
    } catch {
      /* si el refresco falla se conserva la vista actual */
    }
  }, []);

  /** @summary Crea un área de impresión para la sucursal visible. */
  async function createArea() {
    const trimmed = areaName.trim();
    if (!trimmed || !branchId || busy) return;
    setBusy(true);
    try {
      await api("/api/admin/printing/areas", {
        method: "POST",
        body: JSON.stringify({ branchId, name: trimmed }),
      });
      setAreaName("");
      await refresh();
    } catch (reason) {
      await showError("No se pudo crear el área", reason);
    } finally {
      setBusy(false);
    }
  }

  /** @summary Renombra un área desde un diálogo simple. */
  async function renameArea(area: PrintAreaView) {
    const result = await Swal.fire({
      title: "Renombrar área",
      input: "text",
      inputValue: area.name,
      inputValidator: (value) => (value?.trim() ? null : "Ingresá un nombre"),
      showCancelButton: true,
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ec4899",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!result.isConfirmed || !result.value?.trim() || result.value.trim() === area.name) return;
    try {
      await api(`/api/admin/printing/areas/${area.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: result.value.trim() }),
      });
      await refresh();
    } catch (reason) {
      await showError("No se pudo renombrar", reason);
    }
  }

  /** @summary Activa o desactiva un área de impresión. */
  async function toggleArea(area: PrintAreaView) {
    try {
      await api(`/api/admin/printing/areas/${area.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !area.active }),
      });
      await refresh();
    } catch (reason) {
      await showError("No se pudo actualizar el área", reason);
    }
  }

  /** @summary Elimina un área después de confirmar, si no tiene impresoras asociadas. */
  async function removeArea(area: PrintAreaView) {
    const confirmation = await Swal.fire({
      title: `¿Eliminar el área “${area.name}”?`,
      text: "Se quitan sus asociaciones con productos y categorías. Las impresoras deben desvincularse antes.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmation.isConfirmed) return;
    try {
      const response = await scopedFetch(`/api/admin/printing/areas/${area.id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "No se pudo eliminar el área");
      }
      await refresh();
    } catch (reason) {
      await showError("No se pudo eliminar", reason);
    }
  }

  /** @summary Registra un destino de impresión declarativo (sin conectar nada). */
  async function createDestination() {
    const trimmed = destName.trim();
    if (!trimmed || !branchId || busy) return;
    setBusy(true);
    try {
      await api("/api/admin/printing/destinations", {
        method: "POST",
        body: JSON.stringify({
          branchId,
          name: trimmed,
          type: destType,
          connection: destConnection.trim() || undefined,
          areaId: destAreaId ? Number(destAreaId) : null,
        }),
      });
      setDestName("");
      setDestConnection("");
      setDestAreaId("");
      await refresh();
    } catch (reason) {
      await showError("No se pudo registrar la impresora", reason);
    } finally {
      setBusy(false);
    }
  }

  /** @summary Activa o desactiva una impresora registrada. */
  async function toggleDestination(destination: PrintingPayload["destinations"][number]) {
    try {
      await api(`/api/admin/printing/destinations/${destination.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !destination.active }),
      });
      await refresh();
    } catch (reason) {
      await showError("No se pudo actualizar la impresora", reason);
    }
  }

  /** @summary Elimina una impresora registrada después de confirmar. */
  async function removeDestination(destination: PrintingPayload["destinations"][number]) {
    const confirmation = await Swal.fire({
      title: `¿Eliminar “${destination.name}”?`,
      text: "Se quita solo la configuración; no se pierde ningún pedido.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmation.isConfirmed) return;
    try {
      const response = await scopedFetch(`/api/admin/printing/destinations/${destination.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "No se pudo eliminar la impresora");
      }
      await refresh();
    } catch (reason) {
      await showError("No se pudo eliminar", reason);
    }
  }

  return (
    <section>
      <AdminPageHeader
        eyebrow="Operación"
        title="Impresión"
        description="Preparación de comandas: áreas de impresión, asociación de la carta y destinos. Todavía no se imprime nada."
        section="impresion"
      />

      <div className="mb-8 rounded-3xl border border-amber-400/30 bg-amber-400/10 p-6 sm:p-8">
        <p className="section-eyebrow text-amber-300">Etapa de preparación · próximamente</p>
        <h2 className="mt-2 text-2xl font-black">La impresión de comandas todavía no está operativa</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-amber-100/90">
          Esta pantalla deja lista la arquitectura: definís las áreas (cocina, barra, cafetería, caja…), asociás
          productos y categorías, y registrás las impresoras como configuración. No hay impresoras conectadas ni
          botones de impresión: cuando se integre el proveedor (Ethernet, Bluetooth, USB o servicio local), la
          cola de comandas empezará a trabajar con esta configuración.
        </p>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.4fr_1fr]">
        <section>
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Áreas de impresión</h2>
              <p className="text-sm text-zinc-500">
                A dónde va cada comanda según la carta. Configuración por{" "}
                {data.activeBranch?.name ?? "sucursal"}.
              </p>
            </div>
          </header>

          <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                className="input"
                value={areaName}
                onChange={(event) => setAreaName(event.target.value)}
                placeholder="Nueva área (ej. Caja, Cafetería)"
                maxLength={100}
                disabled={!branchId || busy}
                aria-label="Nombre de la nueva área"
              />
              <button
                className="btn px-5"
                onClick={() => void createArea()}
                type="button"
                disabled={!branchId || busy || !areaName.trim()}
              >
                {busy ? "Guardando…" : "+ Crear área"}
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {data.areas.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-600 lg:col-span-2">
                Todavía no hay áreas de impresión. Creá la primera arriba (ej. Cocina, Barra, Caja).
              </p>
            ) : (
              data.areas.map((area) => (
                <article
                  className={`rounded-3xl border border-white/10 bg-zinc-950 p-5 shadow-xl ${
                    area.active ? "" : "opacity-60"
                  }`}
                  key={area.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-black">{area.name}</h3>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {area.productCount} {area.productCount === 1 ? "producto" : "productos"} ·{" "}
                        {area.categoryCount} {area.categoryCount === 1 ? "categoría" : "categorías"}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${
                        area.active ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-zinc-500"
                      }`}
                    >
                      {area.active ? "Activa" : "Inactiva"}
                    </span>
                  </div>

                  {(area.productNames.length > 0 || area.categoryNames.length > 0) && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {[...area.categoryNames, ...area.productNames].slice(0, 4).map((name) => (
                        <span
                          className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-bold text-zinc-400"
                          key={name}
                        >
                          {name}
                        </span>
                      ))}
                      {area.productNames.length + area.categoryNames.length > 4 && (
                        <span className="text-[11px] font-bold text-zinc-600">
                          +{area.productNames.length + area.categoryNames.length - 4} más
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="btn flex-1 py-2.5 text-sm"
                      onClick={() => setAssignArea(area)}
                      type="button"
                    >
                      Asociar carta
                    </button>
                    <button
                      className="btn btn-secondary px-3 py-2.5 text-sm"
                      onClick={() => void renameArea(area)}
                      type="button"
                    >
                      Renombrar
                    </button>
                    <button
                      className="rounded-xl bg-white/5 px-3 py-2.5 text-sm font-bold transition hover:text-white"
                      onClick={() => void toggleArea(area)}
                      type="button"
                      aria-pressed={area.active}
                    >
                      {area.active ? "Desactivar" : "Activar"}
                    </button>
                    <button
                      className="rounded-xl bg-red-500/10 px-3 py-2.5 text-sm font-bold text-red-300 transition hover:bg-red-500/20"
                      onClick={() => void removeArea(area)}
                      type="button"
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <div className="space-y-8">
          <section>
            <header className="mb-4">
              <h2 className="text-xl font-black">Impresoras (destinos)</h2>
              <p className="text-sm text-zinc-500">
                Solo configuración declarativa: tipo y datos de conexión. Sin probar ni conectar todavía.
              </p>
            </header>

            <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
              <div className="grid gap-3">
                <input
                  className="input"
                  value={destName}
                  onChange={(event) => setDestName(event.target.value)}
                  placeholder="Nombre (ej. Impresora cocina)"
                  maxLength={120}
                  disabled={!branchId || busy}
                  aria-label="Nombre de la impresora"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    className="input"
                    value={destType}
                    onChange={(event) => setDestType(event.target.value as PrintDestinationType)}
                    disabled={!branchId || busy}
                    aria-label="Tipo de conexión"
                  >
                    {Object.entries(printDestinationTypeLabel).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="input"
                    value={destAreaId}
                    onChange={(event) => setDestAreaId(event.target.value)}
                    disabled={!branchId || busy}
                    aria-label="Área de impresión"
                  >
                    <option value="">Sin área asignada</option>
                    {activeAreas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  className="input min-h-20 resize-y"
                  value={destConnection}
                  onChange={(event) => setDestConnection(event.target.value)}
                  placeholder="Datos de conexión (ej. tcp://192.168.1.50:9100) — opcional, se habilita más adelante"
                  disabled={!branchId || busy}
                  aria-label="Datos de conexión"
                />
                <button
                  className="btn"
                  onClick={() => void createDestination()}
                  type="button"
                  disabled={!branchId || busy || !destName.trim()}
                >
                  {busy ? "Guardando…" : "Registrar impresora"}
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {data.destinations.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-600">
                  Todavía no registraste impresoras. Se guardan como configuración; la conexión real se habilita
                  en una etapa futura.
                </p>
              ) : (
                data.destinations.map((destination) => (
                  <article
                    className={`rounded-2xl border border-white/10 bg-zinc-950 p-4 ${
                      destination.active ? "" : "opacity-60"
                    }`}
                    key={destination.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-black">{destination.name}</p>
                        <p className="text-xs text-zinc-500">
                          {printDestinationTypeLabel[destination.type as PrintDestinationType] ??
                            destination.type}
                          {destination.areaName ? ` · ${destination.areaName}` : ""}
                        </p>
                        {destination.connection && (
                          <p className="mt-1 truncate font-mono text-xs text-zinc-600">
                            {destination.connection}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-xs font-bold text-zinc-400">
                        {destinationStatusLabel(destination.status)}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        className="btn btn-secondary flex-1 py-2 text-sm"
                        onClick={() => void toggleDestination(destination)}
                        type="button"
                      >
                        {destination.active ? "Desactivar" : "Activar"}
                      </button>
                      <button
                        className="rounded-xl bg-red-500/10 px-3 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/20"
                        onClick={() => void removeDestination(destination)}
                        type="button"
                      >
                        Eliminar
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section>
            <header className="mb-4">
              <h2 className="text-xl font-black">Cola de comandas</h2>
              <p className="text-sm text-zinc-500">
                Estructura lista para cuando exista un proveedor de impresión.
              </p>
            </header>
            <div className="rounded-3xl border border-white/10 bg-white/[.02] p-5">
              <p className="text-sm leading-relaxed text-zinc-400">
                Cada comanda guarda: <strong className="text-zinc-200">pedido, mesa, camarero, productos con
                cantidades, modificadores, notas y fecha/hora</strong>, independiente del formato físico. La
                cola queda en espera hasta que se integre el proveedor. La reimpresión futura quedará
                registrada en la auditoría del panel.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {printJobStatuses.map((status) => (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black ${
                      (data.jobs[status] ?? 0) > 0
                        ? "bg-amber-500/15 text-amber-300"
                        : "bg-white/5 text-zinc-500"
                    }`}
                    key={status}
                  >
                    {printJobStatusLabel[status]}: {data.jobs[status] ?? 0}
                  </span>
                ))}
                <span className="ml-auto text-xs text-zinc-600">{totalJobs} en total</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {assignArea && (
        <AssignmentsModal
          area={assignArea}
          products={data.products}
          categories={data.categories}
          onClose={() => setAssignArea(null)}
          onSaved={async (productIds, categoryIds) => {
            try {
              await api(`/api/admin/printing/areas/${assignArea.id}`, {
                method: "PATCH",
                body: JSON.stringify({ productIds, categoryIds }),
              });
              await refresh();
              setAssignArea(null);
            } catch (reason) {
              await showError("No se pudieron guardar las asociaciones", reason);
            }
          }}
        />
      )}
    </section>
  );
}

/** @summary Modal de asociación de productos y categorías a un área de impresión. */
function AssignmentsModal({
  area,
  products,
  categories,
  onClose,
  onSaved,
}: {
  area: PrintAreaView;
  products: Array<{ id: number; name: string }>;
  categories: Array<{ id: number; name: string }>;
  onClose: () => void;
  onSaved: (productIds: number[], categoryIds: number[]) => Promise<void>;
}) {
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set(area.productIds));
  const [selectedCategories, setSelectedCategories] = useState<Set<number>>(new Set(area.categoryIds));
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  /** @summary Muestra las opciones de un grupo filtrando por la búsqueda. */
  function visibleOptions(options: Array<{ id: number; name: string }>) {
    const normalized = query.trim().toLocaleLowerCase("es");
    if (!normalized) return options;
    return options.filter((option) => option.name.toLocaleLowerCase("es").includes(normalized));
  }

  /** @summary Agrega o quita un elemento del conjunto seleccionado. */
  function toggle(set: Set<number>, value: number, onChange: (next: Set<number>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  }

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-black/85 p-4" onClick={onClose}>
      <article
        className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-zinc-950 p-6 sm:p-8"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Asociar carta a ${area.name}`}
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="section-eyebrow">Área de impresión</p>
            <h2 className="mt-1 text-3xl font-black">{area.name}</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Los productos y categorías elegidos enviarán su comanda a esta área cuando la impresión se habilite.
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

        <label className="mt-6 block">
          <span className="sr-only">Buscar productos o categorías</span>
          <input
            className="input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar producto o categoría…"
          />
        </label>

        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          <fieldset>
            <legend className="text-sm font-black uppercase tracking-widest text-zinc-500">
              Categorías · {selectedCategories.size}
            </legend>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
              {visibleOptions(categories).map((category) => {
                const checked = selectedCategories.has(category.id);
                return (
                  <button
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition ${
                      checked
                        ? "border-pink-400 bg-pink-500/10 text-white"
                        : "border-white/10 text-zinc-400 hover:border-white/25"
                    }`}
                    key={category.id}
                    onClick={() => toggle(selectedCategories, category.id, setSelectedCategories)}
                    type="button"
                    aria-pressed={checked}
                  >
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-md text-xs ${
                        checked ? "bg-pink-500" : "bg-white/5"
                      }`}
                    >
                      {checked ? "✓" : ""}
                    </span>
                    <span className="line-clamp-2">{category.name}</span>
                  </button>
                );
              })}
              {categories.length === 0 && (
                <p className="text-sm text-zinc-600">No hay categorías en esta sucursal.</p>
              )}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-black uppercase tracking-widest text-zinc-500">
              Productos · {selectedProducts.size}
            </legend>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
              {visibleOptions(products).map((product) => {
                const checked = selectedProducts.has(product.id);
                return (
                  <button
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition ${
                      checked
                        ? "border-pink-400 bg-pink-500/10 text-white"
                        : "border-white/10 text-zinc-400 hover:border-white/25"
                    }`}
                    key={product.id}
                    onClick={() => toggle(selectedProducts, product.id, setSelectedProducts)}
                    type="button"
                    aria-pressed={checked}
                  >
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-md text-xs ${
                        checked ? "bg-pink-500" : "bg-white/5"
                      }`}
                    >
                      {checked ? "✓" : ""}
                    </span>
                    <span className="line-clamp-2">{product.name}</span>
                  </button>
                );
              })}
              {products.length === 0 && (
                <p className="text-sm text-zinc-600">No hay productos en esta sucursal.</p>
              )}
            </div>
          </fieldset>
        </div>

        <div className="mt-7 flex gap-3">
          <button
            className="btn flex-1 py-4 text-lg font-black"
            onClick={async () => {
              setSaving(true);
              try {
                await onSaved([...selectedProducts], [...selectedCategories]);
              } finally {
                setSaving(false);
              }
            }}
            type="button"
            disabled={saving}
          >
            {saving ? "Guardando…" : "Guardar asociaciones"}
          </button>
          <button className="btn btn-secondary px-5" onClick={onClose} type="button" disabled={saving}>
            Cancelar
          </button>
        </div>
      </article>
    </div>
  );
}
