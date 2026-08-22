import { PrintButton } from "@/components/admin/print-button";
import { requirePermission } from "@/lib/auth";
import { adminHrefForContext } from "@/lib/routes";
import { loadRecipeFichaData } from "@/lib/recipe-data";
import { unitLabel } from "@/lib/recipe-units";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

/**
 * @summary Genera los metadatos de la vista para el tenant autorizado.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const context = await requirePermission("product.manage");
  const id = Number((await params).id);
  const product = Number.isInteger(id) ? await loadRecipeFichaData(context, id) : null;
  return { title: `${context.tenant.name} | Ficha de ${product?.product.name ?? "receta"}` };
}

/** @summary Formatea un importe con la moneda del negocio. */
function money(value: string | null | undefined, currency: string) {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(
    Number(value),
  );
}

/**
 * @summary Ficha técnica de una receta, grande e imprimible desde el navegador.
 *
 * No genera PDF: usa el diálogo de impresión nativo (`window.print`), que permite
 * guardar como PDF cuando el navegador lo soporta.
 */
export default async function RecipeFichaPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requirePermission("product.manage");
  const id = Number((await params).id);
  const payload = Number.isInteger(id) ? await loadRecipeFichaData(context, id) : null;
  if (!payload) {
    return (
      <div className="rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center">
        <p className="text-lg font-bold">Ficha no encontrada</p>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">La receta que buscás no existe en esta sucursal.</p>
      </div>
    );
  }

  const currency = payload.currency ?? "ARS";
  const date = new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeStyle: "short" }).format(new Date());
  const activeBranch = context.branches.find((branch) => branch.id === context.activeBranchId);
  const backHref = adminHrefForContext(
    context.tenant.slug,
    `/admin/recetas/${payload.product.id}`,
    activeBranch?.slug,
    context.tenant.publicGuid,
  );

  return (
    <div className="ficha-tecnica">
      {/* Reglas de impresión específicas de la ficha */}
      <style>{`
        @media print {
          .ficha-tecnica table { border-color: #000 !important; }
          .ficha-tecnica td, .ficha-tecnica th { border-color: #000 !important; color: #000 !important; }
          .ficha-tecnica .muted { color: #444 !important; }
          .ficha-tecnica .chip { border: 1px solid #000; background: #fff !important; color: #000 !important; }
        }
      `}</style>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <a href={backHref} className="btn btn-secondary">
          ← Volver a la receta
        </a>
        <PrintButton />
      </div>

      {/* Encabezado */}
      <div className="rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-xl shadow-black/10 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--admin-muted)] muted">
              {payload.tenantName}
              {payload.branchName ? ` · ${payload.branchName}` : ""}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">{payload.product.name}</h1>
            <p className="mt-2 text-sm text-[var(--admin-muted)] muted">
              Ficha técnica · {date}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)] muted">Precio de venta</p>
            <p className="mt-1 text-2xl font-black">{money(payload.product.price, currency)}</p>
            {payload.incomplete && (
              <span className="chip mt-2 inline-block rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300">
                Costo incompleto
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)] muted">Costo por unidad</p>
            <p className="mt-1 text-2xl font-black">{money(payload.totalCost, currency)}</p>
          </div>
          <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)] muted">Margen</p>
            <p className="mt-1 text-2xl font-black">{payload.margin === null ? "—" : `${payload.margin}%`}</p>
          </div>
          <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)] muted">Markup</p>
            <p className="mt-1 text-2xl font-black">{payload.markup === null ? "—" : `${payload.markup}%`}</p>
          </div>
          <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)] muted">Ingredientes</p>
            <p className="mt-1 text-2xl font-black">{payload.lines.length}</p>
          </div>
        </div>
      </div>

      {/* Tabla de la receta */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
                <th className="px-4 py-3 font-semibold">Ingrediente</th>
                <th className="px-4 py-3 font-semibold text-right">Cantidad</th>
                <th className="px-4 py-3 font-semibold text-right">Rend.</th>
                <th className="px-4 py-3 font-semibold text-right">Cant. base</th>
                <th className="px-4 py-3 font-semibold text-right">Costo unit.</th>
                <th className="px-4 py-3 font-semibold text-right">Costo línea</th>
              </tr>
            </thead>
            <tbody>
              {payload.lines.map((line, index) => (
                <tr key={`${line.ingredientProductId}-${index}`} className="transition-colors hover:bg-white/[0.02]">
                  <td className={`px-4 py-3 ${line.isSubrecipe ? "font-bold" : ""}`} style={{ paddingLeft: `${16 + line.depth * 20}px` }}>
                    {line.name}
                    {line.isSubrecipe && (
                      <span className="chip ml-2 rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-300">
                        subreceta
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {Number(line.quantity) % 1 === 0 ? line.quantity : Number(line.quantity).toFixed(3)}{" "}
                    {unitLabel(line.unit)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {Number(line.yieldPercent) % 1 === 0 ? line.yieldPercent : Number(line.yieldPercent).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {Number(line.convertedQuantity) % 1 === 0
                      ? line.convertedQuantity
                      : Number(line.convertedQuantity).toFixed(3)}{" "}
                    {unitLabel(line.baseUnit)}
                  </td>
                  <td className="px-4 py-3 text-right">{money(line.unitCost, currency)}</td>
                  <td className="px-4 py-3 text-right font-bold">{money(line.lineCost, currency)}</td>
                </tr>
              ))}
              {payload.lines.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[var(--admin-muted)] muted">
                    Esta preparación no tiene ingredientes cargados.
                  </td>
                </tr>
              )}
            </tbody>
            {payload.lines.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[var(--admin-border)]">
                  <td colSpan={5} className="px-4 py-3 text-right text-sm font-black uppercase tracking-wide">
                    Costo total por unidad
                  </td>
                  <td className="px-4 py-3 text-right text-lg font-black">{money(payload.totalCost, currency)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {payload.reasons.length > 0 && (
        <div className="mt-5 rounded-[1.25rem] border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="font-bold text-amber-300">Observaciones de la receta</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[var(--admin-muted)] muted">
            {payload.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Información complementaria */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {payload.usedIn.length > 0 && (
          <div className="rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
            <h2 className="text-base font-black">Se usa en</h2>
            <ul className="mt-2 list-inside list-disc text-sm text-[var(--admin-muted)] muted">
              {payload.usedIn.map((entry) => (
                <li key={entry.id}>{entry.name}</li>
              ))}
            </ul>
          </div>
        )}
        {payload.recentCostHistory.length > 0 && (
          <div className="rounded-[1.5rem] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
            <h2 className="text-base font-black">Historial de costo</h2>
            <ul className="mt-2 space-y-1 text-sm text-[var(--admin-muted)] muted">
              {payload.recentCostHistory.map((entry, index) => (
                <li key={`${entry.createdAt}-${index}`}>
                  {money(entry.cost, currency)} / {unitLabel(entry.unit)} ·{" "}
                  {new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(new Date(entry.createdAt))}
                  {entry.reason ? ` · ${entry.reason}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-[var(--admin-muted)] muted">
        Generado con MenuClick · Ficha técnica de {payload.product.name}
      </p>
    </div>
  );
}
