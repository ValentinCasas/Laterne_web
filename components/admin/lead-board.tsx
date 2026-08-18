"use client";

import { useMemo, useState, type DragEvent } from "react";
import Swal from "sweetalert2";
import { PageHeader, SearchBox, ActionMenu } from "@/components/admin/ui";
import { scopedFetch } from "@/lib/client-routing";

type LeadStatus = "new" | "contacted" | "demo_scheduled" | "quote_sent" | "negotiation" | "won" | "lost";
type Lead = {
  id: number;
  status: string;
  fullName: string;
  businessName: string;
  businessType: string;
  city: string;
  province: string;
  phone: string;
  email: string;
  approximateProducts: number | null;
  branches: number;
  requiredFeatures: string[] | null;
  approximateBudget: string | null;
  message: string | null;
  source: string;
  createdAt: string;
  plan: { name: string } | null;
};

const statuses: Array<{ key: LeadStatus; label: string; color: string }> = [
  { key: "new", label: "Nuevas", color: "text-sky-300 border-sky-500/25" },
  { key: "contacted", label: "Contactadas", color: "text-violet-300 border-violet-500/25" },
  { key: "demo_scheduled", label: "Demo", color: "text-amber-300 border-amber-500/25" },
  { key: "quote_sent", label: "Presupuesto", color: "text-orange-300 border-orange-500/25" },
  { key: "negotiation", label: "Negociación", color: "text-pink-300 border-pink-500/25" },
  { key: "won", label: "Ganadas", color: "text-emerald-300 border-emerald-500/25" },
  { key: "lost", label: "Perdidas", color: "text-red-300 border-red-500/25" },
];

