"use client";

import { useCallback, useMemo, useState } from "react";

/** @summary Marca de tiempo para calcular vencimientos sin llamadas impuras en el render. */
const now = Date.now();
import Swal from "sweetalert2";
import { PageHeader, SearchBox, Tabs } from "@/components/admin/ui";
import { scopedFetch } from "@/lib/client-routing";
import { expenseStatusLabels } from "@/lib/expenses";
import { Icon } from "@/components/admin/ui/icons";

/**
 * Gestor de Gastos de MenuClick.
 *
 * Los gastos (alquiler, servicios, software…) NO tocan inventario. Se registran
 * como documentos con estado de pago y quedan disponibles para Finanzas. Las
 * previsiones recurrentes solo generan sugerencias: el usuario las confirma
 * antes de convertirlas en un gasto real.
 */

type Supplier = { id: number; name: string; status?: string };
type BranchOption = { id: number; name: string; slug: string; active: boolean };
type Category = { id: number; name: string; group: string; active?: boolean };
type ExpenseRow = {
  id: number;
  number: string;
  status: string;
  expenseDate: string;
  dueDate?: string | null;
  amountNet: string | number;
  taxAmount: string | number;
  total: string | number;
  paidAmount: string | number;
  paymentMethod?: string | null;
  financialCategory?: string | null;
  category?: { id: number; name: string; group: string } | null;
  supplier?: { id: number; name: string } | null;
  branch?: { id: number; name: string } | null;
  notes?: string | null;
  recurring?: { id: number; name: string } | null;
};
type ExpenseDetail = ExpenseRow & {
  notes?: string | null;
  createdBy?: { id: number; name: string } | null;
  recurring?: { id: number; name: string } | null;
  payments: Array<{ id: number; number: string; amount: string | number; method: string; paidAt: string; notes?: string | null; createdBy?: { id: number; name: string } | null }>;
};
type RecurringRow = {
  id: number;
  name: string;
  amount: string | number;
  periodicity: string;
  dayOfMonth?: number | null;
  dayOfWeek?: number | null;
  nextDueDate?: string | null;
  active?: boolean;
  notes?: string | null;
  category?: { id: number; name: string; group: string } | null;
};
type Summary = {
  pendingMonth: number;
  paidMonth: number;
  overdue: number;
  upcoming: Array<{ id: number; number: string; amount: number; dueDate: string }>;
};

type ExpensesPayload = {
  tenantId: number;
  currency: string;
  activeBranchId: number | null;
  branches: BranchOption[];
  suppliers: Supplier[];
  categories: Category[];
  expenses: ExpenseRow[];
  recurring: RecurringRow[];
  summary: Summary;
};

const TAB_LABELS: Array<{ key: "gastos" | "previsiones" | "categorias"; label: string }> = [
  { key: "gastos", label: "Gastos" },
  { key: "previsiones", label: "Previsiones" },
  { key: "categorias", label: "Categorías" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-500/15 text-zinc-300",
  pending: "bg-amber-500/15 text-amber-300",
  partially_paid: "bg-sky-500/15 text-sky-300",
  paid: "bg-emerald-500/15 text-emerald-300",
  cancelled: "bg-rose-500/15 text-rose-300",
};

const PERIODICITY_LABELS: Record<string, string> = {
  monthly: "Mensual",
  weekly: "Semanal",
  yearly: "Anual",
};

/** @summary Formatea un importe con la moneda del negocio. */
function money(value: string | number | null | undefined, currency: string) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(number);
}

/** @summary Formatea una fecha ISO para mostrar. */
function dateLabel(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

/** @summary Ejecuta una petición de API y devuelve el cuerpo parseado o lanza el error del servidor. */
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await scopedFetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body?.error ?? "No se pudo completar la operación");
  return body;
}

/** @summary Muestra un error de operación en el panel sin romper la pantalla. */
async function showError(title: string, reason: unknown) {
  await Swal.fire({
    title,
    text: reason instanceof Error ? reason.message : "Intentá nuevamente.",
    icon: "error",
    background: "#18181b",
    color: "#fafafa",
  });
}

