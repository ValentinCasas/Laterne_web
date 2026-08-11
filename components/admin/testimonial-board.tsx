"use client";

import { useState, type DragEvent } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

type ModerationStatus = "approved" | "pending" | "rejected";
type TestimonialItem = {
  id: number;
  description: string;
  date: string;
  state: boolean;
  moderationStatus: string;
};

const columns: Array<{
  status: ModerationStatus;
  title: string;
  description: string;
  color: string;
}> = [
  {
    status: "pending",
    title: "Pendientes",
    description: "Esperan una decisión",
    color: "border-amber-500/30 bg-amber-500/5 text-amber-300",
  },
  {
    status: "approved",
    title: "Aprobados",
    description: "Visibles en el inicio",
    color: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
  },
  {
    status: "rejected",
    title: "Rechazados",
    description: "Guardados, pero ocultos",
    color: "border-red-500/30 bg-red-500/5 text-red-300",
  },
];

/** @summary Normaliza el estado heredado para que las opiniones antiguas mantengan su aprobación. */
function testimonialStatus(item: TestimonialItem): ModerationStatus {
  if (["approved", "pending", "rejected"].includes(item.moderationStatus)) {
    return item.moderationStatus as ModerationStatus;
  }
  return item.state ? "approved" : "pending";
}

