"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import Swal from "sweetalert2";
import { ImagePicker } from "@/components/admin/image-picker";
import { LocationPicker } from "@/components/admin/location-picker";
import { useDragToScroll } from "@/components/use-carousel-drag";

export type ResourceOption = { value: string; label: string; image?: string };
export type ResourceField = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  control?: "input" | "textarea" | "select" | "choice" | "image" | "location";
  placeholder?: string;
  help?: string;
  options?: ResourceOption[];
  imageFolder?: string;
  fallbackImage?: string;
};

type Item = Record<string, unknown> & { id: number };

const imageFolders: Record<string, string> = {
  productos: "images_product",
  categorias: "images_categories",
  eventos: "images_event",
  usuarios: "images_profile",
};

/** @summary Adapta fechas, horarios y valores nulos para utilizarlos en controles HTML. */
function inputValue(value: unknown, type?: string) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (type === "date") return text.slice(0, 10);
  if (type === "time") return text.includes("T") ? text.slice(11, 16) : text.slice(0, 5);
  return text;
}

/** @summary Obtiene la dirección pública de la imagen principal de un registro. */
function itemImage(resource: string, item: Item) {
  const filename = String(item.imageUrl ?? "").trim();
  const folder = imageFolders[resource];
  return filename && folder ? `/images/${folder}/${filename}` : "";
}

