"use client";

import { useMemo, useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { scopedFetch } from "@/lib/client-routing";
import type { CustomerPaymentData } from "@/lib/delivery-types";

type AccountManagerProps = {
  initialCustomer: { id: number; name: string; email: string | null; phone: string | null; currentBalance: string | number; currency: string } | null;
  initialPayments: CustomerPaymentData[];
  customersWithBalance?: Array<{ id: number; name: string; email: string | null; phone: string | null; currentBalance: string | number; currency: string }>;
};

export type { CustomerPaymentData };

const methodStyle: Record<string, string> = {
  efectivo: "bg-emerald-500/15 text-emerald-300",
  transferencia: "bg-sky-500/15 text-sky-300",
  tarjeta: "bg-indigo-500/15 text-indigo-300",
  otro: "bg-zinc-500/15 text-zinc-300",
};

/** @summary Gestor de cuenta corriente de clientes con pagos y saldo. */
export function AccountManager({ initialCustomer, initialPayments, customersWithBalance = [] }: AccountManagerProps) {
  const [customer, setCustomer] = useState(initialCustomer);
  const [payments, setPayments] = useState<CustomerPaymentData[]>(initialPayments);
  const [customerQuery, setCustomerQuery] = useState("");
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "efectivo", notes: "", orderId: "", deliveryId: "" });
  const [saving, setSaving] = useState(false);

  const visiblePayments = useMemo(() => {
    if (!customer) return payments;
    return payments.filter((payment) => payment.customerId === customer.id);
  }, [payments, customer]);

  const customersList = useMemo(() => {
    if (customer) return [];
    return customersWithBalance;
  }, [customer, customersWithBalance]);

  async function searchCustomer() {
    if (!customerQuery.trim()) return;
    try {
      const response = await scopedFetch(`/api/admin/search?q=${encodeURIComponent(customerQuery.trim())}`);
      const body = (await response.json().catch(() => ({}))) as { groups?: Array<{ title: string; items: Array<{ id: number; title: string; href: string }> }> };
      const customerGroup = body.groups?.find((group) => group.title === "Clientes frecuentes");
      const found = customerGroup?.items[0];
      if (!found) {
        await Swal.fire({ title: "Cliente no encontrado", text: "Revisá el término de búsqueda.", icon: "warning", background: "#18181b", color: "#fafafa" });
        return;
      }
      const customerResponse = await scopedFetch(found.href);
      const customerBody = (await customerResponse.json().catch(() => ({}))) as { customer?: { id: number; name: string; email: string | null; phone: string | null; currentBalance: string | number; currency: string } };
      if (!customerBody.customer) {
        await Swal.fire({ title: "No se pudo cargar el cliente", icon: "error", background: "#18181b", color: "#fafafa" });
        return;
      }
      setCustomer(customerBody.customer);
      const paymentsResponse = await scopedFetch(`/api/admin/customers/${customerBody.customer.id}/payments`);
      const paymentsBody = (await paymentsResponse.json().catch(() => ({}))) as { payments?: CustomerPaymentData[] };
      setPayments(paymentsBody.payments ?? []);
    } catch {
      await Swal.fire({ title: "Error de búsqueda", text: "Intentá nuevamente.", icon: "error", background: "#18181b", color: "#fafafa" });
    }
  }

  async function registerPayment() {
    if (!customer || !paymentForm.amount || Number(paymentForm.amount) <= 0) {
      await Swal.fire({ title: "Importe inválido", text: "Ingresá un monto mayor a 0.", icon: "warning", background: "#18181b", color: "#fafafa" });
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        amount: Number(paymentForm.amount),
        method: paymentForm.method,
        notes: paymentForm.notes || undefined,
      };
      if (paymentForm.orderId) body.orderId = Number(paymentForm.orderId);
      if (paymentForm.deliveryId) body.deliveryId = Number(paymentForm.deliveryId);

      const response = await scopedFetch(`/api/admin/customers/${customer.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => ({}))) as { payment?: CustomerPaymentData; error?: string };
      if (!response.ok || !result.payment) {
        await Swal.fire({ title: "No se pudo registrar el pago", text: result.error ?? "Intentá nuevamente.", icon: "error", background: "#18181b", color: "#fafafa" });
        return;
      }
      setPayments((current) => [result.payment!, ...current]);
      setCustomer((current) => (current ? { ...current, currentBalance: Math.max(0, Number(current.currentBalance) - Number(result.payment!.amount)) } : current));
      setPaymentForm((current) => ({ ...current, amount: "", notes: "", orderId: "", deliveryId: "" }));
      await Swal.fire({ title: "Pago registrado", text: result.payment.number, icon: "success", background: "#18181b", color: "#fafafa" });
    } finally {
      setSaving(false);
    }
  }

  const balance = customer ? Number(customer.currentBalance) : 0;

  return (
    <section>
      <AdminPageHeader eyebrow="Cuenta corriente" title="Cobros y saldo de clientes" description="Registrá pagos y consultá el saldo pendiente de tus clientes." section="cobros" />
      <div className="card mt-6 space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input className="input" placeholder="Buscar cliente por nombre, email o teléfono…" value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} />
          <button type="button" className="btn" onClick={searchCustomer}>Buscar</button>
        </div>
        {customer && (
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
              <p className="text-sm font-black text-white">{customer.name}</p>
              <p className="text-xs text-zinc-500">{customer.email ?? customer.phone ?? "Sin contacto"}</p>
              <p className="mt-2 text-lg font-black text-white">Saldo pendiente: ${balance.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
              <p className="text-xs font-semibold text-zinc-400">Registrar pago</p>
              <input className="input mt-2" type="number" placeholder="Importe" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} />
              <select className="input mt-2 w-auto" value={paymentForm.method} onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value }))}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="otro">Otro</option>
              </select>
              <input className="input mt-2" placeholder="Pedido (opcional)" value={paymentForm.orderId} onChange={(event) => setPaymentForm((current) => ({ ...current, orderId: event.target.value }))} />
              <input className="input mt-2" placeholder="Entrega (opcional)" value={paymentForm.deliveryId} onChange={(event) => setPaymentForm((current) => ({ ...current, deliveryId: event.target.value }))} />
              <textarea className="input mt-2" placeholder="Notas" value={paymentForm.notes} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} />
              <button type="button" className="btn mt-2 w-full" disabled={saving} onClick={registerPayment}>{saving ? "Guardando…" : "Registrar pago"}</button>
            </div>
          </div>
        )}
      </div>

      {!customer && customersList.length > 0 && (
        <div className="mt-6 space-y-2">
          <h2 className="text-sm font-black uppercase tracking-widest text-[var(--admin-muted)]">Clientes con saldo pendiente ({customersList.length})</h2>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.02]">
            <div className="divide-y divide-white/10">
              {customersList.map((c) => (
                <button key={c.id} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-white/[.03]" onClick={() => setCustomer(c)}>
                  <div>
                    <p className="text-sm font-bold text-white">{c.name}</p>
                    <p className="text-xs text-zinc-500">{c.email ?? c.phone ?? "Sin contacto"}</p>
                  </div>
                  <span className="text-sm font-black text-amber-300">${Number(c.currentBalance).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-2">
        <h2 className="text-sm font-black uppercase tracking-widest text-[var(--admin-muted)]">Movimientos ({visiblePayments.length})</h2>
        {visiblePayments.length === 0 && <p className="text-center text-[var(--admin-muted)]">Sin movimientos.</p>}
        {visiblePayments.map((payment) => (
          <div key={payment.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-bold text-white">{payment.number}</p>
              <p className="text-xs text-zinc-500">
                {new Date(payment.paidAt).toLocaleString("es-AR")} · {payment.method} · {payment.order?.reference ?? payment.delivery?.number ?? "—"}
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${methodStyle[payment.method] ?? "bg-zinc-500/15 text-zinc-300"}`}>
              ${Number(payment.amount).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
