"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Swal from "sweetalert2";
import { PageHeader, Tabs, StatusBadge } from "@/components/admin/ui";
import { adminHrefFromPathname } from "@/lib/routes";
import { scopedFetch } from "@/lib/client-routing";
import { unitLabel } from "@/lib/recipe-units";

/**
 * @summary Ficha de ingrediente con tabs: general, unidad, costos, stock, conversiones, recetas, histórico.
 */

type Ingredient = {
  id: number;
  name: string;
  status: string;
  cost: string | null;
  costUnit: string;
};

type Stock = { branchId: number; branchName: string; current: string; minimum: string; tracked: boolean; unit: string };

type CostHistoryEntry = { cost: string; unit: string; reason: string | null; createdAt: string };

type Conversion = { fromUnit: string; toUnit: string; factor: string };

type UsedIn = { id: number; name: string; status: string };

type Payload = {
  product: Ingredient;
  stocks: Stock[];
  costHistory: CostHistoryEntry[];
  conversions: Conversion[];
  usedIn: UsedIn[];
};

export function IngredientFicha({ initial }: { initial: Payload }) {
  const pathname = usePathname();
  const adminHref = (href: string) => adminHrefFromPathname(pathname, href);
  const [payload, setPayload] = useState<Payload>(initial);
  const [tab, setTab] = useState("general");
  const [busy, setBusy] = useState(false);

  const currency = "ARS";

  const money = (value: string | null | undefined) => {
    if (value === null || value === undefined || value === "") return "—";
    return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value));
  };

  const refresh = async () => {
    try {
      const res = await scopedFetch(`/api/admin/ingredients/${payload.product.id}`, { cache: "no-store" });
      if (res.ok) setPayload(await res.json());
    } catch {
      // silent
    }
  };

  const updateCost = async () => {
    const result = await Swal.fire({
      title: "Actualizar costo",
      html: `
        <div class="text-left space-y-3">
          <p class="text-sm text-zinc-400">Costo actual: <strong class="text-white">${money(payload.product.cost)}</strong></p>
          <div>
            <label class="block text-sm font-bold text-zinc-400 mb-1">Nuevo costo</label>
            <input id="ingredient-cost" type="number" step="0.01" value="${payload.product.cost ?? ""}" class="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-white" />
          </div>
          <div>
            <label class="block text-sm font-bold text-zinc-400 mb-1">Motivo (opcional)</label>
            <input id="ingredient-reason" type="text" class="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-white" />
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
      background: "#18181b",
      color: "#fafafa",
      preConfirm: () => {
        const cost = Number((document.getElementById("ingredient-cost") as HTMLInputElement)?.value);
        const reason = (document.getElementById("ingredient-reason") as HTMLInputElement)?.value.trim();
        if (!cost || cost <= 0) {
          Swal.showValidationMessage("Ingresá un costo válido");
          return false;
        }
        return { cost, reason };
      },
    });

    if (!result.isConfirmed || !result.value) return;
    const { cost, reason } = result.value as { cost: number; reason?: string };
    setBusy(true);
    try {
      const res = await scopedFetch(`/api/admin/ingredients/${payload.product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cost, reason: reason || undefined }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "No se pudo actualizar");
      await Swal.fire({ title: "Costo actualizado", icon: "success", timer: 1500, showConfirmButton: false, background: "#18181b", color: "#fafafa" });
      await refresh();
    } catch (reason) {
      await showError("No se pudo actualizar el costo", reason);
    } finally {
      setBusy(false);
    }
  };

  async function showError(title: string, reason: unknown) {
    await Swal.fire({ title, text: reason instanceof Error ? reason.message : "Intentá nuevamente.", icon: "error", background: "#18181b", color: "#fafafa" });
  }

  const tabs = useMemo(() => [
    { key: "general", label: "General" },
    { key: "unidad", label: "Unidad" },
    { key: "costos", label: "Costos" },
    { key: "stock", label: "Stock por sucursal" },
    { key: "conversiones", label: "Conversiones" },
    { key: "recetas", label: "Recetas donde se usa" },
    { key: "historico", label: "Histórico de costo" },
  ], []);

  return (
    <div>
      <PageHeader
        eyebrow="Ingredientes"
        title={payload.product.name}
        section="ingredientes"
        description="Ficha técnica del ingrediente con costo, stock y uso en recetas."
        actions={
          <>
            <a href={adminHref("/admin/ingredientes")} className="btn btn-secondary">
              ← Volver
            </a>
            <a href={adminHref(`/admin/ingredientes/${payload.product.id}/editar`)} className="btn">
              Editar
            </a>
          </>
        }
      />

      <Tabs tabs={tabs} defaultTab="general" onChange={setTab} />

      <div className="mt-5">
        {tab === "general" && (
          <div className="rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-xl shadow-black/10">
            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>
          </div>
        )}

        {tab === "unidad" && (
          <div className="rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-xl shadow-black/10">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Unidad base</p>
                <p className="mt-1 text-lg font-black">{unitLabel(payload.product.costUnit)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Costo actual</p>
                <p className="mt-1 text-lg font-black">{money(payload.product.cost)}</p>
              </div>
            </div>
          </div>
        )}

        {tab === "costos" && (
          <div className="rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-xl shadow-black/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Costo actual</h2>
                <p className="mt-1 text-sm text-[var(--admin-muted)]">Por {unitLabel(payload.product.costUnit)}</p>
              </div>
              <button type="button" onClick={updateCost} className="btn" disabled={busy}>
                {busy ? "Guardando…" : "Actualizar costo"}
              </button>
            </div>
            <p className="mt-4 text-3xl font-black">{money(payload.product.cost)}</p>

            <div className="mt-6">
              <h3 className="text-base font-black">Historial de costos</h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--admin-border)] text-xs uppercase tracking-wide text-[var(--admin-muted)]">
                      <th className="px-4 py-3 font-semibold">Costo</th>
                      <th className="px-4 py-3 font-semibold">Unidad</th>
                      <th className="px-4 py-3 font-semibold">Motivo</th>
                      <th className="px-4 py-3 font-semibold">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.costHistory.map((entry, index) => (
                      <tr key={`${entry.createdAt}-${index}`} className="border-b border-[var(--admin-border)]/60 last:border-0">
                        <td className="px-4 py-3 font-bold">{money(entry.cost)}</td>
                        <td className="px-4 py-3">{unitLabel(entry.unit)}</td>
                        <td className="px-4 py-3 text-[var(--admin-muted)]">{entry.reason ?? "—"}</td>
                        <td className="px-4 py-3 text-[var(--admin-muted)]">
                          {new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.createdAt))}
                        </td>
                      </tr>
                    ))}
                    {payload.costHistory.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-[var(--admin-muted)]">Sin historial</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "stock" && (
          <div className="rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
            <div className="p-5">
              <h2 className="text-lg font-black">Stock por sucursal</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--admin-border)] text-xs uppercase tracking-wide text-[var(--admin-muted)]">
                    <th className="px-4 py-3 font-semibold">Sucursal</th>
                    <th className="px-4 py-3 font-semibold text-right">Actual</th>
                    <th className="px-4 py-3 font-semibold text-right">Mínimo</th>
                    <th className="px-4 py-3 font-semibold text-center">Controlado</th>
                    <th className="px-4 py-3 font-semibold">Unidad</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.stocks.map((stock) => (
                    <tr key={stock.branchId} className="border-b border-[var(--admin-border)]/60 last:border-0">
                      <td className="px-4 py-3 font-semibold">{stock.branchName}</td>
                      <td className="px-4 py-3 text-right">{Number(stock.current).toLocaleString("es-AR")}</td>
                      <td className="px-4 py-3 text-right">{Number(stock.minimum).toLocaleString("es-AR")}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${stock.tracked ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-500/15 text-zinc-400"}`}>
                          {stock.tracked ? "Sí" : "No"}
                        </span>
                      </td>
                      <td className="px-4 py-3">{unitLabel(stock.unit)}</td>
                    </tr>
                  ))}
                  {payload.stocks.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-[var(--admin-muted)]">Sin existencias configuradas</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "conversiones" && (
          <div className="rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
            <div className="p-5">
              <h2 className="text-lg font-black">Conversiones de unidades</h2>
              <p className="mt-1 text-sm text-[var(--admin-muted)]">Reglas configuradas para el negocio.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--admin-border)] text-xs uppercase tracking-wide text-[var(--admin-muted)]">
                    <th className="px-4 py-3 font-semibold">Origen</th>
                    <th className="px-4 py-3 font-semibold text-right">Factor</th>
                    <th className="px-4 py-3 font-semibold">Destino</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.conversions.map((conv, index) => (
                    <tr key={`${conv.fromUnit}-${conv.toUnit}-${index}`} className="border-b border-[var(--admin-border)]/60 last:border-0">
                      <td className="px-4 py-3">{unitLabel(conv.fromUnit)}</td>
                      <td className="px-4 py-3 text-right font-bold">{Number(conv.factor).toLocaleString("es-AR")}</td>
                      <td className="px-4 py-3">{unitLabel(conv.toUnit)}</td>
                    </tr>
                  ))}
                  {payload.conversions.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-[var(--admin-muted)]">Sin conversiones configuradas</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "recetas" && (
          <div className="rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
            <div className="p-5">
              <h2 className="text-lg font-black">Recetas donde se usa</h2>
              <p className="mt-1 text-sm text-[var(--admin-muted)]">Productos que incluyen este ingrediente en su preparación.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--admin-border)] text-xs uppercase tracking-wide text-[var(--admin-muted)]">
                    <th className="px-4 py-3 font-semibold">Producto</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.usedIn.map((entry) => (
                    <tr key={entry.id} className="border-b border-[var(--admin-border)]/60 last:border-0 hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-semibold">{entry.name}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={entry.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a href={adminHref(`/admin/recetas/${entry.id}`)} className="inline-flex h-8 items-center rounded-lg border border-[var(--admin-border)] bg-white/5 px-3 text-xs font-semibold transition-colors hover:bg-white/10">
                          Ver receta
                        </a>
                      </td>
                    </tr>
                  ))}
                  {payload.usedIn.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-[var(--admin-muted)]">No se usa en ninguna receta</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "historico" && (
          <div className="rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-xl shadow-black/10">
            <h2 className="text-lg font-black">Histórico de costo</h2>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">Registro cronológico de cambios de costo.</p>
            <div className="mt-4 space-y-3">
              {payload.costHistory.map((entry, index) => (
                <div key={`${entry.createdAt}-${index}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--admin-border)] bg-white/[0.02] px-4 py-3">
                  <div className="flex-1">
                    <p className="font-bold">{money(entry.cost)} <span className="text-sm font-normal text-[var(--admin-muted)]">/ {unitLabel(entry.unit)}</span></p>
                    {entry.reason && <p className="text-xs text-[var(--admin-muted)]">{entry.reason}</p>}
                  </div>
                  <p className="text-xs text-[var(--admin-muted)]">
                    {new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))}
                  </p>
                </div>
              ))}
              {payload.costHistory.length === 0 && (
                <p className="py-6 text-center text-[var(--admin-muted)]">Sin registros históricos</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
