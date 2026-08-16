"use client";

import { useMemo, useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { currentAdminHref, scopedFetch } from "@/lib/client-routing";
import { RECIPE_UNITS, convertQuantity, isConvertible, unitLabel, type UnitConversionRow } from "@/lib/recipe-units";
import type { RecipeEditorPayload } from "@/lib/recipe-data";

/**
 * Editor visual de receta.
 *
 * Flujo simple: buscar ingrediente → cantidad → unidad. El costo total se
 * calcula en vivo en el cliente usando las conversiones del negocio; las
 * subrecetas usan el costo calculado por el servidor. Las alertas marcan las
 * recetas incompletas (costo faltante, unidad no convertible o ciclos).
 */

const statusLabels: Record<string, string> = {
  published: "Publicado",
  scheduled: "Programado",
  draft: "Borrador",
  hidden: "Oculto",
  archived: "Archivado",
};

type EditorLine = {
  ingredientProductId: number;
  name: string;
  quantity: string;
  unit: string;
  yieldPercent: string;
  cost: string | null;
  costUnit: string;
  hasRecipe: boolean;
  subrecipeCost: string | null;
  stock: string | null;
  stockUnit: string;
};

/** @summary Convierte las filas de conversión del payload al formato del módulo. */
function conversionRows(rows: RecipeEditorPayload["conversions"]): UnitConversionRow[] {
  return rows.map((row) => ({ fromUnit: row.fromUnit, toUnit: row.toUnit, factor: Number(row.factor) }));
}

/** @summary Unidades disponibles: estándar + las personalizadas configuradas. */
function availableUnits(conversions: UnitConversionRow[]) {
  const units = new Set(RECIPE_UNITS);
  for (const row of conversions) {
    units.add(row.fromUnit);
    units.add(row.toUnit);
  }
  return [...units].sort((first, second) => first.localeCompare(second, "es"));
}

/** @summary Costo por unidad base del ingrediente (subreceta usa su costo calculado). */
function lineUnitCost(line: EditorLine): number | null {
  const raw = line.hasRecipe ? line.subrecipeCost : line.cost;
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** @summary Calcula el costo de una línea con merma y conversión; null si no es calculable. */
function computeLineCost(line: EditorLine, conversions: UnitConversionRow[]): number | null {
  const unitCost = lineUnitCost(line);
  if (unitCost === null) return null;
  const quantity = Number(line.quantity);
  const yieldPercent = Number(line.yieldPercent || 100);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const effective = quantity * (100 / yieldPercent);
  try {
    return convertQuantity(effective, line.unit, line.costUnit, conversions) * unitCost;
  } catch {
    return null;
  }
}

/** @summary Muestra un error de operación sin romper la pantalla. */
async function showError(title: string, reason: unknown) {
  await Swal.fire({
    title,
    text: reason instanceof Error ? reason.message : "Intentá nuevamente.",
    icon: "error",
    background: "#18181b",
    color: "#fafafa",
  });
}

/** @summary Editor visual de la receta de un producto con costo en vivo. */
export function RecipeEditor({ initial }: { initial: RecipeEditorPayload }) {
  const [payload, setPayload] = useState<RecipeEditorPayload>(initial);
  const [lines, setLines] = useState<EditorLine[]>(initial.lines);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  const currency = payload.currency ?? "ARS";
  const conversions = useMemo(() => conversionRows(payload.conversions), [payload.conversions]);
  const units = useMemo(() => availableUnits(conversions), [conversions]);

  const patchLine = (productId: number, patch: Partial<EditorLine>) => {
    setLines((current) =>
      current.map((line) => (line.ingredientProductId === productId ? { ...line, ...patch } : line)),
    );
  };

  const removeLine = (productId: number) => {
    setLines((current) => current.filter((line) => line.ingredientProductId !== productId));
  };

  const addCandidate = (candidate: RecipeEditorPayload["candidates"][number]) => {
    if (lines.some((line) => line.ingredientProductId === candidate.id)) {
      setPickerOpen(false);
      return;
    }
    const defaultUnit = units.includes(candidate.costUnit) ? candidate.costUnit : "unidad";
    setLines((current) => [
      ...current,
      {
        ingredientProductId: candidate.id,
        name: candidate.name,
        quantity: "1",
        unit: defaultUnit,
        yieldPercent: "100",
        cost: candidate.cost,
        costUnit: candidate.costUnit,
        hasRecipe: candidate.hasRecipe,
        subrecipeCost: null,
        stock: null,
        stockUnit: "unidad",
      },
    ]);
    setPickerOpen(false);
    setPickerSearch("");
  };

  /** @summary Costo total en vivo: suma de líneas calculables o null si está incompleta. */
  const live = useMemo(() => {
    const computed = lines.map((line) => computeLineCost(line, conversions));
    const reasons: string[] = [];
    const lineWarnings: Array<{ productId: number; message: string }> = [];
    lines.forEach((line, index) => {
      const unitCost = lineUnitCost(line);
      if (unitCost === null) {
        lineWarnings.push({
          productId: line.ingredientProductId,
          message: line.hasRecipe
            ? `${line.name} es una subreceta sin costo calculado`
            : `${line.name} no tiene costo configurado`,
        });
      } else if (computed[index] === null) {
        lineWarnings.push({
          productId: line.ingredientProductId,
          message: `No se puede convertir "${unitLabel(line.unit)}" a "${unitLabel(line.costUnit)}" en ${line.name}`,
        });
      }
      if (Number(line.yieldPercent) > 0 && Number(line.yieldPercent) < 100) {
        // La merma ya está incluida en el costo de la línea; solo se informa.
      }
    });
    const computable = computed.every((value) => value !== null);
    const total = computable ? computed.reduce((sum, value) => sum + (value ?? 0), 0) : null;
    if (lines.length === 0) reasons.push("La receta está vacía: agregá al menos un ingrediente");
    return { total, reasons, lineWarnings };
  }, [conversions, lines]);

  const pickerResults = useMemo(() => {
    const query = pickerSearch.trim().toLocaleLowerCase("es");
    const added = new Set(lines.map((line) => line.ingredientProductId));
    return payload.candidates.filter((candidate) => {
      if (added.has(candidate.id)) return false;
      if (query && !candidate.name.toLocaleLowerCase("es").includes(query)) return false;
      return true;
    });
  }, [lines, payload.candidates, pickerSearch]);

  /** @summary Guarda la receta y recarga el desglose calculado por el servidor. */
  const save = async () => {
    setBusy(true);
    try {
      const response = await scopedFetch(`/api/admin/recipes/${payload.product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: lines.map((line) => ({
            ingredientProductId: line.ingredientProductId,
            quantity: line.quantity,
            unit: line.unit,
            yieldPercent: line.yieldPercent,
          })),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string; payload?: RecipeEditorPayload };
      if (!response.ok) throw new Error(body.error ?? "No se pudo guardar la receta");
      if (body.payload) {
        setPayload(body.payload);
        setLines(body.payload.lines);
      }
      await Swal.fire({
        title: "Receta guardada",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
        background: "#18181b",
        color: "#fafafa",
      });
    } catch (reason) {
      await showError("No se pudo guardar la receta", reason);
    } finally {
      setBusy(false);
    }
  };

  const money = (value: number | null | undefined) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—";
    return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Recetas"
        title={payload.product.name}
        section="recetas"
        description={`Costo de receta por unidad · precio ${money(
          payload.product.price === null ? null : Number(payload.product.price),
        )}`}
        actions={
          <>
            <a
              href={currentAdminHref("/admin/recetas")}
              className="btn btn-secondary"
            >
              ← Volver
            </a>
            <button onClick={save} className="btn" disabled={busy}>
              {busy ? "Guardando…" : "Guardar receta"}
            </button>
          </>
        }
      >
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusLabels[payload.product.status] ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-500/15 text-zinc-300"}`}>
            {statusLabels[payload.product.status] ?? payload.product.status}
          </span>
          {live.total !== null ? (
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-bold text-emerald-300">
              Costo por unidad: {money(live.total)}
            </span>
          ) : (
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-sm font-bold text-amber-300">
              Costo incompleto
            </span>
          )}
        </div>
      </AdminPageHeader>

      {/* Alertas de receta incompleta */}
      {(live.lineWarnings.length > 0 || live.reasons.length > 0 || payload.incomplete) && (
        <div className="mb-5 rounded-[1.25rem] border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="font-bold text-amber-300">Falta completar la receta</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[var(--admin-muted)]">
            {live.lineWarnings.map((warning) => (
              <li key={`warning-${warning.productId}`}>{warning.message}</li>
            ))}
            {live.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          {payload.incomplete && payload.reasons.length > 0 && live.total !== null && (
            <p className="mt-2 text-xs text-[var(--admin-muted)]">
              (El servidor aún detecta: {payload.reasons.join(" · ")})
            </p>
          )}
        </div>
      )}

      {/* Editor de líneas */}
      <div className="rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-xl shadow-black/10 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black">Ingredientes</h2>
          <button type="button" className="btn" onClick={() => { setPickerOpen((open) => !open); setPickerSearch(""); }}>
            + Agregar ingrediente
          </button>
        </div>

        {pickerOpen && (
          <div className="mb-4 rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] p-4">
            <input
              autoFocus
              value={pickerSearch}
              onChange={(event) => setPickerSearch(event.target.value)}
              placeholder="Buscar ingrediente o subreceta…"
              className="input mb-3"
              aria-label="Buscar ingrediente"
            />
            <div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {pickerResults.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  disabled={candidate.blockedByCycle}
                  onClick={() => addCandidate(candidate)}
                  className="rounded-xl border border-[var(--admin-border)] bg-white/[0.02] px-3 py-2 text-left transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  title={candidate.blockedByCycle ? "Agregarlo generaría un ciclo de subrecetas" : undefined}
                >
                  <span className="block truncate font-semibold">{candidate.name}</span>
                  <span className="block text-xs text-[var(--admin-muted)]">
                    {candidate.hasRecipe ? "Subreceta · " : ""}
                    {candidate.cost === null ? "sin costo" : `costo ${money(Number(candidate.cost))} / ${unitLabel(candidate.costUnit)}`}
                    {candidate.blockedByCycle ? " · generaría ciclo" : ""}
                  </span>
                </button>
              ))}
              {pickerResults.length === 0 && (
                <p className="col-span-full py-4 text-center text-sm text-[var(--admin-muted)]">
                  No hay más ingredientes disponibles.
                </p>
              )}
            </div>
          </div>
        )}

        {lines.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--admin-border)] p-10 text-center">
            <p className="text-lg font-bold">Receta vacía</p>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">
              Agregá el primer ingrediente para empezar a calcular el costo.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {lines.map((line) => {
              const lineCost = computeLineCost(line, conversions);
              const convertible = isConvertible(line.unit, line.costUnit, conversions);
              const merma = Number(line.yieldPercent || 100) < 100;
              return (
                <div
                  key={line.ingredientProductId}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--admin-border)] bg-white/[0.02] px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">
                      {line.name}
                      {line.hasRecipe && <span className="ml-1 text-xs font-semibold text-sky-300">subreceta</span>}
                    </p>
                    <p className="text-xs text-[var(--admin-muted)]">
                      {line.cost === null && !line.hasRecipe
                        ? "Sin costo"
                        : `Costo ${money(lineUnitCost(line) ?? null)} / ${unitLabel(line.costUnit)}`}
                      {line.stock !== null && ` · Stock ${line.stock} ${unitLabel(line.stockUnit)}`}
                    </p>
                  </div>

                  <label className="flex items-center gap-1 text-xs text-[var(--admin-muted)]">
                    Cant.
                    <input
                      className="input w-20"
                      type="number"
                      min={0.001}
                      step="0.001"
                      value={line.quantity}
                      onChange={(event) => patchLine(line.ingredientProductId, { quantity: event.target.value })}
                      aria-label={`Cantidad de ${line.name}`}
                    />
                  </label>

                  <label className="flex items-center gap-1 text-xs text-[var(--admin-muted)]">
                    Unidad
                    <select
                      className="input w-28"
                      value={line.unit}
                      onChange={(event) => patchLine(line.ingredientProductId, { unit: event.target.value })}
                      aria-label={`Unidad de ${line.name}`}
                    >
                      {units.map((unit) => (
                        <option key={unit} value={unit}>{unitLabel(unit)}</option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center gap-1 text-xs text-[var(--admin-muted)]">
                    Rend.
                    <input
                      className="input w-20"
                      type="number"
                      min={0.001}
                      max={999}
                      step="0.5"
                      value={line.yieldPercent}
                      onChange={(event) => patchLine(line.ingredientProductId, { yieldPercent: event.target.value })}
                      aria-label={`Rendimiento de ${line.name}`}
                    />
                    <span className="text-[var(--admin-muted)]">%</span>
                  </label>

                  <span className="w-28 text-right font-bold">
                    {lineCost === null ? (
                      <span className="text-amber-300">—</span>
                    ) : (
                      money(lineCost)
                    )}
                  </span>

                  <button
                    type="button"
                    onClick={() => removeLine(line.ingredientProductId)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--admin-border)] bg-white/5 text-rose-400 hover:bg-white/10"
                    aria-label={`Quitar ${line.name}`}
                  >
                    ✕
                  </button>

                  {(!convertible || lineCost === null) && (
                    <p className="w-full text-xs text-amber-300">
                      {!convertible
                        ? `La unidad ${unitLabel(line.unit)} no se puede convertir a ${unitLabel(line.costUnit)}`
                        : line.hasRecipe
                          ? "Subreceta incompleta (le faltan costos)"
                          : "Falta el costo del ingrediente"}
                      {merma && " · se aplica merma en el cálculo"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--admin-border)] bg-white/[0.02] px-4 py-3">
          <p className="text-sm text-[var(--admin-muted)]">
            {lines.length} ingrediente{lines.length === 1 ? "" : "s"}
            {live.lineWarnings.length > 0 ? ` · ${live.lineWarnings.length} alerta${live.lineWarnings.length === 1 ? "" : "s"}` : ""}
          </p>
          <p className="text-lg font-black">
            Costo por unidad:{" "}
            <span className={live.total === null ? "text-amber-300" : "text-emerald-300"}>
              {money(live.total)}
            </span>
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm text-[var(--admin-muted)]">
        El rendimiento (% de merma) ajusta la cantidad bruta: con 90% de rendimiento se necesita más
        materia prima por cada unidad. Las conversiones de unidades propias se configuran en{" "}
        <a href={currentAdminHref("/admin/ingredientes")} className="underline">Ingredientes</a>.
      </p>
    </div>
  );
}
