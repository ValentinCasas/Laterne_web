"use client";import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { adminHrefFromPathname } from "@/lib/routes";
import type { RecipeBoardPayload } from "@/lib/recipe-data";

/**
 * Tablero de recetas: costo calculado, margen y estado de cada preparación.
 *
 * Permite filtrar, abrir el editor visual de receta y ver la ficha técnica
 * imprimible de cada producto. El costo de receta se calcula en el servidor
 * expandiendo subrecetas, mermas y conversiones de unidades.
 */

const statusLabels: Record<string, string> = {
  published: "Publicado",
  scheduled: "Programado",
  draft: "Borrador",
  hidden: "Oculto",
  archived: "Archivado",
};

const statusColors: Record<string, string> = {
  published: "bg-emerald-500/15 text-emerald-300",
  scheduled: "bg-sky-500/15 text-sky-300",
  draft: "bg-zinc-500/15 text-zinc-300",
  hidden: "bg-amber-500/15 text-amber-300",
  archived: "bg-rose-500/15 text-rose-300",
};

type RecipeFilter = "all" | "with" | "without" | "incomplete";

const filterLabels: Record<RecipeFilter, string> = {
  all: "Todas",
  with: "Con receta",
  without: "Sin receta",
  incomplete: "Incompletas",
};

/** @summary Formatea un importe con la moneda del negocio. */
function money(value: string | null | undefined, currency: string) {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(
    Number(value),
  );
}

/** @summary Formatea un porcentaje o devuelve "—" cuando no hay datos. */
function percent(value: number | null) {
  return value === null || value === undefined ? "—" : `${value}%`;
}

/** @summary Tablero de recetas con costo en vivo y acceso a la ficha técnica. */
export function RecipeBoard({ initial }: { initial: RecipeBoardPayload }) {
  const pathname = usePathname();
  /** Resuelve rutas administrativas conservando el contexto visible (mismo valor en SSR y cliente). */
  const adminHref = (href: string) => adminHrefFromPathname(pathname, href);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RecipeFilter>("all");
  const [statusFilter, setStatusFilter] = useState("");

  const currency = initial.currency ?? "ARS";

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    return initial.products.filter((product) => {
      if (query && !product.name.toLocaleLowerCase("es").includes(query)) return false;
      if (filter === "with" && !product.hasRecipe) return false;
      if (filter === "without" && product.hasRecipe) return false;
      if (filter === "incomplete" && !(product.hasRecipe && product.incomplete)) return false;
      if (statusFilter && product.status !== statusFilter) return false;
      return true;
    });
  }, [filter, initial.products, search, statusFilter]);

  const stats = useMemo(() => {
    const withRecipe = initial.products.filter((product) => product.hasRecipe).length;
    const incomplete = initial.products.filter((product) => product.hasRecipe && product.incomplete).length;
    const total = initial.products.length;
    return { total, withRecipe, incomplete };
  }, [initial.products]);

  const inBranchLabel = initial.activeBranch
    ? ` · ${initial.activeBranch.name}`
    : " · todas las sucursales";

  return (
    <div>
      <AdminPageHeader
        eyebrow="Costos"
        title="Recetas"
        section="recetas"
        description="Definí qué consume cada producto: agregá ingredientes con cantidad y unidad, el costo se calcula en vivo con subrecetas, mermas y conversiones. Imprimí la ficha técnica de cada preparación desde el navegador."
        actions={
          <a href={adminHref("/admin/ingredientes")} className="btn btn-secondary">
            Gestionar ingredientes
          </a>
        }
      >
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Productos</p>
            <p className="mt-1 text-2xl font-black">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Con receta</p>
            <p className="mt-1 text-2xl font-black">{stats.withRecipe}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Incompletas</p>
            <p className="mt-1 text-2xl font-black text-amber-300">{stats.incomplete}</p>
          </div>
        </div>
      </AdminPageHeader>

      <div className="mb-5 grid gap-3 rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-xl shadow-black/10 sm:grid-cols-2 lg:grid-cols-4">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre…"
          className="input"
          aria-label="Buscar recetas"
        />
        <select value={filter} onChange={(event) => setFilter(event.target.value as RecipeFilter)} className="input" aria-label="Filtrar recetas">
          {Object.entries(filterLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="input" aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <p className="flex items-center text-sm text-[var(--admin-muted)]">
          {filtered.length} producto{filtered.length === 1 ? "" : "s"}
          <span className="ml-1 hidden sm:inline">{inBranchLabel}</span>
        </p>
      </div>

      <div className="overflow-hidden rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--admin-border)] text-xs uppercase tracking-wide text-[var(--admin-muted)]">
                <th className="px-4 py-3 font-semibold">Producto</th>
                <th className="px-4 py-3 font-semibold">Receta</th>
                <th className="px-4 py-3 font-semibold text-right">Costo</th>
                <th className="px-4 py-3 font-semibold text-right">Precio</th>
                <th className="px-4 py-3 font-semibold text-right">Margen</th>
                <th className="px-4 py-3 font-semibold text-right">Markup</th>
                <th className="px-4 py-3 font-semibold text-right">Stock</th>
                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id} className="border-b border-[var(--admin-border)]/60 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold">{product.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusColors[product.status] ?? "bg-zinc-500/15 text-zinc-300"}`}>
                            {statusLabels[product.status] ?? product.status}
                          </span>
                          {product.hasRecipe && product.incomplete && (
                            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                              Falta completar
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {product.hasRecipe ? (
                      <span className="font-semibold">
                        {product.ingredientCount} ingrediente{product.ingredientCount === 1 ? "" : "s"}
                        {product.subrecipeCount > 0 && (
                          <span className="ml-1 text-[var(--admin-muted)]">· {product.subrecipeCount} subreceta{product.subrecipeCount === 1 ? "" : "s"}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[var(--admin-muted)]">Sin receta</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-bold">
                    {product.hasRecipe ? money(product.recipeCost, currency) : money(product.cost, currency)}
                  </td>
                  <td className="px-4 py-3 text-right">{money(product.price, currency)}</td>
                  <td className="px-4 py-3 text-right">{percent(product.margin)}</td>
                  <td className="px-4 py-3 text-right">{percent(product.markup)}</td>
                  <td className="px-4 py-3 text-right">{product.stock ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <a
                        href={adminHref(`/admin/recetas/${product.id}`)}
                        className="inline-flex h-9 items-center rounded-lg border border-[var(--admin-border)] bg-white/5 px-3 text-xs font-semibold transition-colors hover:bg-white/10"
                      >
                        Editar
                      </a>
                      {product.hasRecipe && (
                        <a
                          href={adminHref(`/admin/recetas/${product.id}/ficha`)}
                          className="inline-flex h-9 items-center rounded-lg border border-[var(--admin-border)] bg-white/5 px-3 text-xs font-semibold transition-colors hover:bg-white/10"
                        >
                          Ficha
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[var(--admin-muted)]">
                    No se encontraron productos con esos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-sm text-[var(--admin-muted)]">
        El costo de receta se calcula por unidad del producto, expandiendo subrecetas y aplicando merma y
        conversión de unidades. Un receta incompleta no muestra costo hasta que todos sus ingredientes tengan
        costo configurado.
      </p>
    </div>
  );
}
