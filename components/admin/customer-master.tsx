"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import Swal from "sweetalert2";
import {
  PageHeader,
  DataTable,
  EmptyState,
  FormSection,
  Tabs,
  FactBox,
  Drawer,
  ActionMenu,
  StatusBadge,
} from "@/components/admin/ui";
import { scopedFetch } from "@/lib/client-routing";
import { Icon } from "@/components/admin/ui/icons";

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

const emptyForm: CustomerForm = {
  name: "",
  email: "",
  phone: "",
  address: "",
  paymentTerms: "",
  notes: "",
};

type CustomerDetail = {
  customer: {
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
    currentBalance: number | string;
    currency: string;
  };
  orders: Array<{
    id: number;
    reference: string;
    status: string;
    orderType: string;
    total: number | string;
    currency: string;
    createdAt: string;
    branch: { name: string } | null;
  }>;
  deliveries: Array<{
    id: number;
    number: string;
    status: string;
    deliveryDate: string;
    orderId: number;
    createdAt: string;
  }>;
  payments: Array<{
    id: number;
    number: string;
    amount: number | string;
    method: string;
    paidAt: string;
    status: string;
    orderId: number;
    deliveryId: number;
  }>;
  transactions: Array<{
    id: number;
    points: number;
    reason: string;
    reference: string | null;
    createdAt: string;
  }>;
};

const CUSTOMER_COLUMNS = [
  { key: "name", label: "Cliente" },
  { key: "contact", label: "Contacto", hideOnMobile: true },
  { key: "balance", label: "Saldo", align: "right" as const },
  { key: "orders", label: "Pedidos", align: "right" as const },
  { key: "activity", label: "Actividad", align: "right" as const, hideOnMobile: true },
  { key: "status", label: "Estado", align: "right" as const, hideOnMobile: true },
];

const TIER_TONE: Record<string, "default" | "success" | "warning" | "info"> = {
  diamante: "success",
  oro: "info",
  plata: "warning",
  inicial: "default",
};

function formatMoney(value: number | string | undefined) {
  const num = typeof value === "number" ? value : Number(value ?? 0);
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(num);
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tierLabel(tier: string) {
  const map: Record<string, string> = {
    diamante: "Diamante",
    oro: "Oro",
    plata: "Plata",
    inicial: "Inicial",
  };
  return map[tier] ?? tier;
}

function NewCustomerDrawer({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(emptyForm);
      setSaving(false);
    }
  }, [open]);

  async function submit() {
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
      await Swal.fire({ title: "Cliente creado", text: body.customer!.name, icon: "success", background: "#18181b", color: "#fafafa" });
      onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Nuevo cliente" width="520px">
      <FormSection title="Datos del cliente" description="Completá la información para crear el cliente.">
        <input
          className="input"
          placeholder="Nombre / Razón social *"
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
        />
        <input
          className="input"
          placeholder="Email"
          value={form.email}
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
        />
        <input
          className="input"
          placeholder="Teléfono"
          value={form.phone}
          onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
        />
        <input
          className="input"
          placeholder="Dirección"
          value={form.address}
          onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
        />
        <input
          className="input sm:col-span-2"
          placeholder="Condiciones de pago"
          value={form.paymentTerms}
          onChange={(event) => setForm((current) => ({ ...current, paymentTerms: event.target.value }))}
        />
        <textarea
          className="input sm:col-span-2"
          placeholder="Notas"
          rows={3}
          value={form.notes}
          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
        />
        <div className="sm:col-span-2">
          <button type="button" className="btn" disabled={saving} onClick={submit}>
            {saving ? "Guardando…" : "Crear cliente"}
          </button>
        </div>
      </FormSection>
    </Drawer>
  );
}