/** @summary Organiza oportunidades por etapa y permite moverlas sin perder la información comercial. */
export function LeadBoard({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const visibleLeads = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    if (!normalized) return leads;
    return leads.filter((lead) =>
      `${lead.fullName} ${lead.businessName} ${lead.email} ${lead.phone} ${lead.city}`
        .toLocaleLowerCase("es")
        .includes(normalized),
    );
  }, [leads, query]);

  /** @summary Guarda una nueva etapa comercial y actualiza la oportunidad de manera optimista. */
  async function move(lead: Lead, status: LeadStatus, note?: string) {
    if (lead.status === status && !note) return;
    const response = await scopedFetch(`/api/admin/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, note }),
    });
    const body = (await response.json()) as { lead?: Lead; error?: string };
    if (!response.ok || !body.lead) {
      await Swal.fire({
        title: "No se pudo actualizar",
        text: body.error ?? "Intentá nuevamente.",
        icon: "error",
        confirmButtonColor: "#ec4899",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setLeads((current) => current.map((item) => (item.id === lead.id ? { ...item, ...body.lead } : item)));
    setSelected((current) => (current?.id === lead.id ? { ...current, ...body.lead } : current));
  }

  /** @summary Recupera la oportunidad arrastrada y la mueve a la etapa donde fue soltada. */
  async function drop(event: DragEvent<HTMLElement>, status: LeadStatus) {
    event.preventDefault();
    const id = Number(event.dataTransfer.getData("text/lead-id") || draggingId);
    const lead = leads.find((item) => item.id === id);
    setDraggingId(null);
    if (lead) await move(lead, status);
  }

  return (
    <section>
      <PageHeader
        eyebrow="Proceso comercial"
        title="Oportunidades"
        description="Consultas recibidas desde la solicitud de demostración."
        section="oportunidades"
        actions={
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Buscar negocio o contacto…"
            className="min-w-64"
          />
        }
      />

      <div className="mt-6 flex gap-4 overflow-x-auto pb-5 [scrollbar-color:#ec4899_#27272a]">
        {statuses.map((status) => {
          const columnLeads = visibleLeads.filter((lead) => lead.status === status.key);
          return (
            <section
              className={`w-72 shrink-0 rounded-3xl border bg-zinc-950/70 p-3 ${status.color}`}
              key={status.key}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => drop(event, status.key)}
            >
              <header className="flex items-center justify-between px-2 py-3">
                <h2 className="font-black text-white">{status.label}</h2>
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-black">
                  {columnLeads.length}
                </span>
              </header>
              <div className="max-h-[580px] min-h-40 space-y-3 overflow-y-auto px-1 pb-1">
                {columnLeads.map((lead) => (
                  <article
                    className={`cursor-grab rounded-2xl border border-white/10 bg-black p-4 text-white ${draggingId === lead.id ? "opacity-40" : ""}`}
                    draggable
                    key={lead.id}
                    onDragEnd={() => setDraggingId(null)}
                    onDragStart={(event) => {
                      setDraggingId(lead.id);
                      event.dataTransfer.setData("text/lead-id", String(lead.id));
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-pink-300">#{lead.id}</span>
                      <time className="text-[10px] text-zinc-600">
                        {new Date(lead.createdAt).toLocaleDateString("es-AR")}
                      </time>
                    </div>
                    <h3 className="mt-2 font-black">{lead.businessName}</h3>
                    <p className="text-sm text-zinc-500">
                      {lead.fullName} · {lead.businessType}
                    </p>
                    {lead.plan && (
                      <span className="mt-3 block rounded-lg bg-white/5 px-2 py-1 text-xs">
                        {lead.plan.name}
                      </span>
                    )}
                    <div className="mt-4 flex justify-end">
                      <ActionMenu
                        items={[
                          { label: "Ver detalle", onClick: () => setSelected(lead) },
                          {
                            label: lead.status === "won" ? "Marcar perdida" : "Marcar ganada",
                            onClick: () => move(lead, lead.status === "won" ? "lost" : "won"),
                            tone: lead.status === "won" ? "danger" : "primary",
                          },
                        ]}
                      />
                    </div>
                  </article>
                ))}
                {!columnLeads.length && (
                  <div className="grid min-h-32 place-items-center rounded-2xl border border-dashed border-current/20 p-5 text-center text-xs opacity-50">
                    Soltá una oportunidad acá
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <article
            className="my-6 w-full max-w-2xl rounded-[2rem] border border-white/10 bg-zinc-950 p-6 sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-eyebrow">Oportunidad #{selected.id}</p>
                <h2 className="mt-1 text-3xl font-black">{selected.businessName}</h2>
              </div>
              <button
                className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-xl"
                onClick={() => setSelected(null)}
                type="button"
                aria-label="Cerrar detalle"
              >
                ×
              </button>
            </div>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                ["Contacto", selected.fullName],
                ["Tipo", selected.businessType],
                ["Ubicación", `${selected.city}, ${selected.province}`],
                ["Email", selected.email],
                ["Teléfono", selected.phone],
                ["Productos", selected.approximateProducts?.toString() ?? "Sin indicar"],
                ["Sucursales", String(selected.branches)],
                ["Presupuesto", selected.approximateBudget ?? "Sin indicar"],
                ["Plan", selected.plan?.name ?? "Necesita recomendación"],
                ["Origen", selected.source],
              ].map(([label, value]) => (
                <div className="rounded-xl bg-white/[.03] p-3" key={label}>
                  <dt className="text-xs uppercase text-zinc-600">{label}</dt>
                  <dd className="mt-1 break-words font-bold">{value}</dd>
                </div>
              ))}
            </dl>
            {selected.requiredFeatures && selected.requiredFeatures.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-black">Funciones solicitadas</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selected.requiredFeatures.map((feature) => (
                    <span
                      className="rounded-full bg-pink-500/10 px-3 py-1 text-xs text-pink-300"
                      key={feature}
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {selected.message && (
              <div className="mt-5 rounded-2xl border border-white/10 p-4">
                <h3 className="text-sm font-black">Mensaje</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">
                  {selected.message}
                </p>
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                className="btn"
                href={`https://wa.me/${selected.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
              >
                Hablar por WhatsApp
              </a>
              <a className="btn btn-secondary" href={`mailto:${selected.email}`}>
                Enviar email
              </a>
              <select
                className="input max-w-52"
                value={selected.status}
                onChange={(event) => move(selected, event.target.value as LeadStatus)}
                aria-label="Cambiar estado de oportunidad"
              >
                {statuses.map((option) => (
                  <option value={option.key} key={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
