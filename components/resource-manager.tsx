"use client";
import { useState } from "react";

type Field = { key: string; label: string; type?: string; required?: boolean };
type Item = Record<string, unknown> & { id: number };

/** @summary Administra la creación, edición y eliminación de un tipo de contenido. */
export function ResourceManager({
  title,
  resource,
  initialItems,
  fields,
}: {
  title: string;
  resource: string;
  initialItems: Item[];
  fields: Field[];
}) {
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState<Item | null>(null);
  const [message, setMessage] = useState("");
  /** @summary Crea o actualiza un registro y sincroniza el resultado con la tabla visible. */
  async function save(formData: FormData) {
    const payload = Object.fromEntries(formData);
    const id = editing?.id;
    const response = await fetch(`/api/admin/${resource}${id ? `/${id}` : ""}`, {
      method: id ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) return setMessage(body.error ?? "No se pudo guardar");
    setItems((current) =>
      id ? current.map((item) => (item.id === id ? body.item : item)) : [...current, body.item],
    );
    setEditing(null);
    setMessage("Guardado correctamente");
  }
  /** @summary Solicita confirmación y elimina un registro del recurso seleccionado. */
  async function remove(id: number) {
    if (!confirm("¿Eliminar este registro?")) return;
    const response = await fetch(`/api/admin/${resource}/${id}`, { method: "DELETE" });
    if (response.ok) setItems((current) => current.filter((item) => item.id !== id));
  }
  return (
    <section>
      <p className="font-bold uppercase tracking-widest text-pink-400">Contenido</p>
      <h1 className="mt-2 text-4xl font-black">{title}</h1>
      <form action={save} className="card mt-8 grid gap-4 p-6 md:grid-cols-2">
        {fields.map((field) => (
          <label className="text-sm" key={field.key}>
            {field.label}
            <input
              className="input mt-2"
              name={field.key}
              type={field.type ?? "text"}
              required={field.required}
              defaultValue={editing ? String(editing[field.key] ?? "") : ""}
              key={`${editing?.id ?? "new"}-${field.key}`}
            />
          </label>
        ))}
        <div className="flex items-end gap-3">
          <button className="btn">{editing ? "Actualizar" : "Crear"}</button>
          {editing && (
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
              Cancelar
            </button>
          )}
        </div>
        {message && <p className="text-sm text-pink-300">{message}</p>}
      </form>
      <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5">
            <tr>
              <th className="p-4">ID</th>
              {fields.slice(0, 3).map((field) => (
                <th className="p-4" key={field.key}>
                  {field.label}
                </th>
              ))}
              <th className="p-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr className="border-t border-white/10" key={item.id}>
                <td className="p-4">{item.id}</td>
                {fields.slice(0, 3).map((field) => (
                  <td className="max-w-xs truncate p-4" key={field.key}>
                    {String(item[field.key] ?? "—")}
                  </td>
                ))}
                <td className="p-4">
                  <button className="text-pink-300" onClick={() => setEditing(item)}>
                    Editar
                  </button>
                  <button className="ml-4 text-red-300" onClick={() => remove(item.id)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