/** @summary Organiza testimonios en columnas y permite moderarlos mediante arrastre o botones. */
export function TestimonialBoard({ initialItems }: { initialItems: TestimonialItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState<TestimonialItem | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<ModerationStatus | null>(null);
  const [activeColumn, setActiveColumn] = useState<ModerationStatus>("pending");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  /** @summary Guarda en el servidor el nuevo estado de moderación de una opinión. */
  async function move(item: TestimonialItem, status: ModerationStatus) {
    if (testimonialStatus(item) === status) return;
    const response = await fetch(`/api/admin/testimonios/${item.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ moderationStatus: status }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      await Swal.fire({
        title: "No se pudo cambiar el estado",
        text: body.error ?? "Intentá nuevamente.",
        icon: "error",
        confirmButtonColor: "#ec4899",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }

    setItems((current) =>
      current.map((currentItem) =>
        currentItem.id === item.id
          ? { ...currentItem, moderationStatus: status, state: status === "approved" }
          : currentItem,
      ),
    );
  }

  /** @summary Recupera la opinión arrastrada y la mueve a la columna donde fue soltada. */
  async function drop(event: DragEvent<HTMLElement>, status: ModerationStatus) {
    event.preventDefault();
    const id = Number(event.dataTransfer.getData("text/testimonial-id") || draggingId);
    const item = items.find((candidate) => candidate.id === id);
    setDraggingId(null);
    setDropTarget(null);
    if (item) await move(item, status);
  }

  /** @summary Actualiza el texto y el estado seleccionados desde el editor convencional. */
  async function save(formData: FormData) {
    if (!editing) return;
    const description = String(formData.get("description") ?? "").trim();
    const moderationStatus = String(formData.get("moderationStatus") ?? "pending") as ModerationStatus;
    const response = await fetch(`/api/admin/testimonios/${editing.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description, moderationStatus }),
    });
    const body = await response.json();
    if (!response.ok) {
      await Swal.fire({
        title: "No se pudo guardar",
        text: body.error ?? "Revisá los datos e intentá nuevamente.",
        icon: "error",
        confirmButtonColor: "#ec4899",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setItems((current) =>
      current.map((item) =>
        item.id === editing.id
          ? { ...item, description, moderationStatus, state: moderationStatus === "approved" }
          : item,
      ),
    );
    setEditing(null);
    await Swal.fire({
      title: "Testimonio actualizado",
      icon: "success",
      timer: 1400,
      showConfirmButton: false,
      background: "#18181b",
      color: "#fafafa",
    });
  }

  /** @summary Confirma la acción y elimina definitivamente una opinión de la base de datos. */
  async function remove(item: TestimonialItem) {
    const confirmation = await Swal.fire({
      title: "¿Eliminar este testimonio?",
      text: "Esta acción sí lo borra definitivamente.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
      reverseButtons: true,
    });
    if (!confirmation.isConfirmed) return;
    const response = await fetch(`/api/admin/testimonios/${item.id}`, { method: "DELETE" });
    if (response.ok) setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
  }

  return (
    <section>
      <AdminPageHeader
        eyebrow="Moderación"
        title="Testimonios"
        description="Arrastrá cada opinión entre columnas. En celulares también podés usar sus botones rápidos."
        section="testimonios"
      />

       <div className="mt-6 flex gap-2 overflow-x-auto border-b border-[var(--admin-border)] pb-2 lg:hidden" role="tablist" aria-label="Moderación de testimonios">
         {columns.map((column) => <button className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-black ${activeColumn === column.status ? "bg-[var(--admin-primary-strong)] text-white" : "bg-white/5 text-[var(--admin-muted)]"}`} key={column.status} onClick={() => setActiveColumn(column.status)} type="button" role="tab" aria-selected={activeColumn === column.status}>{column.title} · {items.filter((item) => testimonialStatus(item) === column.status).length}</button>)}
       </div>
       <div className="mt-4 grid min-w-0 gap-6 xl:grid-cols-3">
        {columns.map((column) => {
          const columnItems = items.filter((item) => testimonialStatus(item) === column.status);
          return (
            <section
               className={`${column.status === activeColumn ? "block" : "hidden"} min-w-0 rounded-3xl border p-4 transition lg:block ${column.color} ${
                dropTarget === column.status ? "ring-2 ring-current" : ""
              }`}
              key={column.status}
              onDragEnter={(event) => {
                event.preventDefault();
                setDropTarget(column.status);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTarget(null);
              }}
              onDrop={(event) => drop(event, column.status)}
            >
              <header className="flex items-start justify-between gap-3 px-2 py-3">
                <div>
                  <h2 className="text-xl font-black text-white">{column.title}</h2>
                  <p className="mt-1 text-xs opacity-70">{column.description}</p>
                </div>
                <span className="rounded-full bg-black/25 px-3 py-1 text-xs font-black">
                  {columnItems.length}
                </span>
              </header>

              <div className="max-h-[560px] min-h-52 space-y-3 overflow-y-auto px-1 pb-1 [scrollbar-color:currentColor_transparent]">
                {columnItems.map((item) => (
                  <article
                    className={`cursor-grab rounded-2xl border border-white/10 bg-zinc-950 p-4 text-white shadow-lg shadow-black/20 active:cursor-grabbing ${
                      draggingId === item.id ? "opacity-40" : ""
                    }`}
                    draggable
                    key={item.id}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDropTarget(null);
                    }}
                    onDragStart={(event) => {
                      setDraggingId(item.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/testimonial-id", item.id.toString());
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-black text-pink-300">#{item.id}</span>
                      <time className="text-xs text-zinc-600">
                        {new Date(item.date).toLocaleDateString("es-AR", { timeZone: "UTC" })}
                      </time>
                    </div>
                    <p className={`${expanded.has(item.id) ? "" : "line-clamp-4"} mt-3 text-base leading-relaxed text-zinc-300`}>“{item.description}”</p>
                    {item.description.length > 220 && <button className="mt-2 text-xs font-black text-[var(--admin-primary)]" onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} type="button">{expanded.has(item.id) ? "Ver menos" : "Ver completo"}</button>}

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-3">
                      {column.status !== "approved" && (
                        <button
                          className="rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500 hover:text-white"
                          onClick={() => move(item, "approved")}
                          type="button"
                        >
                          Aprobar
                        </button>
                      )}
                      {column.status !== "rejected" && (
                        <button
                          className="rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500 hover:text-white"
                          onClick={() => move(item, "rejected")}
                          type="button"
                        >
                          Rechazar
                        </button>
                      )}
                      {column.status !== "pending" && (
                        <button
                          className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500 hover:text-black"
                          onClick={() => move(item, "pending")}
                          type="button"
                        >
                          Pendiente
                        </button>
                      )}
                      <button
                        className="ml-auto rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-bold hover:bg-white/10"
                        onClick={() => setEditing(item)}
                        type="button"
                      >
                        Editar
                      </button>
                      <button
                        className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500 hover:text-white"
                        onClick={() => remove(item)}
                        type="button"
                      >
                        Eliminar
                      </button>
                    </div>
                  </article>
                ))}

                {!columnItems.length && (
                  <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-current/20 p-6 text-center text-sm opacity-50">
                     No hay testimonios en esta sección.
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {editing && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-sm">
          <form
            action={save}
            className="w-full max-w-xl rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-pink-300">Editar opinión</p>
                <h2 className="mt-1 text-2xl font-black">Testimonio #{editing.id}</h2>
              </div>
              <button
                className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-xl"
                onClick={() => setEditing(null)}
                type="button"
                aria-label="Cerrar editor"
              >
                ×
              </button>
            </div>
            <label className="mt-6 block text-sm font-bold">
              Comentario
              <textarea
                className="input mt-2 min-h-36 resize-y"
                name="description"
                required
                defaultValue={editing.description}
              />
            </label>
            <label className="mt-4 block text-sm font-bold">
              Estado
              <select
                className="input mt-2"
                name="moderationStatus"
                defaultValue={testimonialStatus(editing)}
              >
                <option value="pending">Pendiente</option>
                <option value="approved">Aprobado</option>
                <option value="rejected">Rechazado</option>
              </select>
            </label>
            <div className="mt-6 flex gap-3">
              <button className="btn">Guardar cambios</button>
              <button className="btn btn-secondary" onClick={() => setEditing(null)} type="button">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
