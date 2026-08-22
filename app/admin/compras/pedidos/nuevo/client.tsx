"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import Swal from "sweetalert2";
import { Icon } from "@/components/admin/ui/icons";
import { dateLabel, money } from "@/lib/helpers";
import { api, showError } from "@/lib/client-helpers";
import { adminHrefFromPathname } from "@/lib/routes";

type Supplier = { id: number; name: string; code?: string | null; paymentTerms?: string | null; currency?: string | null };
type Branch = { id: number; name: string; slug: string };
type Product = { id: number; name: string; cost?: number | string | null; costUnit?: string | null };

type LineDraft = {
  key: string;
  productId: number;
  name: string;
  quantity: string;
  unit: string;
  unitCost: string;
  discountPercent: string;
};

/**
 * @summary Ficha editable para crear un nuevo pedido de compra estilo BC.
 * Proveedor -> Fechas -> Lineas -> Guardar. Genera numero automatico.
 */
export function ComprasNuevoPedidoClient({
  suppliers,
  branches,
  products,
  activeBranchId,
}: {
  suppliers: Supplier[];
  branches: Branch[];
  products: Product[];
  activeBranchId: number | null;
}) {
  const pathname = usePathname();
  const href = (path: string) => adminHrefFromPathname(pathname, path);
  const router = useRouter();

  const [supplierId, setSupplierId] = useState("");
  const [branchId, setBranchId] = useState(activeBranchId ? String(activeBranchId) : "");
  const [orderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingHeader, setEditingHeader] = useState(true);

  const selectedSupplier = suppliers.find((s) => String(s.id) === supplierId);

  const searchResults = useMemo(() => {
    const q = productSearch.trim().toLocaleLowerCase("es");
    if (!q) return [];
    return products.filter((p) => p.name.toLocaleLowerCase("es").includes(q) && !lines.some((l) => l.productId === p.id)).slice(0, 8);
  }, [products, productSearch, lines]);

  const total = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0) * (1 - (Number(l.discountPercent) || 0) / 100), 0);

  function addLine(product: Product) {
    setLines((prev) => [...prev, {
      key: `line-${Date.now()}-${product.id}`,
      productId: product.id,
      name: product.name,
      quantity: "1",
      unit: product.costUnit || "unidad",
      unitCost: product.cost !== null && product.cost !== undefined ? String(product.cost) : "",
      discountPercent: "0",
    }]);
    setProductSearch("");
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function updateLine(key: string, field: keyof LineDraft, value: string) {
    setLines((prev) => prev.map((l) => l.key === key ? { ...l, [field]: value } : l));
  }

  async function save() {
    if (!supplierId) {
      await Swal.fire({ title: "Seleccioná un proveedor", icon: "warning", background: "#18181b", color: "#fafafa" });
      return;
    }
    if (!branchId) {
      await Swal.fire({ title: "Seleccioná una sucursal", icon: "warning", background: "#18181b", color: "#fafafa" });
      return;
    }
    if (!lines.length) {
      await Swal.fire({ title: "Agregá al menos un producto", icon: "warning", background: "#18181b", color: "#fafafa" });
      return;
    }

    setSaving(true);
    try {
      const result = await api<{ item: { id: number; number: string } }>("/api/admin/compras", {
        method: "POST",
        body: JSON.stringify({
          supplierId: Number(supplierId),
          branchId: Number(branchId),
          orderDate,
          expectedDate: expectedDate || null,
          externalReference: externalReference || undefined,
          notes: notes || undefined,
          lines: lines.map((l) => ({
            productId: l.productId,
            quantity: Number(l.quantity) || 1,
            unit: l.unit || "unidad",
            unitCost: Number(l.unitCost) || 0,
            discountPercent: Number(l.discountPercent) || 0,
          })),
        }),
      });

      await Swal.fire({
        title: `Pedido ${result.item.number} creado`,
        text: "El pedido no modifica stock. Se recibe al confirmar la recepcion.",
        icon: "success", timer: 2000, showConfirmButton: false, background: "#18181b", color: "#fafafa",
      });
      router.push(href(`/admin/compras/pedidos/${result.item.id}`));
    } catch (reason) {
      await showError("No se pudo crear el pedido", reason);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--admin-background)" }}>
      {/* Header */}
      <div style={{ background: "var(--admin-surface)" }} className="relative">
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, var(--admin-primary-strong), var(--admin-primary), transparent)" }} />
        <div className="mx-auto max-w-[1600px] px-8 pt-6 pb-5">
          <nav className="mb-5 flex items-center gap-2 text-xs" style={{ color: "var(--admin-muted)" }}>
            <Link href={href("/admin/compras")} className="transition-colors hover:opacity-70">Compras</Link>
            <span className="opacity-40">/</span>
            <Link href={href("/admin/compras/pedidos")} className="transition-colors hover:opacity-70">Pedidos</Link>
            <span className="opacity-40">/</span>
            <span className="font-medium" style={{ color: "var(--admin-text)" }}>Nuevo pedido</span>
          </nav>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight leading-none" style={{ color: "var(--admin-text)" }}>Nuevo pedido de compra</h1>
              <p className="mt-2 text-sm" style={{ color: "var(--admin-muted)" }}>Seleccioná proveedor, completá las fechas y agregá las lineas.</p>
            </div>
            <div className="flex gap-2 pb-0.5">
              <Link href={href("/admin/compras/pedidos") as never} className="rounded-lg px-4 py-2 text-xs font-semibold transition-all hover:opacity-80" style={{ border: "1px solid var(--admin-border)", color: "var(--admin-muted)" }}>Cancelar</Link>
              <button type="button" className="rounded-lg px-5 py-2 text-xs font-bold text-white transition-all hover:opacity-90" style={{ background: "var(--admin-primary-strong)" }} onClick={() => void save()} disabled={saving}>
                {saving ? "Guardando..." : "Crear pedido"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-[1600px] px-8 py-6 space-y-5">
        {/* General */}
        <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
          <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--admin-border)", background: "color-mix(in srgb, var(--admin-surface-elevated) 30%, var(--admin-surface))" }}>
            <h3 className="text-sm font-bold" style={{ color: "var(--admin-text)" }}>General</h3>
          </div>
          <div className="grid gap-x-12 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 p-6">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--admin-muted)" }}>Proveedor *</label>
              <select className="input w-full py-1.5 text-sm rounded-lg" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Seleccionar proveedor...</option>
                {suppliers.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
              </select>
              {selectedSupplier?.paymentTerms && <p className="text-[11px] mt-1" style={{ color: "var(--admin-muted)" }}>Condiciones: {selectedSupplier.paymentTerms}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--admin-muted)" }}>Sucursal *</label>
              <select className="input w-full py-1.5 text-sm rounded-lg" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">Seleccionar sucursal...</option>
                {branches.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--admin-muted)" }}>Fecha del documento</label>
              <input className="input w-full py-1.5 text-sm rounded-lg" type="date" value={orderDate} readOnly />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--admin-muted)" }}>Fecha recepcion prevista</label>
              <input className="input w-full py-1.5 text-sm rounded-lg" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--admin-muted)" }}>Referencia proveedor</label>
              <input className="input w-full py-1.5 text-sm rounded-lg" value={externalReference} onChange={(e) => setExternalReference(e.target.value)} placeholder="Nro remito, OC proveedor..." />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--admin-muted)" }}>Moneda</label>
              <input className="input w-full py-1.5 text-sm rounded-lg" value="ARS" readOnly />
            </div>
          </div>
          {notes !== "" && (
            <div className="px-6 pb-5">
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--admin-muted)" }}>Notas</label>
              <textarea className="input w-full min-h-16 text-sm rounded-lg" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas del pedido..." />
            </div>
          )}
        </div>

        {/* Lines */}
        <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
          <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--admin-border)", background: "color-mix(in srgb, var(--admin-surface-elevated) 30%, var(--admin-surface))" }}>
            <h3 className="text-sm font-bold" style={{ color: "var(--admin-text)" }}>Lineas ({lines.length})</h3>
          </div>

          {/* Product search */}
          <div className="px-6 py-3" style={{ borderBottom: "1px solid var(--admin-border)" }}>
            <div className="relative">
              <input className="input w-full py-2 text-sm rounded-lg" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Buscar producto para agregar..." />
              {searchResults.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-xl overflow-hidden shadow-xl" style={{ background: "var(--admin-surface-elevated)", border: "1px solid var(--admin-border)" }}>
                  {searchResults.map((p) => (
                    <button key={p.id} type="button" className="w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors" style={{ color: "var(--admin-text)" }}
                      onClick={() => addLine(p)}
                      onMouseEnter={(e) => e.currentTarget.style.background = "color-mix(in srgb, var(--admin-primary) 8%, transparent)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-xs" style={{ color: "var(--admin-muted)" }}>{p.cost ? money(p.cost, "ARS") : "sin costo"} / {p.costUnit || "unidad"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Lines table */}
          {lines.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Icon name="package" className="mx-auto text-3xl mb-3" style={{ color: "var(--admin-muted)", opacity: 0.4 }} />
              <p className="text-sm" style={{ color: "var(--admin-muted)" }}>Busca y selecciona productos para agregar lineas al pedido.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--admin-border)", background: "color-mix(in srgb, var(--admin-surface-elevated) 50%, var(--admin-surface))" }} className="text-[10px] uppercase tracking-wider">
                    <th className="px-4 py-2.5" style={{ color: "var(--admin-muted)" }}>#</th>
                    <th className="px-4 py-2.5" style={{ color: "var(--admin-muted)" }}>Articulo</th>
                    <th className="px-4 py-2.5" style={{ color: "var(--admin-muted)" }}>UdM</th>
                    <th className="px-4 py-2.5 text-right" style={{ color: "var(--admin-muted)" }}>Cantidad</th>
                    <th className="px-4 py-2.5 text-right" style={{ color: "var(--admin-muted)" }}>Costo</th>
                    <th className="px-4 py-2.5 text-right" style={{ color: "var(--admin-muted)" }}>Dto %</th>
                    <th className="px-4 py-2.5 text-right" style={{ color: "var(--admin-muted)" }}>Importe</th>
                    <th className="px-4 py-2.5 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => {
                    const qty = Number(line.quantity) || 0;
                    const cost = Number(line.unitCost) || 0;
                    const dto = Number(line.discountPercent) || 0;
                    const lineTotal = qty * cost * (1 - dto / 100);
                    return (
                      <tr key={line.key} style={{ borderBottom: "1px solid var(--admin-border)" }}>
                        <td className="px-4 py-2 tabular-nums" style={{ color: "var(--admin-muted)" }}>{String((idx + 1) * 10000).padStart(5, "0")}</td>
                        <td className="px-4 py-2 font-semibold" style={{ color: "var(--admin-text)" }}>{line.name}</td>
                        <td className="px-4 py-2" style={{ color: "var(--admin-muted)" }}>{line.unit}</td>
                        <td className="px-4 py-2 text-right"><input type="number" min={0} step="0.001" value={line.quantity} onChange={(e) => updateLine(line.key, "quantity", e.target.value)} className="input w-16 py-1 px-1.5 text-right text-xs rounded-lg" /></td>
                        <td className="px-4 py-2 text-right"><input type="number" min={0} step="0.01" value={line.unitCost} onChange={(e) => updateLine(line.key, "unitCost", e.target.value)} className="input w-24 py-1 px-1.5 text-right text-xs rounded-lg" /></td>
                        <td className="px-4 py-2 text-right"><input type="number" min={0} max={100} step="0.01" value={line.discountPercent} onChange={(e) => updateLine(line.key, "discountPercent", e.target.value)} className="input w-14 py-1 px-1.5 text-right text-xs rounded-lg" /></td>
                        <td className="px-4 py-2 text-right font-bold tabular-nums" style={{ color: "var(--admin-text)" }}>{money(lineTotal, "ARS")}</td>
                        <td className="px-4 py-2 text-center">
                          <button type="button" onClick={() => removeLine(line.key)} className="rounded p-1 transition-colors" style={{ color: "var(--admin-danger)" }}
                            onMouseEnter={(e) => e.currentTarget.style.background = "color-mix(in srgb, var(--admin-danger) 10%, transparent)"}
                            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                            <Icon name="x" className="text-xs" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--admin-border)", background: "color-mix(in srgb, var(--admin-surface-elevated) 30%, var(--admin-surface))" }}>
                    <td className="px-5 py-3.5 font-bold text-xs" colSpan={6} style={{ color: "var(--admin-text)" }}>Total estimado</td>
                    <td className="px-5 py-3.5 text-right font-extrabold tabular-nums text-xs" style={{ color: "var(--admin-text)" }}>{money(total, "ARS")}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Footer note */}
        <p className="text-xs px-1" style={{ color: "var(--admin-muted)" }}>
          Guardar el pedido no modifica inventario. El stock aumentara recien cuando confirmes la recepcion.
        </p>
      </div>
    </div>
  );
}
