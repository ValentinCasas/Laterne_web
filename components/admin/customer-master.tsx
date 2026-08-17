"use client";

import { useMemo, useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { scopedFetch } from "@/lib/client-routing";

export type LoyaltyCustomerData = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  birthday: string | null;
  points: number;
  tier: string;
  createdAt: string;
  address: string | null;
  paymentTerms: string | null;
  currentBalance: string | number;
  currency: string;
  _count: { orders: number; transactions: number };
};

type CustomerForm = {
  name: string;
  email: string;
  phone: string;
  address: string;
  paymentTerms: string;
  notes: string;
};

const emptyForm: CustomerForm = { name: "", email: "", phone: "", address: "", paymentTerms: "", notes: "" };

/** @summary Maestro de clientes con alta, edición y ficha extendida. */
export function CustomerMaster({ initialCustomers }: { initialCustomers: LoyaltyCustomerData[] }) {
  const [customers, setCustomers] = useState<LoyaltyCustomerData[]>(initialCustomers);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<LoyaltyCustomerData & {
    orders: Array<{ id: number; reference: string; status: string; orderType: string; total: string | number; currency: string; createdAt: string }>;
    deliveries: Array<{ id: number; number: string; status: string; deliveryDate: string }>;
    payments: Array<{ id: number; number: string; amount: string | number; method: string; paidAt: string; status: string }>;
    transactions: Array<{ id: number; points: number; reason: string; reference: string | null; createdAt: string }>;
  } | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    if (!normalized) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.email, customer.phone, customer.address]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase("es").includes(normalized)),
    );
  }, [customers, query]);

  async function createCustomer() {
    if (!form.name.trim()) {
      await Swal.fire({ title: "Nombre requerido", text: "Ingresá el nombre del cliente.", icon: "warning", background: "#18181b", color: "#fafafa" });
      return;
    }
    setSaving(true);
    try {
      const response = await scopedFetch(`/api/admin/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = (await response.json().catch(() => ({}))) as { customer?: LoyaltyCustomerData; error?: string };
      if (!response.ok || !body.customer) {
        await Swal.fire({ title: "No se pudo crear", text: body.error ?? "Intentá nuevamente.", icon: "error", background: "#18181b", color: "#fafafa" });
        return;
      }
      setCustomers((current) => [body.customer!, ...current]);
      setForm(emptyForm);
      await Swal.fire({ title: "Cliente creado", text: body.customer!.name, icon: "success", background: "#18181b", color: "#fafafa" });
    } finally {
      setSaving(false);
    }
  }

  async function updateCustomer() {
    if (!editingId || !form.name.trim()) return;
    setSaving(true);
    try {
      const response = await scopedFetch(`/api/admin/customers/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = (await response.json().catch(() => ({}))) as { customer?: LoyaltyCustomerData; error?: string };
      if (!response.ok || !body.customer) {
        await Swal.fire({ title: "No se pudo actualizar", text: body.error ?? "Intentá nuevamente.", icon: "error", background: "#18181b", color: "#fafafa" });
        return;
      }
      setCustomers((current) => current.map((item) => (item.id === editingId ? { ...item, ...body.customer! } : item)));
      setEditingId(null);
      setForm(emptyForm);
      await Swal.fire({ title: "Cliente actualizado", icon: "success", background: "#18181b", color: "#fafafa" });
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(customer: LoyaltyCustomerData) {
    const response = await scopedFetch(`/api/admin/customers/${customer.id}`);
    const body = (await response.json().catch(() => ({}))) as { customer?: typeof detail; error?: string };
    if (!response.ok || !body.customer) {
      await Swal.fire({ title: "No se pudo abrir", text: body.error ?? "Intentá nuevamente.", icon: "error", background: "#18181b", color: "#fafafa" });
      return;
    }
    setDetail(body.customer);
  }

  return (
    <section>
      <AdminPageHeader eyebrow="Clientes" title="Base maestra de clientes" description="Altas, modificaciones y ficha completa de tus clientes." section="clientes" />
      <div className="card mt-6 space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input className="input max-w-md flex-1" placeholder="Buscar por nombre, email, teléfono o dirección…" value={query} onChange={(event) => setQuery(event.target.value)} />
          <button type="button" className="btn" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Limpiar</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-dashed border-white/10 p-4">
            <p className="text-xs font-semibold text-zinc-400">Nuevo cliente</p>
            <input className="input mt-2" placeholder="Nombre / Razón social" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            <input className="input mt-2" placeholder="Email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            <input className="input mt-2" placeholder="Teléfono" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
            <input className="input mt-2" placeholder="Dirección" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
            <input className="input mt-2" placeholder="Condiciones de pago" value={form.paymentTerms} onChange={(event) => setForm((current) => ({ ...current, paymentTerms: event.target.value }))} />
            <textarea className="input mt-2" placeholder="Notas" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
            <button type="button" className="btn mt-2 w-full" disabled={saving} onClick={editingId ? updateCustomer : createCustomer}>{saving ? "Guardando…" : editingId ? "Actualizar" : "Crear cliente"}</button>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <h2 className="text-sm font-black uppercase tracking-widest text-[var(--admin-muted)]">Clientes ({visible.length})</h2>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.02]">
          <div className="hidden grid-cols-[minmax(200px,1.4fr)_140px_120px_130px_auto_auto] gap-4 border-b border-white/10 px-5 py-3 text-xs font-black uppercase tracking-wider text-zinc-500 lg:grid">
            <span>Cliente</span>
            <span>Contacto</span>
            <span>Saldo</span>
            <span>Actividad</span>
            <span />
            <span />
          </div>
          <div className="divide-y divide-white/10">
            {visible.map((customer) => (
              <div className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(200px,1.4fr)_140px_120px_130px_auto_auto] lg:items-center" key={customer.id}>
                <div className="min-w-0">
                  <strong className="block truncate">{customer.name}</strong>
                  <p className="truncate text-sm text-zinc-500">{customer.address || customer.email || customer.phone || "Sin datos"}</p>
                </div>
                <span className="text-sm text-zinc-300">{customer.email ?? customer.phone ?? "—"}</span>
                <strong className="text-sm tabular-nums">${Number(customer.currentBalance).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</strong>
                <span className="text-sm text-zinc-500">{customer._count.orders} pedidos</span>
                <div className="flex gap-2">
                  <button className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold hover:bg-white/10" onClick={() => { setEditingId(customer.id); setForm({ name: customer.name, email: customer.email || "", phone: customer.phone || "", address: customer.address || "", paymentTerms: customer.paymentTerms || "", notes: "" }); }} type="button">Editar</button>
                  <button className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold hover:bg-white/10" onClick={() => openDetail(customer)} type="button">Ficha</button>
                </div>
              </div>
            ))}
            {!visible.length && <p className="p-10 text-center text-zinc-500">No hay clientes registrados.</p>}
          </div>
        </div>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setDetail(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black">{detail.name}</h3>
              <button className="btn btn-secondary" onClick={() => setDetail(null)}>Cerrar</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/10 bg-white/[.03] p-4">
                <p className="text-xs text-zinc-500">Saldo pendiente</p>
                <p className="text-2xl font-black text-white">${Number(detail.currentBalance).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[.03] p-4">
                <p className="text-xs text-zinc-500">Puntos</p>
                <p className="text-2xl font-black text-pink-300">{detail.points}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-black uppercase tracking-widest text-zinc-500">Pedidos recientes</h4>
              {detail.orders.length === 0 && <p className="text-sm text-zinc-500">Sin pedidos.</p>}
              {detail.orders.map((order) => (
                <div key={order.id} className="flex items-center justify-between rounded-lg bg-white/[.03] p-3 text-sm">
                  <span>{order.reference}</span>
                  <span className="text-zinc-500">{order.status}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-black uppercase tracking-widest text-zinc-500">Entregas</h4>
              {detail.deliveries.length === 0 && <p className="text-sm text-zinc-500">Sin entregas.</p>}
              {detail.deliveries.map((delivery) => (
                <div key={delivery.id} className="flex items-center justify-between rounded-lg bg-white/[.03] p-3 text-sm">
                  <span>{delivery.number}</span>
                  <span className="text-zinc-500">{delivery.status}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-black uppercase tracking-widest text-zinc-500">Pagos</h4>
              {detail.payments.length === 0 && <p className="text-sm text-zinc-500">Sin pagos.</p>}
              {detail.payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between rounded-lg bg-white/[.03] p-3 text-sm">
                  <span>{payment.number}</span>
                  <span className="text-zinc-500">${Number(payment.amount).toLocaleString("es-AR")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