/** @summary Muestra una selección visual para opciones que incluyen nombre e imagen. */
function ChoiceField({ field, initialValue }: { field: ResourceField; initialValue: string }) {
  const { ref, isDragging, dragProps } = useDragToScroll<HTMLDivElement>();
  const [selected, setSelected] = useState(initialValue);

  return (
    <fieldset className="min-w-0 md:col-span-2">
      <legend className="text-sm font-bold text-zinc-200">{field.label}</legend>
      <input name={field.key} type="hidden" value={selected} />
      <div
        ref={ref}
        {...dragProps}
        className={`mt-3 flex w-full max-w-full gap-3 overflow-x-auto pb-3 select-none [scrollbar-color:#ec4899_#27272a] ${
          isDragging ? "cursor-grabbing snap-none" : "cursor-grab snap-x snap-mandatory scroll-smooth"
        }`}
      >
        {field.options?.map((option) => (
          <button
            className={`relative min-w-40 snap-start overflow-hidden rounded-2xl border p-3 text-left transition ${
              selected === option.value
                ? "border-pink-400 bg-pink-500/10 ring-2 ring-pink-500/20"
                : "border-white/10 bg-white/[.03] hover:border-white/25"
            }`}
            key={option.value}
            onClick={() => setSelected(option.value)}
            type="button"
          >
            {option.image && (
              <span className="relative mb-3 block h-24 overflow-hidden rounded-xl bg-zinc-900">
                <Image
                  src={option.image}
                  alt=""
                  fill
                  sizes="160px"
                  className="pointer-events-none object-contain p-2"
                  draggable={false}
                />
              </span>
            )}
            <strong className="block truncate text-sm">{option.label}</strong>
            {selected === option.value && (
              <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-pink-500 text-xs">
                ✓
              </span>
            )}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** @summary Renderiza un campo con el control más apropiado para su tipo de contenido. */
function FormField({ field, item }: { field: ResourceField; item: Item | null }) {
  const value = inputValue(item?.[field.key], field.type);

  if (field.control === "location") {
    return (
      <LocationPicker
        key={`${item?.id ?? "new"}-location`}
        initialLatitude={inputValue(item?.latitude)}
        initialLongitude={inputValue(item?.longitude)}
      />
    );
  }

  if (field.control === "image") {
    const options = (field.options ?? []).map((option) => ({
      filename: option.value,
      url: option.image ?? "",
    }));
    return (
      <ImagePicker
        key={`${item?.id ?? "new"}-${field.key}`}
        name={field.key}
        label={field.label}
        value={value}
        options={options}
        required={field.required}
        imageFolder={field.imageFolder}
        fallbackImage={field.fallbackImage}
        allowEmpty={Boolean(item)}
      />
    );
  }

  if (field.control === "choice") {
    return <ChoiceField key={`${item?.id ?? "new"}-${field.key}`} field={field} initialValue={value} />;
  }

  const label = (
    <span className="flex items-center justify-between gap-3 text-sm font-bold text-zinc-200">
      {field.label}
      {field.help && <small className="font-normal text-zinc-600">{field.help}</small>}
    </span>
  );

  if (field.control === "textarea") {
    return (
      <label className="md:col-span-2">
        {label}
        <textarea
          className="input mt-2 min-h-28 resize-y"
          name={field.key}
          required={field.required}
          placeholder={field.placeholder}
          defaultValue={value}
          key={`${item?.id ?? "new"}-${field.key}`}
        />
      </label>
    );
  }

  if (field.control === "select") {
    return (
      <label>
        {label}
        <select
          className="input mt-2 appearance-none"
          name={field.key}
          required={field.required}
          defaultValue={value}
          key={`${item?.id ?? "new"}-${field.key}`}
        >
          {!field.required && <option value="">Sin especificar</option>}
          {field.options?.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label>
      {label}
      <input
        className="input mt-2"
        name={field.key}
        type={field.type ?? "text"}
        required={field.required}
        placeholder={field.placeholder}
        defaultValue={value}
        key={`${item?.id ?? "new"}-${field.key}`}
      />
    </label>
  );
}

/** @summary Administra visualmente la creación, edición y eliminación de un tipo de contenido. */
export function ResourceManager({
  title,
  description,
  resource,
  initialItems,
  fields,
  singular,
}: {
  title: string;
  description: string;
  resource: string;
  initialItems: Item[];
  fields: ResourceField[];
  singular?: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState<Item | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const formPanel = useRef<HTMLDivElement>(null);
  const {
    ref: collection,
    isDragging: isDraggingCollection,
    dragProps: collectionDragProps,
  } = useDragToScroll<HTMLDivElement>();

  /** @summary Abre el formulario vacío o carga en él los datos de un registro existente. */
  function openForm(item: Item | null) {
    setEditing(item);
    setFormOpen(true);
    window.requestAnimationFrame(() =>
      formPanel.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  /** @summary Cierra el editor y descarta la selección del registro actual. */
  function closeForm() {
    setEditing(null);
    setFormOpen(false);
  }

  /** @summary Carga una imagen nueva cuando corresponde y devuelve su nombre público. */
  async function uploadImage(field: ResourceField, formData: FormData) {
    const file = formData.get(`${field.key}File`);
    if (!(file instanceof File) || !file.size) return String(formData.get(field.key) ?? "");

    const upload = new FormData();
    upload.set("resource", resource);
    upload.set("file", file);
    const response = await fetch("/api/admin/upload", { method: "POST", body: upload });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "No se pudo cargar la imagen");
    return String(body.filename);
  }

  /** @summary Crea o actualiza un registro y refleja el resultado en la colección visible. */
  async function save(formData: FormData) {
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      for (const field of fields) {
        if (field.control === "location") {
          payload.latitude = String(formData.get("latitude") ?? "");
          payload.longitude = String(formData.get("longitude") ?? "");
          continue;
        }
        payload[field.key] =
          field.control === "image"
            ? await uploadImage(field, formData)
            : String(formData.get(field.key) ?? "");
      }

      const id = editing?.id;
      const response = await fetch(`/api/admin/${resource}${id ? `/${id}` : ""}`, {
        method: id ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "No se pudo guardar el registro");

      const nextItem = { ...body.item, ...payload, id: body.item.id } as Item;
      setItems((current) =>
        id ? current.map((item) => (item.id === id ? nextItem : item)) : [...current, nextItem],
      );
      closeForm();
      await Swal.fire({
        title: id ? "Cambios guardados" : "Contenido creado",
        text: id ? "El registro se actualizó correctamente." : "El nuevo registro ya está disponible.",
        icon: "success",
        confirmButtonColor: "#ec4899",
        background: "#18181b",
        color: "#fafafa",
      });
    } catch (error) {
      await Swal.fire({
        title: "No pudimos guardar",
        text: error instanceof Error ? error.message : "Ocurrió un error inesperado.",
        icon: "error",
        confirmButtonColor: "#ec4899",
        background: "#18181b",
        color: "#fafafa",
      });
    } finally {
      setSaving(false);
    }
  }

  /** @summary Solicita confirmación con SweetAlert2 y elimina el registro seleccionado. */
  async function remove(item: Item) {
    const confirmation = await Swal.fire({
      title: "¿Eliminar este contenido?",
      text: `Vas a eliminar “${String(item.name ?? item.description ?? `registro ${item.id}`)}”.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
      reverseButtons: true,
    });
    if (!confirmation.isConfirmed) return;

    const response = await fetch(`/api/admin/${resource}/${item.id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return Swal.fire({
        title: "No se pudo eliminar",
        text: body.error ?? "Revisá si el contenido está siendo utilizado por otro registro.",
        icon: "error",
        confirmButtonColor: "#ec4899",
        background: "#18181b",
        color: "#fafafa",
      });
    }
    setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
    await Swal.fire({
      title: "Contenido eliminado",
      icon: "success",
      timer: 1400,
      showConfirmButton: false,
      background: "#18181b",
      color: "#fafafa",
    });
  }

  const horizontal = resource === "categorias";

  return (
    <section>
      <header className="flex flex-wrap items-end justify-between gap-5 rounded-[2rem] border border-white/10 bg-zinc-950/70 p-6 sm:p-8">
        <div className="max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[.28em] text-pink-400">Administración</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-3 leading-relaxed text-zinc-500">{description}</p>
        </div>
        <button className="btn" onClick={() => openForm(singular ? (items[0] ?? null) : null)} type="button">
          {singular && items.length ? "Editar información" : `+ Crear ${title.toLowerCase()}`}
        </button>
      </header>

      {formOpen && (
        <div className="scroll-mt-24" ref={formPanel}>
          <form
            action={save}
            className="mt-6 grid min-w-0 gap-5 overflow-hidden rounded-[2rem] border border-pink-500/25 bg-gradient-to-br from-pink-950/25 to-zinc-950 p-5 shadow-2xl shadow-black/30 md:grid-cols-2 sm:p-8"
          >
            <div className="flex items-start justify-between gap-4 md:col-span-2">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-pink-300">
                  {editing ? "Editando contenido" : "Nuevo contenido"}
                </p>
                <h2 className="mt-1 text-2xl font-black">{editing ? `Registro #${editing.id}` : title}</h2>
              </div>
              <button
                className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-xl hover:bg-white/10"
                onClick={closeForm}
                type="button"
                aria-label="Cerrar formulario"
              >
                ×
              </button>
            </div>

            {fields.map((field) => (
              <FormField field={field} item={editing} key={field.key} />
            ))}

            <div className="flex flex-wrap gap-3 border-t border-white/10 pt-5 md:col-span-2">
              <button className="btn min-w-40 disabled:cursor-wait disabled:opacity-60" disabled={saving}>
                {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear contenido"}
              </button>
              <button className="btn btn-secondary" onClick={closeForm} type="button">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-4 px-1">
        <h2 className="text-lg font-black">Contenido cargado</h2>
        <span className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-400">
          {items.length} {items.length === 1 ? "registro" : "registros"}
        </span>
      </div>

      <div
        ref={horizontal ? collection : undefined}
        {...(horizontal ? collectionDragProps : {})}
        className={`mt-4 ${
          horizontal
            ? `flex w-full max-w-full gap-4 overflow-x-auto pb-4 select-none [scrollbar-color:#ec4899_#27272a] ${isDraggingCollection ? "cursor-grabbing snap-none" : "cursor-grab snap-x snap-mandatory scroll-smooth"}`
            : "grid gap-4 sm:grid-cols-2 2xl:grid-cols-3"
        }`}
      >
        {items.map((item) => {
          const image = itemImage(resource, item);
          const titleValue = String(
            item.name ?? item.dayOfWeek ?? item.email ?? item.address ?? `Registro #${item.id}`,
          );
          const descriptionValue = String(item.description ?? item.location ?? "");
          return (
            <article
              className={`group overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/80 shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:border-white/20 ${
                horizontal ? "min-w-72 snap-start" : "min-w-0"
              }`}
              key={item.id}
            >
              {image ? (
                <div className="relative h-44 bg-gradient-to-br from-zinc-800 to-zinc-950">
                  <Image
                    src={image}
                    alt={titleValue}
                    fill
                    sizes="(max-width: 640px) 100vw, 320px"
                    className="pointer-events-none object-contain p-4 transition duration-500 group-hover:scale-105"
                    draggable={false}
                  />
                </div>
              ) : (
                <div className="flex h-20 items-center justify-between bg-gradient-to-r from-pink-500/15 to-transparent px-5">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-pink-500/15 text-sm font-black text-pink-300">
                    {titleValue.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="text-xs text-zinc-600">#{item.id}</span>
                </div>
              )}

              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 truncate text-lg font-black">{titleValue}</h3>
                  {resource === "testimonios" && (
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                        item.state === true || item.state === "true"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-amber-500/15 text-amber-300"
                      }`}
                    >
                      {item.state === true || item.state === "true" ? "Aprobado" : "Pendiente"}
                    </span>
                  )}
                </div>
                {descriptionValue && (
                  <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-relaxed text-zinc-500">
                    {descriptionValue}
                  </p>
                )}
                {resource === "productos" && (
                  <strong className="mt-3 block text-pink-300">
                    ${Number(item.price ?? 0).toLocaleString("es-AR")}
                  </strong>
                )}

                <div className="mt-5 flex gap-2 border-t border-white/10 pt-4">
                  <button
                    className="flex-1 rounded-xl bg-white/5 px-3 py-2.5 text-sm font-bold hover:bg-pink-500 hover:text-white"
                    onClick={() => openForm(item)}
                    type="button"
                  >
                    Editar
                  </button>
                  {!singular && (
                    <button
                      className="rounded-xl bg-red-500/10 px-3 py-2.5 text-sm font-bold text-red-300 hover:bg-red-500 hover:text-white"
                      onClick={() => remove(item)}
                      type="button"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}

        {!items.length && (
          <div className="col-span-full rounded-3xl border border-dashed border-white/15 p-12 text-center">
            <span className="text-4xl">＋</span>
            <h3 className="mt-3 text-xl font-black">Todavía no hay contenido</h3>
            <p className="mt-2 text-sm text-zinc-500">Usá el botón superior para crear el primer registro.</p>
          </div>
        )}
      </div>
    </section>
  );
}
