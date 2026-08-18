"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Swal from "sweetalert2";
import { PageHeader, Tabs, SearchBox, EmptyState, StatusBadge } from "@/components/admin/ui";
import { scopedFetch } from "@/lib/client-routing";
import { adminHrefFromPathname } from "@/lib/routes";
import { RECIPE_UNITS, convertQuantity, unitLabel, type UnitConversionRow } from "@/lib/recipe-units";
import type { RecipeEditorPayload } from "@/lib/recipe-data";

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

function conversionRows(rows: RecipeEditorPayload["conversions"]): UnitConversionRow[] {
  return rows.map((row) => ({ fromUnit: row.fromUnit, toUnit: row.toUnit, factor: Number(row.factor) }));
}

function availableUnits(conversions: UnitConversionRow[]) {
  const units = new Set(RECIPE_UNITS);
  for (const row of conversions) {
    units.add(row.fromUnit);
    units.add(row.toUnit);
  }
  return [...units].sort((first, second) => first.localeCompare(second, "es"));
}

function lineUnitCost(line: EditorLine): number | null {
  const raw = line.hasRecipe ? line.subrecipeCost : line.cost;
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

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

async function showError(title: string, reason: unknown) {
  await Swal.fire({
    title,
    text: reason instanceof Error ? reason.message : "Intentá nuevamente.",
    icon: "error",
    background: "#18181b",
    color: "#fafafa",
  });
}

function percent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value}%`;
}

export function RecipeEditor({ initial }: { initial: RecipeEditorPayload }) {
  const pathname = usePathname();
  const adminHref = (href: string) => adminHrefFromPathname(pathname, href);
  const [payload, setPayload] = useState<RecipeEditorPayload>(initial);
  const [lines, setLines] = useState<EditorLine[]>(initial.lines);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [tab, setTab] = useState("general");

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

  const subrecipes = useMemo(() => lines.filter((line) => line.hasRecipe), [lines]);

  const aggregateYield = useMemo(() => {
    if (lines.length === 0) return null;
    const yields = lines.map((line) => Number(line.yieldPercent || 100));
    const avg = yields.reduce((a, b) => a + b, 0) / yields.length;
    return avg;
  }, [lines]);

  const tabs = useMemo(() => [
    { key: "general", label: "General" },
    { key: "ingredientes", label: "Ingredientes" },
    { key: "subrecetas", label: "Subrecetas" },
    { key: "costo", label: "Costo" },
    { key: "rendimiento", label: "Rendimiento" },
    { key: "historico", label: "Histórico" },
  ], []);

  return (
    <div>
      <PageHeader
        eyebrow="Recetas"
        title={payload.product.name}
        section="recetas"
        description={`Costo de receta por unidad · precio ${money(
          payload.product.price === null ? null : Number(payload.product.price),
        )}`}
        actions={
          <>
            <a href={adminHref("/admin/recetas")} className="btn btn-secondary">
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
      </PageHeader>

      <Tabs tabs={tabs} defaultTab="general" onChange={setTab} />

      <div className="mt-5">
        {tab === "general" && (
          <div className="rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-xl shadow-black/10 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Nombre</p>
                <p className="mt-1 text-lg font-black">{payload.product.name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Estado</p>
                <div className="mt-1">
                  <StatusBadge status={payload.product.status} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Precio de venta</p>
                <p className="mt-1 text-lg font-black">{money(payload.product.price === null ? null : Number(payload.product.price))}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Unidad base</p>
                <p className="mt-1 text-lg font-black">{unitLabel(payload.product.costUnit)}</p>
              </div>
            </div>
            {aggregateYield !== null && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Rendimiento promedio</p>
                  <p className="mt-1 text-lg font-black">{Number(aggregateYield).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Merma promedio</p>
                  <p className="mt-1 text-lg font-black">{(100 - aggregateYield).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Ingredientes totales</p>
                  <p className="mt-1 text-lg font-black">{lines.length}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Subrecetas</p>
                  <p className="mt-1 text-lg font-black">{subrecipes.length}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "ingredientes" && (
          <div>
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

            <div className="rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-xl shadow-black/10 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black">Ingredientes</h2>
                  <p className="mt-1 text-sm text-[var(--admin-muted)]">Agregá ingredientes o subrecetas con cantidad y unidad.</p>
                </div>
                <button type="button" className="btn" onClick={() => { setPickerOpen((open) => !open); setPickerSearch(""); }}>
                  + Agregar ingrediente
                </button>
              </div>

              {pickerOpen && (
                <div className="mb-4 rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] p-4">
                  <SearchBox value={pickerSearch} onChange={setPickerSearch} placeholder="Buscar ingrediente o subreceta…" className="mb-3" />
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
                <EmptyState title="Receta vacía" description="Agregá el primer ingrediente para empezar a calcular el costo." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--admin-border)] text-xs uppercase tracking-wide text-[var(--admin-muted)]">
                        <th className="px-4 py-3 font-semibold">Producto</th>
                        <th className="px-4 py-3 font-semibold text-right">Cantidad</th>
                        <th className="px-4 py-3 font-semibold text-right">Unidad</th>
                        <th className="px-4 py-3 font-semibold text-right">Costo unit.</th>
                        <th className="px-4 py-3 font-semibold text-right">Importe</th>
                        <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => {
                        const lineCost = computeLineCost(line, conversions);
                        const unitCost = lineUnitCost(line);
                        return (
                          <tr key={line.ingredientProductId} className="border-b border-[var(--admin-border)]/60 last:border-0">
                            <td className="px-4 py-3">
                              <p className="font-bold">
                                {line.name}
                                {line.hasRecipe && <span className="ml-2 text-xs font-semibold text-sky-300">subreceta</span>}
                              </p>
                              <p className="text-xs text-[var(--admin-muted)]">
                                Rend. {line.yieldPercent}%
                                {line.stock !== null && ` · Stock ${line.stock} ${unitLabel(line.stockUnit)}`}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <input
                                className="input w-20 text-right"
                                type="number"
                                min={0.001}
                                step="0.001"
                                value={line.quantity}
                                onChange={(event) => patchLine(line.ingredientProductId, { quantity: event.target.value })}
                                aria-label={`Cantidad de ${line.name}`}
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
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
                            </td>
                            <td className="px-4 py-3 text-right">
                              {unitCost === null ? (
                                <span className="text-amber-300">—</span>
                              ) : (
                                money(unitCost)
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-bold">
                              {lineCost === null ? (
                                <span className="text-amber-300">—</span>
                              ) : (
                                money(lineCost)
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => removeLine(line.ingredientProductId)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--admin-border)] bg-white/5 text-rose-400 hover:bg-white/10"
                                aria-label={`Quitar ${line.name}`}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

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
        )}

        {tab === "subrecetas" && (
          <div className="rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-xl shadow-black/10">
            <h2 className="text-lg font-black">Subrecetas usadas</h2>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">Preparaciones que se expanden hasta sus ingredientes base.</p>
            {subrecipes.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--admin-muted)]">Esta receta no usa subrecetas.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--admin-border)] text-xs uppercase tracking-wide text-[var(--admin-muted)]">
                      <th className="px-4 py-3 font-semibold">Subreceta</th>
                      <th className="px-4 py-3 font-semibold text-right">Cantidad</th>
                      <th className="px-4 py-3 font-semibold text-right">Unidad</th>
                      <th className="px-4 py-3 font-semibold text-right">Costo unit.</th>
                      <th className="px-4 py-3 font-semibold text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subrecipes.map((line) => {
                      const lineCost = computeLineCost(line, conversions);
                      const unitCost = lineUnitCost(line);
                      return (
                        <tr key={line.ingredientProductId} className="border-b border-[var(--admin-border)]/60 last:border-0">
                          <td className="px-4 py-3">
                            <p className="font-bold">{line.name}</p>
                            <p className="text-xs text-[var(--admin-muted)]">Rend. {line.yieldPercent}%</p>
                          </td>
                          <td className="px-4 py-3 text-right">{Number(line.quantity).toLocaleString("es-AR")}</td>
                          <td className="px-4 py-3 text-right">{unitLabel(line.unit)}</td>
                          <td className="px-4 py-3 text-right">{unitCost === null ? "—" : money(unitCost)}</td>
                          <td className="px-4 py-3 text-right font-bold">{lineCost === null ? "—" : money(lineCost)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "costo" && (
          <div className="rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-xl shadow-black/10 sm:p-6">
            <h2 className="text-lg font-black">Resumen de costo</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Costo total</p>
                <p className={`mt-1 text-2xl font-black ${live.total === null ? "text-amber-300" : "text-emerald-300"}`}>{money(live.total)}</p>
              </div>
              <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Margen</p>
                <p className="mt-1 text-2xl font-black">
                  {payload.product.price !== null ? `${percent(
                    live.total !== null ? Math.round(((Number(payload.product.price) - live.total) / Number(payload.product.price)) * 100) : null,
                  )}` : "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Markup</p>
                <p className="mt-1 text-2xl font-black">
                  {payload.product.price !== null && live.total !== null && live.total > 0
                    ? `${Math.round((Number(payload.product.price) / live.total - 1) * 100)}%`
                    : "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Ingredientes</p>
                <p className="mt-1 text-2xl font-black">{lines.length}</p>
              </div>
            </div>
            {payload.incomplete && payload.reasons.length > 0 && (
              <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="font-bold text-amber-300">Receta incompleta</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[var(--admin-muted)]">
                  {payload.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {tab === "rendimiento" && (
          <div className="rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-xl shadow-black/10 sm:p-6">
            <h2 className="text-lg font-black">Rendimiento</h2>
            {lines.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--admin-muted)]">Agregá ingredientes para ver el análisis de rendimiento.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--admin-border)] text-xs uppercase tracking-wide text-[var(--admin-muted)]">
                      <th className="px-4 py-3 font-semibold">Ingrediente</th>
                      <th className="px-4 py-3 font-semibold text-right">Cantidad</th>
                      <th className="px-4 py-3 font-semibold text-right">Rendimiento</th>
                      <th className="px-4 py-3 font-semibold text-right">Merma</th>
                      <th className="px-4 py-3 font-semibold text-right">Cant. bruta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => {
                      const yieldVal = Number(line.yieldPercent || 100);
                      const quantity = Number(line.quantity) || 0;
                      const merma = 100 - yieldVal;
                      const bruta = yieldVal > 0 ? (quantity * 100) / yieldVal : 0;
                      return (
                        <tr key={line.ingredientProductId} className="border-b border-[var(--admin-border)]/60 last:border-0">
                          <td className="px-4 py-3">
                            <p className="font-bold">{line.name}</p>
                            {line.hasRecipe && <span className="text-xs font-semibold text-sky-300">subreceta</span>}
                          </td>
                          <td className="px-4 py-3 text-right">{quantity.toLocaleString("es-AR")} {unitLabel(line.unit)}</td>
                          <td className="px-4 py-3 text-right">{yieldVal.toFixed(1)}%</td>
                          <td className="px-4 py-3 text-right">{merma.toFixed(1)}%</td>
                          <td className="px-4 py-3 text-right font-bold">{bruta.toLocaleString("es-AR", { maximumFractionDigits: 3 })} {unitLabel(line.unit)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {aggregateYield !== null && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Rendimiento promedio</p>
                  <p className="mt-1 text-2xl font-black">{aggregateYield.toFixed(1)}%</p>
                </div>
                <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Merma promedio</p>
                  <p className="mt-1 text-2xl font-black">{(100 - aggregateYield).toFixed(1)}%</p>
                </div>
                <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Cantidad producida</p>
                  <p className="mt-1 text-2xl font-black">1 {unitLabel(payload.product.costUnit)}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "historico" && (
          <div className="rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-xl shadow-black/10 sm:p-6">
            <h2 className="text-lg font-black">Histórico de cambios</h2>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">Registro de modificaciones en los costos de los ingredientes que componen esta receta.</p>
            <div className="mt-4 space-y-3">
              {lines.map((line) => {
                if (line.cost === null && line.subrecipeCost === null) return null;
                const costValue = line.hasRecipe ? line.subrecipeCost : line.cost;
                return (
                  <div key={line.ingredientProductId} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--admin-border)] bg-white/[0.02] px-4 py-3">
                    <div className="flex-1">
                      <p className="font-bold">{line.name}</p>
                      <p className="text-xs text-[var(--admin-muted)]">
                        Costo actual: {costValue === null ? "sin costo" : `${money(Number(costValue))} / ${unitLabel(line.costUnit)}`}
                      </p>
                    </div>
                    {line.hasRecipe && <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-300">subreceta</span>}
                  </div>
                );
              })}
              {lines.length === 0 && (
                <p className="py-6 text-center text-[var(--admin-muted)]">Sin ingredientes cargados.</p>
              )}
              <p className="text-xs text-[var(--admin-muted)]">
                El historial detallado de cambios por ingrediente se consulta desde la ficha de cada ingrediente en{" "}
                <a href={adminHref("/admin/ingredientes")} className="underline">Ingredientes</a>.
              </p>
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 text-sm text-[var(--admin-muted)]">
        El rendimiento (% de merma) ajusta la cantidad bruta: con 90% de rendimiento se necesita más
        materia prima por cada unidad. Las conversiones de unidades propias se configuran en{" "}
        <a href={adminHref("/admin/ingredientes")} className="underline">Ingredientes</a>.
      </p>
    </div>
  );
}