function CustomerDetailDrawer({
  customerId,
  open,
  onClose,
  onUpdated,
}: {
  customerId: number | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("general");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<CustomerForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !customerId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    setDetail(null);
    setActiveTab("general");
    setEditing(false);

    scopedFetch(`/api/admin/customers/${customerId}`)
      .then((res) => {
        if (!res.ok) throw new Error("No se pudo cargar la ficha");
        return res.json();
      })
      .then((body) => {
        if (!cancelled && body.customer) {
          setDetail(body);
          setEditForm({
            name: body.customer.name ?? "",
            email: body.customer.email ?? "",
            phone: body.customer.phone ?? "",
            address: body.customer.address ?? "",
            paymentTerms: body.customer.paymentTerms ?? "",
            notes: "",
          });
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, customerId]);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDetail(null);
      setError(null);
      setLoading(false);
      setEditing(false);
    }
  }, [open]);

  async function saveEdit() {
    if (!customerId || !editForm.name.trim()) return;
    setSaving(true);
    try {
      const response = await scopedFetch(`/api/admin/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const body = (await response.json().catch(() => ({}))) as { customer?: CustomerDetail["customer"]; error?: string };
      if (!response.ok || !body.customer) {
        await Swal.fire({ title: "No se pudo actualizar", text: body.error ?? "Intentá nuevamente.", icon: "error", background: "#18181b", color: "#fafafa" });
        return;
      }
      await Swal.fire({ title: "Cliente actualizado", icon: "success", background: "#18181b", color: "#fafafa" });
      setEditing(false);
      onUpdated();
      if (detail) {
        setDetail((current) => (current ? { ...current, customer: { ...current.customer, ...body.customer! } } : current));
      }
    } finally {
      setSaving(false);
    }
  }

  const timeline = useMemo(() => {
    if (!detail) return [];
    const events: Array<{ date: string; type: string; title: string; description: string }> = [];
    detail.orders.forEach((order) => {
      events.push({
        date: order.createdAt,
        type: "order",
        title: `Pedido ${order.reference}`,
        description: `${order.status} · ${formatMoney(order.total)}`,
      });
    });
    detail.payments.forEach((payment) => {
      events.push({
        date: payment.paidAt,
        type: "payment",
        title: `Pago ${payment.number}`,
        description: `${formatMoney(payment.amount)} · ${payment.method}`,
      });
    });
    detail.transactions.forEach((tx) => {
      events.push({
        date: tx.createdAt,
        type: "transaction",
        title: tx.reason,
        description: `${tx.points >= 0 ? "+" : ""}${tx.points} puntos`,
      });
    });
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [detail]);

  if (!open) return null;

  const customer = detail?.customer;

  return (
    <Drawer open={open} onClose={onClose} title={editing ? "Editar cliente" : (customer?.name ?? "Ficha del cliente")} width="1000px">
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Icon name="loader" className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      )}

      {error && !loading && (
        <div className="py-12 text-center">
          <p className="text-sm text-red-300">{error}</p>
          <button type="button" className="btn btn-secondary mt-4" onClick={() => customerId && setDetail(null)}>
            Reintentar
          </button>
        </div>
      )}

      {detail && !loading && !error && (
        <div>
          {!editing && (
            <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-xs text-[var(--admin-muted)]">
              <Link href="/admin/clientes" className="transition hover:text-zinc-300">Clientes</Link>
              <span className="text-[var(--admin-border)]">/</span>
              <span className="text-zinc-300">{customer?.name}</span>
            </nav>
          )}

          {editing ? (
            <FormSection title="Editar cliente" description="Modificá los datos del cliente.">
              <input
                className="input"
                placeholder="Nombre / Razón social *"
                value={editForm.name}
                onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
              />
              <input
                className="input"
                placeholder="Email"
                value={editForm.email}
                onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))}
              />
              <input
                className="input"
                placeholder="Teléfono"
                value={editForm.phone}
                onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))}
              />
              <input
                className="input"
                placeholder="Dirección"
                value={editForm.address}
                onChange={(event) => setEditForm((current) => ({ ...current, address: event.target.value }))}
              />
              <input
                className="input sm:col-span-2"
                placeholder="Condiciones de pago"
                value={editForm.paymentTerms}
                onChange={(event) => setEditForm((current) => ({ ...current, paymentTerms: event.target.value }))}
              />
              <textarea
                className="input sm:col-span-2"
                placeholder="Notas"
                rows={3}
                value={editForm.notes}
                onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))}
              />
              <div className="sm:col-span-2 flex gap-2">
                <button type="button" className="btn" disabled={saving} onClick={saveEdit}>
                  {saving ? "Guardando…" : "Guardar cambios"}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)} disabled={saving}>
                  Cancelar
                </button>
              </div>
            </FormSection>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
                  <Icon name="pencil" className="mr-1.5 h-4 w-4" /> Editar
                </button>
                <Link href="/admin/pedidos" className="btn btn-secondary">
                  <Icon name="cart" className="mr-1.5 h-4 w-4" /> Nueva orden
                </Link>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveTab("historico")}>
                  <Icon name="clock" className="mr-1.5 h-4 w-4" /> Ver historial
                </button>
              </div>

              <Tabs
                tabs={[
                  { key: "general", label: "General" },
                  { key: "contacto", label: "Contacto" },
                  { key: "comercial", label: "Cond. Comerciales" },
                  { key: "saldo", label: "Saldo" },
                  { key: "pedidos", label: "Pedidos" },
                  { key: "pagos", label: "Pagos" },
                  { key: "movimientos", label: "Cta. Corriente" },
                  { key: "historico", label: "Histórico" },
                  { key: "reservas", label: "Reservas" },
                  { key: "facturas", label: "Facturas" },
                ]}
                defaultTab="general"
                onChange={setActiveTab}
              />

              <div className="mt-4">
                {activeTab === "general" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-zinc-500">Nombre</p>
                      <p className="text-sm font-semibold">{customer?.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Email</p>
                      <p className="text-sm font-semibold">{customer?.email ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Teléfono</p>
                      <p className="text-sm font-semibold">{customer?.phone ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Dirección</p>
                      <p className="text-sm font-semibold">{customer?.address ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Fecha de nacimiento</p>
                      <p className="text-sm font-semibold">{formatDate(customer?.birthday)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Miembro desde</p>
                      <p className="text-sm font-semibold">{formatDate(customer?.createdAt)}</p>
                    </div>
                  </div>
                )}

                {activeTab === "contacto" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-white/[.03] p-4">
                      <p className="text-xs text-zinc-500">Email</p>
                      <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
                        <Icon name="mail" className="h-4 w-4 text-zinc-500" /> {customer?.email ?? "—"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[.03] p-4">
                      <p className="text-xs text-zinc-500">Teléfono</p>
                      <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
                        <Icon name="phone" className="h-4 w-4 text-zinc-500" /> {customer?.phone ?? "—"}
                      </p>
                    </div>
                    <div className="sm:col-span-2 rounded-xl border border-white/10 bg-white/[.03] p-4">
                      <p className="text-xs text-zinc-500">Dirección</p>
                      <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
                        <Icon name="map-pin" className="h-4 w-4 text-zinc-500" /> {customer?.address ?? "—"}
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === "comercial" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-zinc-500">Términos de pago</p>
                      <p className="text-sm font-semibold">{customer?.paymentTerms ?? "—"}</p>
                    </div>
                  </div>
                )}

                {activeTab === "saldo" && (
                  <div className="grid gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-white/[.03] p-5">
                        <p className="text-xs text-zinc-500">Saldo actual</p>
                        <p className="mt-2 text-3xl font-black">{formatMoney(customer?.currentBalance)}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[.03] p-5">
                        <p className="text-xs text-zinc-500">Moneda</p>
                        <p className="mt-2 text-3xl font-black">{customer?.currency}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[.03] p-5">
                        <p className="text-xs text-zinc-500">Puntos</p>
                        <p className="mt-2 text-3xl font-black text-pink-300">{customer?.points ?? 0}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[.03] p-5">
                        <p className="text-xs text-zinc-500">Nivel</p>
                        <p className="mt-2 text-3xl font-black capitalize">{customer?.tier ?? "—"}</p>
                      </div>
                    </div>
                    <div>
                      <FactBox title="Resumen de cuenta">
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-400">Saldo</span>
                          <span className="font-bold">{formatMoney(customer?.currentBalance)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-400">Moneda</span>
                          <span className="font-bold">{customer?.currency}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-400">Puntos</span>
                          <span className="font-bold">{customer?.points ?? 0}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-400">Nivel</span>
                          <span className="font-bold capitalize">{customer?.tier ?? "—"}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-400">Pedidos</span>
                          <span className="font-bold">{detail.orders.length}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-400">Pagos</span>
                          <span className="font-bold">{detail.payments.length}</span>
                        </div>
                      </FactBox>
                    </div>
                  </div>
                )}

                {activeTab === "pedidos" && (
                  <div>
                    {detail.orders.length === 0 ? (
                      <EmptyState title="Sin pedidos" description="Este cliente aún no tiene pedidos registrados." />
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
                              <th className="px-5 py-3 font-bold">Referencia</th>
                              <th className="px-5 py-3 font-bold">Fecha</th>
                              <th className="px-5 py-3 font-bold">Estado</th>
                              <th className="px-5 py-3 font-bold">Tipo</th>
                              <th className="px-5 py-3 font-bold text-right">Total</th>
                              <th className="px-5 py-3 font-bold hidden md:table-cell">Sucursal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--admin-border)]">
                            {detail.orders.map((order) => (
                              <tr key={order.id} className="transition-colors hover:bg-white/[0.02]">
                                <td className="px-5 py-3 font-semibold">{order.reference}</td>
                                <td className="px-5 py-3 text-zinc-400">{formatDate(order.createdAt)}</td>
                                <td className="px-5 py-3"><StatusBadge status={order.status} /></td>
                                <td className="px-5 py-3 text-zinc-400 capitalize">{order.orderType}</td>
                                <td className="px-5 py-3 text-right font-semibold">{formatMoney(order.total)}</td>
                                 <td className="px-5 py-3 text-zinc-400 hidden md:table-cell">{order.branch?.name ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "pagos" && (
                  <div>
                    {detail.payments.length === 0 ? (
                      <EmptyState title="Sin pagos" description="Este cliente aún no tiene pagos registrados." />
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
                              <th className="px-5 py-3 font-bold">Número</th>
                              <th className="px-5 py-3 font-bold">Fecha</th>
                              <th className="px-5 py-3 font-bold">Método</th>
                              <th className="px-5 py-3 font-bold text-right">Monto</th>
                              <th className="px-5 py-3 font-bold">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--admin-border)]">
                            {detail.payments.map((payment) => (
                              <tr key={payment.id} className="transition-colors hover:bg-white/[0.02]">
                                <td className="px-5 py-3 font-semibold">{payment.number}</td>
                                <td className="px-5 py-3 text-zinc-400">{formatDate(payment.paidAt)}</td>
                                <td className="px-5 py-3 text-zinc-400 capitalize">{payment.method}</td>
                                <td className="px-5 py-3 text-right font-semibold">{formatMoney(payment.amount)}</td>
                                <td className="px-5 py-3"><StatusBadge status={payment.status} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "movimientos" && (
                  <div>
                    {detail.transactions.length === 0 ? (
                      <EmptyState title="Sin movimientos" description="Este cliente aún no tiene movimientos de puntos." />
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
                              <th className="px-5 py-3 font-bold">Fecha</th>
                              <th className="px-5 py-3 font-bold">Concepto</th>
                              <th className="px-5 py-3 font-bold">Referencia</th>
                              <th className="px-5 py-3 font-bold text-right">Puntos</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--admin-border)]">
                            {detail.transactions.map((tx) => (
                              <tr key={tx.id} className="transition-colors hover:bg-white/[0.02]">
                                <td className="px-5 py-3 text-zinc-400">{formatDate(tx.createdAt)}</td>
                                <td className="px-5 py-3 font-semibold">{tx.reason}</td>
                                <td className="px-5 py-3 text-zinc-400">{tx.reference ?? "—"}</td>
                                <td className={`px-5 py-3 text-right font-bold ${tx.points >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                                  {tx.points >= 0 ? "+" : ""}{tx.points}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "historico" && (
                  <div>
                    {timeline.length === 0 ? (
                      <EmptyState title="Sin historial" description="Este cliente aún no tiene actividad registrada." />
                    ) : (
                      <div className="space-y-4">
                        {timeline.map((event, index) => (
                          <div key={index} className="flex gap-4 rounded-xl border border-white/10 bg-white/[.03] p-4">
                            <div className="mt-1">
                              {event.type === "order" && <Icon name="cart" className="h-5 w-5 text-pink-300" />}
                              {event.type === "payment" && <Icon name="wallet" className="h-5 w-5 text-emerald-300" />}
                              {event.type === "transaction" && <Icon name="repeat" className="h-5 w-5 text-sky-300" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold">{event.title}</p>
                              <p className="text-xs text-zinc-500">{event.description}</p>
                            </div>
                            <div className="shrink-0 text-xs text-zinc-500">{formatDateTime(event.date)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "reservas" && (
                  <EmptyState title="Sin reservas" description="Las reservas no están vinculadas directamente a la ficha del cliente." />
                )}

                {activeTab === "facturas" && (
                  <EmptyState title="Sin facturas" description="Las facturas se generan por pedido. Revisá la pestaña Pedidos para ver los comprobantes asociados." />
                )}
              </div>
            </>
          )}
        </div>
      )}
    </Drawer>
  );
}

/** @summary Maestro de clientes con tabla filtrable, creación en drawer y ficha extendida tipo Business Central. */
export function CustomerMaster({ initialCustomers }: { initialCustomers: LoyaltyCustomerData[] }) {
  const [customers, setCustomers] = useState<LoyaltyCustomerData[]>(initialCustomers);
  const [query, setQuery] = useState("");
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [detailCustomerId, setDetailCustomerId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    if (!normalized) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.email, customer.phone, customer.address]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase("es").includes(normalized)),
    );
  }, [customers, query]);

  function refreshList(updatedCustomer?: LoyaltyCustomerData) {
    if (updatedCustomer) {
      setCustomers((current) =>
        current.map((c) => (c.id === updatedCustomer.id ? { ...c, ...updatedCustomer } : c)),
      );
    } else {
      setCustomers((current) => [...current].sort((a, b) => a.name.localeCompare(b.name, "es")));
    }
  }

  function openDetail(customer: LoyaltyCustomerData) {
    setDetailCustomerId(customer.id);
    setDetailOpen(true);
  }

  function closeDetail() {
    setDetailOpen(false);
    setDetailCustomerId(null);
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Clientes"
        title="Base maestra de clientes"
        description="Altas, modificaciones y ficha completa de tus clientes."
        section="clientes"
        actions={
          <button type="button" className="btn" onClick={() => setNewCustomerOpen(true)}>
            <Icon name="plus" className="mr-1.5 h-4 w-4" /> Nuevo cliente
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <input
            type="search"
            placeholder="Buscar por nombre, email, teléfono o dirección…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 pl-9 text-sm text-zinc-300 outline-none transition-colors placeholder:text-zinc-500 focus:border-pink-500/50 focus:bg-white/10"
          />
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
            <Icon name="search" className="h-4 w-4" />
          </span>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="No hay clientes registrados" description="Creá tu primer cliente para comenzar a operar." />
      ) : (
        <DataTable
          viewStorageKey="clientes"
          density="comfortable"
          columns={CUSTOMER_COLUMNS}
          data={visible.map((customer) => ({
            id: customer.id,
            name: (
              <div className="min-w-0">
                <strong className="block truncate">{customer.name}</strong>
                <p className="truncate text-xs text-zinc-500">{customer.address || customer.email || customer.phone || "Sin datos"}</p>
              </div>
            ),
            contact: customer.email ?? customer.phone ?? "—",
            balance: (
              <strong className="tabular-nums">
                ${Number(customer.currentBalance).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </strong>
            ),
            orders: customer._count.orders,
            activity: formatDate(customer.createdAt),
            status: <StatusBadge status={tierLabel(customer.tier)} tone={TIER_TONE[customer.tier] ?? "default"} />,
          }))}
          keyExtractor={(row) => row.id as number}
          emptyMessage="No hay clientes registrados."
          onRowClick={(row) => {
            const c = visible.find((item) => item.id === row.id as number);
            if (c) openDetail(c);
          }}
          rowActions={(row) => {
            const customer = visible.find((c) => c.id === row.id as number);
            if (!customer) return null;
            return (
              <ActionMenu
                align="right"
                items={[
                  {
                    label: "Editar",
                    onClick: () => openDetail(customer),
                  },
                ]}
              />
            );
          }}
        />
      )}

      <NewCustomerDrawer open={newCustomerOpen} onClose={() => setNewCustomerOpen(false)} onCreated={refreshList} />

      <CustomerDetailDrawer customerId={detailCustomerId} open={detailOpen} onClose={closeDetail} onUpdated={refreshList} />
    </section>
  );
}
