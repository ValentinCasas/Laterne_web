"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { PageHeader, SearchBox, StatusBadge, EmptyState, DataTable, ActionMenu } from "@/components/admin/ui";
import { adminHrefFromPathname } from "@/lib/routes";
import type { RecipeBoardPayload } from "@/lib/recipe-data";

const statusLabels: Record<string, string> = {
  published: "Publicado",
  scheduled: "Programado",
  draft: "Borrador",
  hidden: "Oculto",
  archived: "Archivado",
};

type RecipeFilter = "all" | "with" | "without" | "incomplete";

const filterLabels: Record<RecipeFilter, string> = {
  all: "Todas",
  with: "Con receta",
  without: "Sin receta",
  incomplete: "Incompletas",
};

function money(value: string | null | undefined, currency: string) {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value));
}

function percent(value: number | null) {
  return value === null || value === undefined ? "—" : `${value}%`;
}

export function RecipeBoard({ initial }: { initial: RecipeBoardPayload }) {
  const pathname = usePathname();
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

  const columns = useMemo(() => [
    { key: "name", label: "Receta", hideOnMobile: false } as const,
    { key: "cost", label: "Costo", align: "right" as const, hideOnMobile: false } as const,
    { key: "margin", label: "Margen", align: "right" as const, hideOnMobile: true } as const,
    { key: "ingredients", label: "Cant. ingredientes", align: "left" as const, hideOnMobile: true },
    { key: "status", label: "Estado", hideOnMobile: true } as const,
  ], []);

  const data = useMemo(() =>
    filtered.map((product) => ({
      id: product.id,
      name: (
        <div className="min-w-0">
          <p className="truncate font-bold">{product.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={product.status} />
            {product.hasRecipe && product.incomplete && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                Falta completar
              </span>
            )}
          </div>
        </div>
      ),
      cost: product.hasRecipe ? (
        <span className="font-bold">{money(product.recipeCost, currency)}</span>
      ) : (
        <span className="text-[var(--admin-muted)]">{money(product.cost, currency)}</span>
      ),
      margin: percent(product.margin),
      ingredients: product.hasRecipe ? (
        <span className="font-semibold">
          {product.ingredientCount}
          {product.subrecipeCount > 0 && (
            <span className="ml-1 text-[var(--admin-muted)]">· {product.subrecipeCount} sub.</span>
          )}
        </span>
      ) : (
        <span className="text-[var(--admin-muted)]">—</span>
      ),
      status: <StatusBadge status={product.status} />,
    })),
    [filtered, currency],
  );

  const rowActions = (row: Record<string, unknown>) => {
    const product = filtered.find((p) => p.id === row.id as number);
    if (!product) return null;
    return (
      <ActionMenu
        align="right"
        items={[
          { label: "Editar", onClick: () => { window.location.href = adminHref(`/admin/recetas/${product.id}`); } },
          ...(product.hasRecipe ? [{ label: "Ficha", onClick: () => { window.location.href = adminHref(`/admin/recetas/${product.id}/ficha`); } }] : []),
        ]}
      />
    );
  };

  return (
    <div>
      <PageHeader
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
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2.5">
        <div className="min-w-52 flex-1">
          <SearchBox value={search} onChange={setSearch} placeholder="Buscar por nombre…" />
        </div>
        <select value={filter} onChange={(event) => setFilter(event.target.value as RecipeFilter)} className="input w-auto" aria-label="Filtrar recetas">
          {Object.entries(filterLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="input w-auto" aria-label="Filtrar por estado">
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

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center">
          <EmptyState title="No se encontraron productos con esos filtros" description="Probá modificar la búsqueda o los filtros aplicados." />
        </div>
      ) : (
        <DataTable
          viewStorageKey="recetas"
          columns={columns}
          data={data}
          keyExtractor={(row) => row.id as number}
          rowActions={rowActions}
          emptyMessage="No se encontraron productos con esos filtros."
        />
      )}

      <p className="mt-4 text-sm text-[var(--admin-muted)]">
        El costo de receta se calcula por unidad del producto, expandiendo subrecetas y aplicando merma y
        conversión de unidades. Un receta incompleta no muestra costo hasta que todos sus ingredientes tengan
        costo configurado.
      </p>
    </div>
  );
}