/** @summary Marco base de los modales del módulo. */
function ModalFrame({
  title,
  subtitle,
  onClose,
  children,
  wide,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 p-0 backdrop-blur-sm sm:p-4">
      <div
        className={`flex h-full w-full flex-col overflow-hidden rounded-none border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl sm:rounded-[1.5rem] ${
          wide ? "max-w-4xl" : "max-w-2xl"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-4">
          <div>
            <h2 className="text-xl font-black">{title}</h2>
            {subtitle && <p className="text-sm text-[var(--admin-muted)]">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="btn btn-secondary" type="button">
            ✕ Cerrar
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

/** @summary Gestor de gastos con KPIs, pestañas operativas y previsiones recurrentes. */
export function ExpensesManager({ initial }: { initial: ExpensesPayload }) {
  const [payload, setPayload] = useState<ExpensesPayload>(initial);
  const [tab, setTab] = useState<"gastos" | "previsiones" | "categorias">("gastos");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [openExpense, setOpenExpense] = useState<ExpenseDetail | null>(null);
  const [creatingExpense, setCreatingExpense] = useState(false);
  const [creatingRecurring, setCreatingRecurring] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [busy, setBusy] = useState(false);

  const currency = payload.currency ?? "ARS";

  /** @summary Recarga los listados y KPIs del módulo. */
  const refresh = useCallback(async () => {
    try {
      const [list, categories, recurring] = await Promise.all([
        api<{ items: ExpenseRow[]; summary: Summary }>("/api/admin/gastos?limit=80"),
        api<Category[]>("/api/admin/gastos/categorias?all=1"),
        api<RecurringRow[]>("/api/admin/gastos/recurrentes"),
      ]);
      setPayload((current) => ({
        ...current,
        expenses: list.items,
        categories,
        recurring,
        summary: list.summary ?? current.summary,
      }));
    } catch (reason) {
      await showError("No se pudieron actualizar los listados", reason);
    }
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return payload.expenses.filter((expense) => {
      if (status && expense.status !== status) return false;
      if (categoryId && expense.category?.id !== Number(categoryId)) return false;
      if (supplierId && expense.supplier?.id !== Number(supplierId)) return false;
      if (branchId && expense.branch?.id !== Number(branchId)) return false;
      if (
        normalized &&
        !expense.number.toLocaleLowerCase("es").includes(normalized) &&
        !(expense.supplier?.name ?? "").toLocaleLowerCase("es").includes(normalized) &&
        !(expense.notes ?? "").toLocaleLowerCase("es").includes(normalized)
      ) {
        return false;
      }
      return true;
    });
  }, [payload.expenses, query, status, categoryId, supplierId, branchId]);

  /** @summary Abre el detalle de un gasto con sus pagos. */
  async function openDetail(expenseId: number) {
    setBusy(true);
    try {
      const detail = await api<ExpenseDetail>(`/api/admin/gastos/${expenseId}`);
      setOpenExpense(detail);
    } catch (reason) {
      await showError("No se pudo abrir el gasto", reason);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Costos" title="Gastos" description="Gastos sin inventario, con estado de pago y disponibles para Finanzas." section="gastos" actions={
        <div className="flex flex-wrap gap-2">
          {tab === "gastos" && <button type="button" className="btn" onClick={() => setCreatingExpense(true)} disabled={busy}>+ Nuevo gasto</button>}
          {tab === "previsiones" && <button type="button" className="btn" onClick={() => setCreatingRecurring(true)} disabled={busy}>+ Nueva previsión</button>}
          {tab === "categorias" && <button type="button" className="btn" onClick={() => setCreatingCategory(true)} disabled={busy}>+ Nueva categoría</button>}
        </div>
      } />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Pendiente este mes" value={money(payload.summary?.pendingMonth, currency)} tone="amber" />
        <KpiCard label="Pagado este mes" value={money(payload.summary?.paidMonth, currency)} tone="emerald" />
        <KpiCard label="Vencido" value={money(payload.summary?.overdue, currency)} tone="rose" />
        <KpiCard
          label="Próximos vencimientos"
          value={
            payload.summary?.upcoming?.length
              ? `${payload.summary.upcoming.length} · ${money(payload.summary.upcoming.reduce((sum, item) => sum + item.amount, 0), currency)}`
              : "—"
          }
          tone="sky"
        />
      </div>

      <Tabs tabs={TAB_LABELS.map((item) => ({ key: item.key, label: item.label }))} defaultTab={tab} onChange={(key) => setTab(key as "gastos" | "previsiones" | "categorias")} />

      {/* Toolbar de filtros */}
      {tab === "gastos" && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2.5">
          <SearchBox value={query} onChange={setQuery} placeholder="Buscar por número, proveedor o nota…" className="min-w-[220px] flex-1" />
          <select className="input w-auto" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar por estado">
            <option value="">Todos los estados</option>
            {Object.entries(expenseStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select className="input w-auto" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} aria-label="Filtrar por categoría">
            <option value="">Todas las categorías</option>
            {payload.categories
              .filter((category) => category.active !== false)
              .map((category) => (
                <option key={category.id} value={String(category.id)}>{category.group} › {category.name}</option>
              ))}
          </select>
          <select className="input w-auto" value={supplierId} onChange={(event) => setSupplierId(event.target.value)} aria-label="Filtrar por proveedor">
            <option value="">Todos los proveedores</option>
            {payload.suppliers.map((supplier) => (
              <option key={supplier.id} value={String(supplier.id)}>{supplier.name}</option>
            ))}
          </select>
          <select className="input w-auto" value={branchId} onChange={(event) => setBranchId(event.target.value)} aria-label="Filtrar por sucursal">
            <option value="">Todas las sucursales</option>
            {payload.branches.map((branch) => (
              <option key={branch.id} value={String(branch.id)}>{branch.name}</option>
            ))}
          </select>
          <a
            href={`/api/admin/gastos/export?${new URLSearchParams({ status, categoryId, supplierId, branchId, q: query }).toString()}`}
            className="btn btn-secondary"
          >
            <Icon name="download" className="h-3.5 w-3.5" /> CSV
          </a>
          <span className="ml-auto text-sm text-[var(--admin-muted)]">{filtered.length} resultados</span>
        </div>
      )}

      {tab === "gastos" && (
        <ExpensesTable
          expenses={filtered}
          currency={currency}
          onOpen={openDetail}
          onRefresh={refresh}
          setBusy={setBusy}
        />
      )}
      {tab === "previsiones" && (
        <RecurringTable
          items={payload.recurring}
          currency={currency}
          onRefresh={refresh}
          setBusy={setBusy}
        />
      )}
      {tab === "categorias" && (
        <CategoriesTable categories={payload.categories} onRefresh={refresh} setBusy={setBusy} />
      )}

      {creatingExpense && (
        <NewExpenseModal
          branches={payload.branches}
          suppliers={payload.suppliers}
          categories={payload.categories.filter((category) => category.active !== false)}
          currency={currency}
          activeBranchId={payload.activeBranchId}
          onClose={() => setCreatingExpense(false)}
          onSaved={async () => {
            setCreatingExpense(false);
            await refresh();
          }}
        />
      )}
      {creatingRecurring && (
        <NewRecurringModal
          categories={payload.categories.filter((category) => category.active !== false)}
          currency={currency}
          onClose={() => setCreatingRecurring(false)}
          onSaved={async () => {
            setCreatingRecurring(false);
            await refresh();
          }}
        />
      )}
      {creatingCategory && (
        <CategoryModal
          onClose={() => setCreatingCategory(false)}
          onSaved={async () => {
            setCreatingCategory(false);
            await refresh();
          }}
        />
      )}
      {openExpense && (
        <ExpenseDetailModal
          expense={openExpense}
          currency={currency}
          categories={payload.categories.filter((category) => category.active !== false)}
          suppliers={payload.suppliers}
          onClose={() => setOpenExpense(null)}
          onUpdated={async (updated) => {
            setOpenExpense(updated);
            await refresh();
          }}
          setBusy={setBusy}
        />
      )}
    </div>
  );
}

/** @summary Tarjeta KPI pequeña de la cabecera de Gastos. */
function KpiCard({ label, value, tone }: { label: string; value: string; tone: "amber" | "emerald" | "rose" | "sky" }) {
  const tones: Record<string, string> = {
    amber: "text-amber-300",
    emerald: "text-emerald-300",
    rose: "text-rose-300",
    sky: "text-sky-300",
  };
  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--admin-muted)]">{label}</p>
      <p className={`mt-1 truncate text-lg font-black tabular-nums ${tones[tone]}`}>{value}</p>
    </div>
  );
}

/** @summary Tabla de gastos con acciones de pago y anulación. */
function ExpensesTable({
  expenses,
  currency,
  onOpen,
  onRefresh,
  setBusy,
}: {
  expenses: ExpenseRow[];
  currency: string;
  onOpen: (id: number) => void;
  onRefresh: () => Promise<void>;
  setBusy: (value: boolean) => void;
}) {
  /** @summary Anula un gasto sin pagos. */
  async function annul(expense: ExpenseRow) {
    const result = await Swal.fire({
      title: "¿Anular gasto?",
      text: `Vas a anular ${expense.number}. Solo es posible si no tiene pagos.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Anular",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    setBusy(true);
    try {
      await api(`/api/admin/gastos/${expense.id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) });
      await onRefresh();
    } catch (reason) {
      await showError("No se pudo anular el gasto", reason);
    } finally {
      setBusy(false);
    }
  }

  if (!expenses.length) {
    return (
      <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center">
        <Icon name="money" className="mx-auto text-4xl text-zinc-600" />
        <h3 className="mt-3 text-xl font-black">Todavía no hay gastos</h3>
        <p className="mt-2 text-sm text-[var(--admin-muted)]">Registrá alquiler, servicios, software y otros gastos del negocio.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
              <th className="px-4 py-3">Gasto</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3">Proveedor</th>
              <th className="px-4 py-3">Sucursal</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Saldo</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-border)]/70">
            {expenses.map((expense) => {
              const balance = Number(expense.total) - Number(expense.paidAmount);
              const overdue =
                expense.dueDate && new Date(expense.dueDate).getTime() < now && balance > 0 && !["paid", "cancelled"].includes(expense.status);
              return (
                <tr key={expense.id} className="transition-colors hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <button type="button" className="font-black text-pink-300 hover:underline" onClick={() => onOpen(expense.id)}>
                      {expense.number}
                    </button>
                    {expense.recurring?.name && <p className="inline-flex items-center gap-1 text-xs text-[var(--admin-muted)]"><Icon name="repeat" className="h-3 w-3" /> {expense.recurring.name}</p>}
                  </td>
                  <td className="px-4 py-3 text-[var(--admin-muted)]">{dateLabel(expense.expenseDate)}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold">{expense.category?.group ?? ""} › {expense.category?.name ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">{expense.supplier?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--admin-muted)]">{expense.branch?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{money(expense.total, currency)}</td>
                  <td className={`px-4 py-3 text-right font-bold tabular-nums ${balance > 0 ? "text-amber-300" : "text-emerald-300"}`}>
                    {money(balance, currency)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${STATUS_COLORS[expense.status] ?? STATUS_COLORS.draft}`}>
                        {expenseStatusLabels[expense.status] ?? expense.status}
                      </span>
                      {overdue && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-black text-rose-300">Vencido</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button type="button" className="btn btn-secondary px-2.5 py-1.5 text-xs" onClick={() => onOpen(expense.id)}>
                        Ver / Pagar
                      </button>
                      {!["paid", "cancelled"].includes(expense.status) && (
                        <button
                          type="button"
                          className="rounded-lg border border-red-500/20 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                          onClick={() => void annul(expense)}
                        >
                          Anular
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** @summary Tabla de previsiones recurrentes con materialización explícita. */
function RecurringTable({
  items,
  currency,
  onRefresh,
  setBusy,
}: {
  items: RecurringRow[];
  currency: string;
  onRefresh: () => Promise<void>;
  setBusy: (value: boolean) => void;
}) {
  /** @summary Convierte la previsión en un gasto real (confirmación explícita). */
  async function materialize(item: RecurringRow) {
    const result = await Swal.fire({
      title: "¿Convertir en gasto?",
      text: `“${item.name}” por ${money(item.amount, currency)} pasará a ser un gasto pendiente real. No se automatiza nada más.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Confirmar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ec4899",
      background: "#18181b",
      color: "#fafafa",
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    setBusy(true);
    try {
      await api(`/api/admin/gastos/recurrentes/${item.id}`, { method: "POST" });
      await Swal.fire({
        title: "Gasto creado",
        text: "Quedó pendiente de pago. Podés verlo en la pestaña Gastos.",
        icon: "success",
        timer: 1800,
        showConfirmButton: false,
        background: "#18181b",
        color: "#fafafa",
      });
      await onRefresh();
    } catch (reason) {
      await showError("No se pudo materializar la previsión", reason);
    } finally {
      setBusy(false);
    }
  }

  if (!items.length) {
    return (
      <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center">
        <Icon name="calendar" className="mx-auto text-4xl text-zinc-600" />
        <h3 className="mt-3 text-xl font-black">Todavía no hay previsiones</h3>
        <p className="mt-2 text-sm text-[var(--admin-muted)]">Definí gastos recurrentes (alquiler, servicios…) y el sistema te los sugiere antes de convertirlos en gasto.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--admin-border)] bg-white/[0.02] text-xs uppercase tracking-wider text-[var(--admin-muted)]">
              <th className="px-4 py-3">Previsión</th>
              <th className="px-4 py-3">Periodicidad</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3 text-right">Importe</th>
              <th className="px-4 py-3">Próxima fecha</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-border)]/70">
            {items.map((item) => (
              <tr key={item.id} className="transition-colors hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <p className="font-black">{item.name}</p>
                  {item.notes && <p className="text-xs text-[var(--admin-muted)]">{item.notes}</p>}
                </td>
                <td className="px-4 py-3 text-[var(--admin-muted)]">
                  {PERIODICITY_LABELS[item.periodicity] ?? item.periodicity}
                  {item.dayOfMonth ? ` · día ${item.dayOfMonth}` : ""}
                </td>
                <td className="px-4 py-3 text-xs">{item.category?.name ?? "—"}</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">{money(item.amount, currency)}</td>
                <td className="px-4 py-3 text-[var(--admin-muted)]">{dateLabel(item.nextDueDate)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${item.active === false ? "bg-zinc-500/15 text-zinc-400" : "bg-sky-500/15 text-sky-300"}`}>
                    {item.active === false ? "Inactiva" : "Prevista"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    {item.active !== false && (
                      <button type="button" className="btn px-2.5 py-1.5 text-xs" onClick={() => void materialize(item)}>
                        Convertir en gasto
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** @summary Tabla de categorías de gasto. */
function CategoriesTable({
  categories,
  onRefresh,
  setBusy,
}: {
  categories: Category[];
  onRefresh: () => Promise<void>;
  setBusy: (value: boolean) => void;
}) {
  /** @summary Activa o desactiva una categoría. */
  async function toggle(category: Category) {
    setBusy(true);
    try {
      await api(`/api/admin/gastos/categorias/${category.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: category.active === false }),
      });
      await onRefresh();
    } catch (reason) {
      await showError("No se pudo actualizar la categoría", reason);
    } finally {
      setBusy(false);
    }
  }

  if (!categories.length) {
    return (
      <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center">
        <Icon name="tag" className="mx-auto text-4xl text-zinc-600" />
        <h3 className="mt-3 text-xl font-black">Todavía no hay categorías</h3>
        <p className="mt-2 text-sm text-[var(--admin-muted)]">Creá categorías para clasificar los gastos del negocio.</p>
      </div>
    );
  }

  const grouped = categories.reduce<Record<string, Category[]>>((acc, category) => {
    (acc[category.group] ??= []).push(category);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([group, items]) => (
        <div key={group} className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl shadow-black/10">
          <div className="border-b border-[var(--admin-border)] bg-white/[0.02] px-4 py-2.5">
            <p className="text-xs font-black uppercase tracking-wider text-[var(--admin-muted)]">{group}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-[var(--admin-border)]/70">
                {items.map((category) => (
                  <tr key={category.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-semibold">{category.name}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${category.active === false ? "bg-zinc-500/15 text-zinc-400" : "bg-emerald-500/15 text-emerald-300"}`}>
                        {category.active === false ? "Inactiva" : "Activa"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" className="btn btn-secondary px-2.5 py-1.5 text-xs" onClick={() => void toggle(category)}>
                        {category.active === false ? "Activar" : "Desactivar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

/** @summary Alta de gasto sin inventario. */
function NewExpenseModal({
  branches,
  suppliers,
  categories,
  currency,
  activeBranchId,
  onClose,
  onSaved,
}: {
  branches: BranchOption[];
  suppliers: Supplier[];
  categories: Category[];
  currency: string;
  activeBranchId: number | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [categoryId, setCategoryId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [branchId, setBranchId] = useState(activeBranchId ? String(activeBranchId) : "");
  const [amountNet, setAmountNet] = useState("");
  const [taxPercent, setTaxPercent] = useState("0");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("transferencia");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const taxAmount = (Number(amountNet || 0) * Number(taxPercent || 0)) / 100;
  const total = Number(amountNet || 0) + taxAmount;

  /** @summary Guarda el gasto. */
  async function save() {
    if (!categoryId) {
      await Swal.fire({ title: "Elegí la categoría", icon: "warning", background: "#18181b", color: "#fafafa" });
      return;
    }
    if (!Number.isFinite(Number(amountNet)) || Number(amountNet) < 0) {
      await Swal.fire({ title: "Indicá un importe válido", icon: "warning", background: "#18181b", color: "#fafafa" });
      return;
    }
    setSaving(true);
    try {
      await api("/api/admin/gastos", {
        method: "POST",
        body: JSON.stringify({
          categoryId: Number(categoryId),
          supplierId: supplierId ? Number(supplierId) : null,
          branchId: branchId ? Number(branchId) : null,
          amountNet: Number(amountNet),
          taxPercent: Number(taxPercent || 0),
          expenseDate,
          dueDate: dueDate || null,
          paymentMethod: paymentMethod || null,
          notes: notes || undefined,
        }),
      });
      await Swal.fire({
        title: "Gasto registrado",
        text: "No afecta inventario y quedó disponible para Finanzas.",
        icon: "success",
        timer: 1800,
        showConfirmButton: false,
        background: "#18181b",
        color: "#fafafa",
      });
      await onSaved();
    } catch (reason) {
      await showError("No se pudo registrar el gasto", reason);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalFrame title="Nuevo gasto" subtitle="Alquiler, servicios, software… sin impacto en inventario" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Categoría *</span>
            <select className="input w-full" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} aria-label="Categoría">
              <option value="">Elegí una categoría…</option>
              {categories.map((category) => (
                <option key={category.id} value={String(category.id)}>{category.group} › {category.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="field-label">Proveedor</span>
            <select className="input w-full" value={supplierId} onChange={(event) => setSupplierId(event.target.value)} aria-label="Proveedor">
              <option value="">Sin proveedor</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={String(supplier.id)}>{supplier.name}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Importe neto *</span>
            <input className="input w-full" type="number" min="0" step="0.01" value={amountNet} onChange={(event) => setAmountNet(event.target.value)} placeholder="0,00" aria-label="Importe neto" />
          </label>
          <label className="block">
            <span className="field-label">Impuestos (%)</span>
            <input className="input w-full" type="number" min="0" max="100" step="0.01" value={taxPercent} onChange={(event) => setTaxPercent(event.target.value)} aria-label="Impuestos" />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="field-label">Fecha</span>
            <input className="input w-full" type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} aria-label="Fecha del gasto" />
          </label>
          <label className="block">
            <span className="field-label">Vencimiento</span>
            <input className="input w-full" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} aria-label="Vencimiento" />
          </label>
          <label className="block">
            <span className="field-label">Medio de pago</span>
            <select className="input w-full" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} aria-label="Medio de pago">
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="otro">Otro</option>
            </select>
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Sucursal</span>
            <select className="input w-full" value={branchId} onChange={(event) => setBranchId(event.target.value)} aria-label="Sucursal">
              <option value="">Sin sucursal</option>
              {branches.map((branch) => (
                <option key={branch.id} value={String(branch.id)}>{branch.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="field-label">Notas</span>
            <input className="input w-full" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Detalle opcional" aria-label="Notas" />
          </label>
        </div>
        <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] p-4">
          <div className="flex justify-between text-sm text-[var(--admin-muted)]">
            <span>Neto</span><span>{money(Number(amountNet || 0), currency)}</span>
          </div>
          <div className="flex justify-between text-sm text-[var(--admin-muted)]">
            <span>Impuestos</span><span>{money(taxAmount, currency)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-[var(--admin-border)] pt-2 text-base font-black">
            <span>Total</span><span>{money(total, currency)}</span>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn" onClick={() => void save()} disabled={saving}>
            {saving ? "Guardando…" : "Guardar gasto"}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}

/** @summary Detalle de un gasto con edición, pagos parciales y anulación. */
function ExpenseDetailModal({
  expense,
  currency,
  categories,
  suppliers,
  onClose,
  onUpdated,
  setBusy,
}: {
  expense: ExpenseDetail;
  currency: string;
  categories: Category[];
  suppliers: Supplier[];
  onClose: () => void;
  onUpdated: (updated: ExpenseDetail) => Promise<void>;
  setBusy: (value: boolean) => void;
}) {
  const balance = Math.max(0, Number(expense.total) - Number(expense.paidAmount));
  const [editing, setEditing] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState(String(expense.category?.id ?? ""));
  const [editSupplierId, setEditSupplierId] = useState(expense.supplier ? String(expense.supplier.id) : "");
  const [editAmountNet, setEditAmountNet] = useState(String(expense.amountNet));
  const [editTaxPercent, setEditTaxPercent] = useState(() => {
    const total = Number(expense.total);
    const net = Number(expense.amountNet);
    return net > 0 ? String(Math.round(((total - net) / net) * 10000) / 100) : "0";
  });
  const [editDueDate, setEditDueDate] = useState(expense.dueDate?.slice(0, 10) ?? "");
  const [payAmount, setPayAmount] = useState(String(balance || ""));
  const [payMethod, setPayMethod] = useState("transferencia");
  const [payNotes, setPayNotes] = useState("");
  const [saving, setSaving] = useState(false);

  /** @summary Guarda los cambios de un gasto sin pagos. */
  async function saveEdits() {
    if (!editCategoryId) {
      await Swal.fire({ title: "Elegí la categoría", icon: "warning", background: "#18181b", color: "#fafafa" });
      return;
    }
    setSaving(true);
    setBusy(true);
    try {
      const updated = await api<{ item: ExpenseDetail }>(`/api/admin/gastos/${expense.id}`, {
        method: "PUT",
        body: JSON.stringify({
          categoryId: Number(editCategoryId),
          supplierId: editSupplierId ? Number(editSupplierId) : null,
          amountNet: Number(editAmountNet),
          taxPercent: Number(editTaxPercent || 0),
          dueDate: editDueDate || null,
        }),
      });
      setEditing(false);
      await onUpdated(updated.item);
    } catch (reason) {
      await showError("No se pudo actualizar el gasto", reason);
    } finally {
      setSaving(false);
      setBusy(false);
    }
  }

  /** @summary Registra un pago parcial o total. */
  async function pay() {
    if (!Number.isFinite(Number(payAmount)) || Number(payAmount) <= 0) {
      await Swal.fire({ title: "Indicá un monto válido", icon: "warning", background: "#18181b", color: "#fafafa" });
      return;
    }
    if (Number(payAmount) > balance) {
      await Swal.fire({
        title: "El pago supera el saldo",
        text: `El saldo pendiente es ${money(balance, currency)}.`,
        icon: "warning",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setSaving(true);
    setBusy(true);
    try {
      await api(`/api/admin/gastos/${expense.id}/pagos`, {
        method: "POST",
        body: JSON.stringify({ amount: Number(payAmount), method: payMethod, notes: payNotes || undefined }),
      });
      const updated = await api<ExpenseDetail>(`/api/admin/gastos/${expense.id}`);
      setPayAmount(String(Math.max(0, Number(updated.total) - Number(updated.paidAmount)) || ""));
      setPayNotes("");
      await onUpdated(updated);
    } catch (reason) {
      await showError("No se pudo registrar el pago", reason);
    } finally {
      setSaving(false);
      setBusy(false);
    }
  }

  /** @summary Anula el gasto (solo sin pagos). */
  async function annul() {
    const result = await Swal.fire({
      title: "¿Anular gasto?",
      text: `Vas a anular ${expense.number}. Esta acción no se puede revertir.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Anular",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    setBusy(true);
    try {
      await api(`/api/admin/gastos/${expense.id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) });
      onClose();
      await onUpdated(expense);
    } catch (reason) {
      await showError("No se pudo anular el gasto", reason);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalFrame title={expense.number} subtitle={`${expense.category?.group ?? ""} › ${expense.category?.name ?? ""} · ${dateLabel(expense.expenseDate)}`} onClose={onClose} wide>
      <div className="space-y-5">
        {/* Resumen */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--admin-muted)]">Total</p>
            <p className="mt-1 text-lg font-black tabular-nums">{money(expense.total, currency)}</p>
          </div>
          <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--admin-muted)]">Pagado</p>
            <p className="mt-1 text-lg font-black tabular-nums text-emerald-300">{money(expense.paidAmount, currency)}</p>
          </div>
          <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--admin-muted)]">Saldo</p>
            <p className="mt-1 text-lg font-black tabular-nums text-amber-300">{money(balance, currency)}</p>
          </div>
          <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--admin-muted)]">Estado</p>
            <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-[10px] font-black ${STATUS_COLORS[expense.status] ?? STATUS_COLORS.draft}`}>
              {expenseStatusLabels[expense.status] ?? expense.status}
            </span>
          </div>
        </div>

        {/* Pago */}
        {!["paid", "cancelled"].includes(expense.status) && (
          <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] p-4">
            <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-[var(--admin-muted)]">Registrar pago</h3>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block flex-1 min-w-40">
                <span className="field-label">Monto</span>
                <input className="input w-full" type="number" min="0" step="0.01" value={payAmount} onChange={(event) => setPayAmount(event.target.value)} aria-label="Monto del pago" />
              </label>
              <label className="block">
                <span className="field-label">Medio</span>
                <select className="input w-auto" value={payMethod} onChange={(event) => setPayMethod(event.target.value)} aria-label="Medio de pago">
                  <option value="transferencia">Transferencia</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="otro">Otro</option>
                </select>
              </label>
              <label className="block min-w-40 flex-1">
                <span className="field-label">Nota</span>
                <input className="input w-full" value={payNotes} onChange={(event) => setPayNotes(event.target.value)} placeholder="Opcional" aria-label="Nota del pago" />
              </label>
              <button type="button" className="btn" onClick={() => void pay()} disabled={saving}>
                {saving ? "Guardando…" : "Pagar"}
              </button>
            </div>
          </div>
        )}

        {/* Pagos registrados */}
        {expense.payments.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-black uppercase tracking-wider text-[var(--admin-muted)]">Pagos</h3>
            <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)]">
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-[var(--admin-border)]/70">
                  {expense.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-4 py-2.5 font-semibold">{payment.number}</td>
                      <td className="px-4 py-2.5 text-[var(--admin-muted)]">{dateLabel(payment.paidAt)}</td>
                      <td className="px-4 py-2.5 text-[var(--admin-muted)]">{payment.method}</td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums">{money(payment.amount, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Edición (solo sin pagos) */}
        {!expense.payments.length && expense.status !== "cancelled" && (
          <div className="rounded-2xl border border-[var(--admin-border)] bg-white/[0.02] p-4">
            <button type="button" className="text-sm font-bold text-pink-300 hover:underline" onClick={() => setEditing((value) => !value)}>
              {editing ? "Ocultar edición" : "Editar datos"}
            </button>
            {editing && (
              <div className="mt-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="field-label">Categoría *</span>
                    <select className="input w-full" value={editCategoryId} onChange={(event) => setEditCategoryId(event.target.value)} aria-label="Categoría">
                      <option value="">Elegí una categoría…</option>
                      {categories.map((category) => (
                        <option key={category.id} value={String(category.id)}>{category.group} › {category.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="field-label">Proveedor</span>
                    <select className="input w-full" value={editSupplierId} onChange={(event) => setEditSupplierId(event.target.value)} aria-label="Proveedor">
                      <option value="">Sin proveedor</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={String(supplier.id)}>{supplier.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block">
                    <span className="field-label">Importe neto</span>
                    <input className="input w-full" type="number" min="0" step="0.01" value={editAmountNet} onChange={(event) => setEditAmountNet(event.target.value)} aria-label="Importe neto" />
                  </label>
                  <label className="block">
                    <span className="field-label">Impuestos (%)</span>
                    <input className="input w-full" type="number" min="0" max="100" step="0.01" value={editTaxPercent} onChange={(event) => setEditTaxPercent(event.target.value)} aria-label="Impuestos" />
                  </label>
                  <label className="block">
                    <span className="field-label">Vencimiento</span>
                    <input className="input w-full" type="date" value={editDueDate} onChange={(event) => setEditDueDate(event.target.value)} aria-label="Vencimiento" />
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>Cancelar</button>
                  <button type="button" className="btn" onClick={() => void saveEdits()} disabled={saving}>
                    {saving ? "Guardando…" : "Guardar cambios"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Acciones peligrosas */}
        {!expense.payments.length && expense.status !== "cancelled" && (
          <div className="flex justify-end">
            <button type="button" className="rounded-lg border border-red-500/20 px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/10" onClick={() => void annul()}>
              Anular gasto
            </button>
          </div>
        )}
        {expense.notes && <p className="text-sm text-[var(--admin-muted)]">{expense.notes}</p>}
      </div>
    </ModalFrame>
  );
}

/** @summary Alta de previsión de gasto recurrente. */
function NewRecurringModal({
  categories,
  currency,
  onClose,
  onSaved,
}: {
  categories: Category[];
  currency: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [periodicity, setPeriodicity] = useState("monthly");
  const [categoryId, setCategoryId] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  /** @summary Guarda la previsión. */
  async function save() {
    if (!name.trim()) {
      await Swal.fire({ title: "Indicá el nombre", icon: "warning", background: "#18181b", color: "#fafafa" });
      return;
    }
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      await Swal.fire({ title: "Indicá un importe válido", icon: "warning", background: "#18181b", color: "#fafafa" });
      return;
    }
    setSaving(true);
    try {
      await api("/api/admin/gastos/recurrentes", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          amount: Number(amount),
          periodicity,
          categoryId: categoryId ? Number(categoryId) : null,
          dayOfMonth: dayOfMonth ? Number(dayOfMonth) : null,
          nextDueDate: nextDueDate || undefined,
          notes: notes || undefined,
        }),
      });
      await Swal.fire({
        title: "Previsión creada",
        text: "No genera movimientos: la convertís en gasto cuando confirmes.",
        icon: "success",
        timer: 1800,
        showConfirmButton: false,
        background: "#18181b",
        color: "#fafafa",
      });
      await onSaved();
    } catch (reason) {
      await showError("No se pudo crear la previsión", reason);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalFrame title="Nueva previsión" subtitle={`Gasto recurrente previsto (${money(Number(amount || 0), currency)} por ciclo)`} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Nombre *</span>
            <input className="input w-full" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej.: Alquiler del local" aria-label="Nombre" />
          </label>
          <label className="block">
            <span className="field-label">Importe *</span>
            <input className="input w-full" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" aria-label="Importe" />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="field-label">Periodicidad</span>
            <select className="input w-full" value={periodicity} onChange={(event) => setPeriodicity(event.target.value)} aria-label="Periodicidad">
              <option value="monthly">Mensual</option>
              <option value="weekly">Semanal</option>
              <option value="yearly">Anual</option>
            </select>
          </label>
          <label className="block">
            <span className="field-label">Día del mes</span>
            <input className="input w-full" type="number" min="1" max="31" value={dayOfMonth} onChange={(event) => setDayOfMonth(event.target.value)} placeholder="Ej.: 5" aria-label="Día del mes" />
          </label>
          <label className="block">
            <span className="field-label">Categoría</span>
            <select className="input w-full" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} aria-label="Categoría">
              <option value="">Sin categoría</option>
              {categories.map((category) => (
                <option key={category.id} value={String(category.id)}>{category.group} › {category.name}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Próxima fecha</span>
            <input className="input w-full" type="date" value={nextDueDate} onChange={(event) => setNextDueDate(event.target.value)} aria-label="Próxima fecha" />
          </label>
          <label className="block">
            <span className="field-label">Notas</span>
            <input className="input w-full" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opcional" aria-label="Notas" />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn" onClick={() => void save()} disabled={saving}>
            {saving ? "Guardando…" : "Guardar previsión"}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}

/** @summary Alta de categoría de gasto. */
function CategoryModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const [group, setGroup] = useState("Operación");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  /** @summary Guarda la categoría. */
  async function save() {
    if (!group.trim() || !name.trim()) {
      await Swal.fire({ title: "Completá grupo y nombre", icon: "warning", background: "#18181b", color: "#fafafa" });
      return;
    }
    setSaving(true);
    try {
      await api("/api/admin/gastos/categorias", {
        method: "POST",
        body: JSON.stringify({ group: group.trim(), name: name.trim() }),
      });
      await onSaved();
    } catch (reason) {
      await showError("No se pudo crear la categoría", reason);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalFrame title="Nueva categoría" subtitle="Agrupá los gastos para analizarlos mejor" onClose={onClose}>
      <div className="space-y-4">
        <label className="block">
          <span className="field-label">Grupo</span>
          <select className="input w-full" value={group} onChange={(event) => setGroup(event.target.value)} aria-label="Grupo">
            <option>Operación</option>
            <option>Personal</option>
            <option>Marketing</option>
            <option>Administración</option>
            <option>Otros</option>
          </select>
        </label>
        <label className="block">
          <span className="field-label">Nombre *</span>
          <input className="input w-full" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej.: Alquiler" aria-label="Nombre de la categoría" />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn" onClick={() => void save()} disabled={saving}>
            {saving ? "Guardando…" : "Guardar categoría"}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}
