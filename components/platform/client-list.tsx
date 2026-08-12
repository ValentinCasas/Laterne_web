"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import Swal from "sweetalert2";

type Tenant = Awaited<ReturnType<typeof import("@/lib/platform-data").platformTenants>>[number];
function storage(bytes: number) { return bytes < 1_000_000 ? `${(bytes / 1_000).toFixed(1)} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`; }
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character); }

export function ClientList({ tenants }: { tenants: Tenant[] }) {
  const [query, setQuery] = useState(""); const [status, setStatus] = useState("all"); const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [items, setItems] = useState(tenants);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const visible = useMemo(() => items.filter((tenant) => (!query.trim() || `${tenant.name} ${tenant.slug} ${tenant.brandSettings?.customDomain ?? ""}`.toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es"))) && (status === "all" || tenant.status === status || tenant.subscription?.status === status)), [query, status, items]);
  function toggle(id: number) { setExpanded((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function toggleSelect(id: number) { setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function toggleSelectAll() { if (selected.size === visible.length && visible.length > 0) setSelected(new Set()); else setSelected(new Set(visible.map((tenant) => tenant.id))); }
  async function deleteSelected() {
    const names = items.filter((tenant) => selected.has(tenant.id)).map((tenant) => tenant.name);
    if (!names.length) return;
    const confirmation = await Swal.fire({
      title: `¿Eliminar por completo ${names.length} cliente${names.length === 1 ? "" : "s"}?`,
      html: `<p style="margin:.25rem 0 1rem;font-weight:700;color:#fafafa">${names.slice(0, 5).map((name) => escapeHtml(name)).join(" · ")}${names.length > 5 ? ` <span style="opacity:.6">y ${names.length - 5} más</span>` : ""}</p><p style="margin:0;opacity:.8">Se borrará todo su contenido: carta, pedidos, sucursales, usuarios, pagos y auditoría. Esta acción no se puede deshacer.</p>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmation.isConfirmed) return;
    setDeleting(true); setMessage(null);
    const response = await fetch("/api/platform/tenants", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantIds: [...selected] }) });
    const result = (await response.json().catch(() => ({}))) as { deleted?: Array<{ id: number }>; error?: string };
    if (!response.ok || !result.deleted) {
      setDeleting(false);
      await Swal.fire({ title: "No se pudo eliminar", text: result.error ?? "Intentá nuevamente.", icon: "error", background: "#18181b", color: "#fafafa" });
      return;
    }
    const deletedIds = new Set(result.deleted.map((tenant) => tenant.id));
    setItems((current) => current.filter((tenant) => !deletedIds.has(tenant.id)));
    setSelected(new Set());
    setMessage(`Se eliminaron ${result.deleted.length} cliente${result.deleted.length === 1 ? "" : "s"} por completo.`);
    setDeleting(false);
  }
  return <section><header className="mb-7 flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-black uppercase tracking-[.25em] text-amber-300">MenuClick Platform / Operación</p><h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Clientes</h1><p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-400">Encontrá un negocio, revisá sus sucursales y abrí su administración aislada.</p></div><div className="flex flex-wrap gap-2"><button className={`rounded-xl px-4 py-3 text-sm font-black ${selected.size ? "bg-rose-500 text-white hover:bg-rose-400" : "cursor-not-allowed border border-white/10 px-4 py-3 text-sm font-bold text-slate-500"}`} disabled={!selected.size || deleting} onClick={() => void deleteSelected()} type="button">{deleting ? "Eliminando…" : selected.size ? `Eliminar seleccionados (${selected.size})` : "Eliminar seleccionados"}</button><Link className="rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-slate-950" href="/platform/clientes/nuevo">Nuevo cliente</Link></div></header>{message && <p className="mb-5 rounded-xl border border-white/10 bg-[#151a24] px-4 py-3 text-sm text-slate-300" role="status">{message}</p>}<div className="mb-5 grid gap-3 rounded-2xl border border-white/10 bg-[#151a24] p-4 md:grid-cols-[minmax(260px,1fr)_180px_auto]"><input className="min-h-12 rounded-xl border border-white/10 bg-[#202735] px-4 text-white" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por negocio, slug o dominio" type="search" /><select className="min-h-12 rounded-xl border border-white/10 bg-[#202735] px-4 text-white" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todos los estados</option><option value="active">Activos</option><option value="suspended">Suspendidos</option><option value="TRIAL">Trial</option><option value="PAYMENT_PENDING">Pago pendiente</option></select><span className="self-center text-sm text-slate-400">{visible.length} resultados{selected.size ? ` · ${selected.size} seleccionados` : ""}</span></div><div className="overflow-hidden rounded-2xl border border-white/10 bg-[#151a24]"><div className="hidden grid-cols-[minmax(230px,1.5fr)_150px_120px_120px_150px_230px] gap-4 border-b border-white/10 px-5 py-4 text-xs font-black uppercase tracking-wider text-slate-500 lg:grid"><span className="flex items-center gap-3"><input aria-label="Seleccionar todos los clientes visibles" checked={visible.length > 0 && selected.size === visible.length} className="h-4 w-4 accent-amber-400" onChange={toggleSelectAll} type="checkbox" />Cliente</span><span>Estado / plan</span><span>Sucursales</span><span>Usuarios</span><span>Actividad</span><span>Accesos</span></div>{visible.map((tenant) => { const open = expanded.has(tenant.id); const isSelected = selected.has(tenant.id); return <div className={`border-b border-white/10 last:border-0 ${isSelected ? "bg-amber-300/10" : ""}`} key={tenant.id}><div className="grid gap-3 px-5 py-5 lg:grid-cols-[minmax(230px,1.5fr)_150px_120px_120px_150px_230px] lg:items-center"><div className="flex items-center gap-3"><input aria-label={`Seleccionar ${tenant.name}`} checked={isSelected} className="h-4 w-4 accent-amber-400" onChange={() => toggleSelect(tenant.id)} type="checkbox" /><button className="text-slate-400" onClick={() => toggle(tenant.id)} aria-label={`${open ? "Ocultar" : "Mostrar"} sucursales de ${tenant.name}`} type="button">{open ? "▼" : "▶"}</button><div><Link className="text-lg font-black hover:text-amber-300" href={`/platform/clientes/${tenant.id}`}>{tenant.name}</Link><p className="text-sm text-slate-500">{tenant.slug}{tenant.activePalette ? ` · ${tenant.activePalette.name}` : ""}</p></div></div><div><span className={tenant.status === "active" ? "font-bold text-emerald-300" : "font-bold text-rose-300"}>{tenant.status === "active" ? "Activo" : "Suspendido"}</span><p className="text-sm text-slate-400">{tenant.subscription?.plan?.name ?? "Sin plan"}</p></div><span>{tenant.branches.length}</span><span>{tenant._count.memberships}</span><span className="text-sm text-slate-400">{tenant._count.customerOrders} pedidos · {storage(tenant.storageBytes)}</span><div className="flex flex-wrap gap-2"><a className="rounded-lg border border-emerald-300/30 px-2.5 py-2 text-xs font-black text-emerald-200" href={tenant.publicUrl} target="_blank" rel="noreferrer">Ver sitio ↗</a><a className="rounded-lg border border-amber-300/30 px-2.5 py-2 text-xs font-black text-amber-200" href={tenant.adminUrl} target="_blank" rel="noreferrer">Administrar ↗</a></div></div>{open && <div className="ml-8 grid gap-2 border-l border-amber-300/30 px-5 pb-5 sm:grid-cols-3">{tenant.branches.map((branch) => <Link className="rounded-xl border border-white/10 bg-[#202735] p-3" href={`${tenant.adminUrl}/s/${branch.slug}` as Route} key={branch.id}><strong className="block">{branch.name}</strong><span className="mt-1 block text-xs text-slate-400">{branch.active ? "Activa" : "Inactiva"} · Administrar sucursal</span></Link>)}</div>}</div>; })}{!visible.length && <p className="p-12 text-center text-slate-400">No encontramos clientes con esos filtros.</p>}</div></section>;
}