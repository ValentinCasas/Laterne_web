"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import {
  FormField,
  fieldVisible,
  inputValue,
  itemImage,
  type ResourceField,
  type ResourceItem,
} from "@/components/resource-form";
import { useDragToScroll } from "@/components/use-carousel-drag";
import { scopedFetch } from "@/lib/client-routing";
import { Icon } from "@/components/admin/ui/icons";
import { handleImageError } from "@/lib/image-fallback";
import {
  readBrowserJson,
  readBrowserText,
  removeBrowserText,
  writeBrowserJson,
  writeBrowserText,
} from "@/lib/browser-compat";
import { PageHeader, SearchBox } from "@/components/admin/ui";

export type { ResourceField, ResourceOption } from "@/components/resource-form";

/** @summary Administra visualmente la creación, edición y eliminación de un tipo de contenido. */
export function ResourceManager({
  title,
  description,
  resource,
  initialItems,
  fields,
  singular,
  currency = "ARS",
  locale = "es-AR",
}: {
  title: string;
  description: string;
  resource: string;
  initialItems: ResourceItem[];
  fields: ResourceField[];
  singular?: boolean;
  currency?: string;
  locale?: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState<ResourceItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftItem, setDraftItem] = useState<ResourceItem | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "name" | "oldest">("recent");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const formPanel = useRef<HTMLDivElement>(null);
  const horizontal = resource === "categorias";
  const watchedKeys = useMemo(
    () => new Set(fields.flatMap((field) => field.showWhen?.map((condition) => condition.key) ?? [])),
    [fields],
  );
  const [watchValues, setWatchValues] = useState<Record<string, string>>({});
  const onWatchChange = useCallback((key: string, nextValue: string) => {
    setWatchValues((current) => ({ ...current, [key]: nextValue }));
  }, []);
  const {
    ref: collection,
    isDragging: isDraggingCollection,
    dragProps: collectionDragProps,
  } = useDragToScroll<HTMLDivElement>();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(readBrowserText(`laterne_admin_filter_${resource}`) ?? "");
      const stored = readBrowserJson<number[]>(`laterne_admin_favorites_${resource}`, []);
      setFavoriteIds(new Set(Array.isArray(stored) ? stored : []));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [resource]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return [...items]
      .filter(
        (item) =>
          !normalized ||
          Object.values(item).some((value) =>
            String(value ?? "")
              .toLocaleLowerCase("es")
              .includes(normalized),
          ),
      )
      .sort((first, second) => {
        if (favoriteIds.has(first.id) !== favoriteIds.has(second.id))
          return favoriteIds.has(first.id) ? -1 : 1;
        const firstName = String(first.name ?? first.businessName ?? first.title ?? first.description ?? "");
        const secondName = String(
          second.name ?? second.businessName ?? second.title ?? second.description ?? "",
        );
        if (sort === "name") return firstName.localeCompare(secondName, "es");
        return sort === "oldest" ? first.id - second.id : second.id - first.id;
      });
  }, [favoriteIds, items, query, sort]);
  const pageSize = horizontal ? 30 : 12;
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const effectivePage = Math.min(page, totalPages);
  const visibleItems = filteredItems.slice((effectivePage - 1) * pageSize, effectivePage * pageSize);

  useEffect(() => {
    writeBrowserText(`laterne_admin_filter_${resource}`, query);
  }, [query, resource]);

  /** @summary Abre el formulario vacío o carga en él los datos de un registro existente. */
  function openForm(item: ResourceItem | null) {
    setEditing(item);
    if (!item) {
      const stored = readBrowserJson<Record<string, unknown> | null>(`laterne_admin_draft_${resource}`, null);
      setDraftItem(stored ? ({ id: 0, ...stored } as ResourceItem) : null);
    } else setDraftItem(null);
    const watchedSource =
      item ?? readBrowserJson<Record<string, unknown> | null>(`laterne_admin_draft_${resource}`, null);
    const initialValues: Record<string, string> = {};
    if (watchedSource) {
      for (const key of watchedKeys) initialValues[key] = inputValue(watchedSource[key], "");
    }
    setWatchValues(initialValues);
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

  /** @summary Conserva localmente un borrador legible mientras el usuario completa un registro nuevo. */
  function autosaveDraft(form: HTMLFormElement) {
    if (editing) return;
    const draft: Record<string, string> = {};
    for (const [key, value] of new FormData(form).entries()) {
      if (typeof value === "string") draft[key] = value;
    }
    writeBrowserJson(`laterne_admin_draft_${resource}`, draft);
  }

  /** @summary Carga una imagen nueva cuando corresponde y devuelve su nombre público. */
  async function uploadImage(field: ResourceField, formData: FormData) {
    const file = formData.get(`${field.key}File`);
    if (!(file instanceof File) || !file.size) return String(formData.get(field.key) ?? "");

    const upload = new FormData();
    upload.set("resource", resource);
    upload.set("file", file);
    const response = await scopedFetch("/api/admin/upload", { method: "POST", body: upload });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "No se pudo cargar la imagen");
    return String(body.filename);
  }

  /** @summary Carga un modelo 3D validado y devuelve la URL aislada asignada por el servidor. */
  async function uploadAsset(field: ResourceField, formData: FormData) {
    const file = formData.get(`${field.key}File`);
    if (!(file instanceof File) || !file.size) return String(formData.get(field.key) ?? "");

    const upload = new FormData();
    upload.set("resource", "product-model");
    upload.set("file", file);
    const response = await scopedFetch("/api/admin/upload", { method: "POST", body: upload });
    const body = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !body.url) throw new Error(body.error ?? "No se pudo cargar el modelo");
    return body.url;
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
        if (field.control === "image") {
          payload[field.key] = await uploadImage(field, formData);
          continue;
        }
        if (field.control === "asset") {
          payload[field.key] = await uploadAsset(field, formData);
          continue;
        }
        if (field.control === "checkbox") {
          payload[field.key] = formData.getAll(field.key).includes("true") ? "true" : "false";
          continue;
        }
        payload[field.key] = String(formData.get(field.key) ?? "");
      }

      const id = editing?.id;
      const response = await scopedFetch(`/api/admin/${resource}${id ? `/${id}` : ""}`, {
        method: id ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "No se pudo guardar el registro");

      const nextItem = { ...payload, ...body.item, id: body.item.id } as ResourceItem;
      setItems((current) =>
        id ? current.map((item) => (item.id === id ? nextItem : item)) : [...current, nextItem],
      );
      removeBrowserText(`laterne_admin_draft_${resource}`);
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
  async function remove(item: ResourceItem) {
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

    const response = await scopedFetch(`/api/admin/${resource}/${item.id}`, { method: "DELETE" });
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

  /** @summary Duplica contenido reutilizando solo campos editables y genera un nuevo nombre reconocible. */
  async function duplicate(item: ResourceItem) {
    const payload: Record<string, string> = {};
    for (const field of fields) {
      if (field.control === "location") {
        payload.latitude = String(item.latitude ?? "");
        payload.longitude = String(item.longitude ?? "");
      } else if (field.key !== "password") {
        payload[field.key] = inputValue(item[field.key], field.type);
      }
    }
    if ("name" in item) payload.name = `${String(item.name)} · copia`;
    if ("businessName" in item) payload.businessName = `${String(item.businessName)} · copia`;
    if ("title" in item) payload.title = `${String(item.title)} · copia`;
    if ("slug" in payload) payload.slug = "";
    const response = await scopedFetch(`/api/admin/${resource}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => ({}))) as { item?: ResourceItem; error?: string };
    if (!response.ok || !body.item) {
      await Swal.fire({
        title: "No se pudo duplicar",
        text: body.error,
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setItems((current) => [body.item!, ...current]);
  }

  /** @summary Elimina en lote únicamente los registros seleccionados que el servidor autoriza. */
  async function removeSelected() {
    if (!selectedIds.size) return;
    const confirmation = await Swal.fire({
      title: `¿Eliminar ${selectedIds.size} registros?`,
      text: "Se validará cada elemento y se conservarán los que tengan relaciones protegidas.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar seleccionados",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmation.isConfirmed) return;
    const removed = new Set<number>();
    for (const id of selectedIds) {
      const response = await scopedFetch(`/api/admin/${resource}/${id}`, { method: "DELETE" });
      if (response.ok) removed.add(id);
    }
    setItems((current) => current.filter((item) => !removed.has(item.id)));
    setSelectedIds(new Set());
    await Swal.fire({
      title: `${removed.size} registros eliminados`,
      icon: removed.size ? "success" : "info",
      timer: 1500,
      showConfirmButton: false,
      background: "#18181b",
      color: "#fafafa",
    });
  }

  /** @summary Marca un registro como favorito y conserva la elección para futuros accesos al módulo. */
  function toggleFavorite(id: number) {
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeBrowserJson(`laterne_admin_favorites_${resource}`, [...next]);
      return next;
    });
  }

  return (
    <section>
      <PageHeader
        eyebrow="Administración"
        title={title}
        description={description}
        section={resource}
        actions={
          <>
            <SearchBox
              value={query}
              onChange={setQuery}
              placeholder={`Buscar ${title.toLocaleLowerCase("es")}…`}
            />
            <button
              className="btn"
              onClick={() => openForm(singular ? (items[0] ?? null) : null)}
              type="button"
            >
              {singular && items.length ? "Editar información" : `+ Crear ${title.toLocaleLowerCase("es")}`}
            </button>
          </>
        }
      />

      {formOpen && (
        <div className="scroll-mt-24" ref={formPanel}>
          <form
            action={save}
            onInput={(event) => autosaveDraft(event.currentTarget)}
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

            {(() => {
              const renderedGroups = new Set<string>();
              return fields.map((field) => {
                if (field.group && !renderedGroups.has(field.group)) {
                  renderedGroups.add(field.group);
                  const groupedFields = fields.filter(
                    (candidate) =>
                      candidate.group === field.group &&
                      fieldVisible(candidate, editing ?? draftItem, watchValues),
                  );
                  if (!groupedFields.length) return null;
                  return (
                    <details
                      className="group md:col-span-2 rounded-2xl border border-white/10 bg-white/[.02]"
                      key={field.group}
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 select-none [&::-webkit-details-marker]:hidden">
                        <span className="text-sm font-bold text-zinc-200">
                          {field.group}
                          <small className="mt-0.5 block font-normal text-zinc-600">
                            Configuración avanzada · opcional
                          </small>
                        </span>
                        <span className="text-xs text-zinc-500 transition group-open:rotate-180">▾</span>
                      </summary>
                      <div className="grid gap-5 border-t border-white/10 p-4 sm:p-5 md:grid-cols-2">
                        {groupedFields.map((groupedField) => (
                          <FormField
                            field={groupedField}
                            item={editing ?? draftItem}
                            isWatchedSelect={watchedKeys.has(groupedField.key)}
                            watchValues={watchValues}
                            onWatchChange={onWatchChange}
                            key={groupedField.key}
                          />
                        ))}
                      </div>
                    </details>
                  );
                }
                if (!fieldVisible(field, editing ?? draftItem, watchValues)) return null;
                return (
                  <FormField
                    field={field}
                    item={editing ?? draftItem}
                    isWatchedSelect={watchedKeys.has(field.key)}
                    watchValues={watchValues}
                    onWatchChange={onWatchChange}
                    key={field.key}
                  />
                );
              });
            })()}

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

      <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-white/[.02] p-3 lg:grid-cols-[1fr_180px_auto_auto]">
        <input
          className="input py-2"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Buscar en este módulo…"
        />
        <select
          className="input py-2"
          value={sort}
          onChange={(event) => {
            setSort(event.target.value as typeof sort);
            setPage(1);
          }}
        >
          <option value="recent">Más recientes</option>
          <option value="oldest">Más antiguos</option>
          <option value="name">Por nombre</option>
        </select>
        <button
          className="btn btn-secondary py-2"
          type="button"
          onClick={() => setSelectedIds(new Set(visibleItems.map((item) => item.id)))}
        >
          Seleccionar página
        </button>
        <button
          className="rounded-xl border border-red-500/20 px-4 py-2 text-sm font-bold text-red-300 disabled:opacity-30"
          type="button"
          disabled={!selectedIds.size}
          onClick={() => void removeSelected()}
        >
          Eliminar ({selectedIds.size})
        </button>
      </div>

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
        {visibleItems.map((item) => {
          const image = itemImage(resource, item);
          const titleValue = String(
            item.name ?? item.dayOfWeek ?? item.email ?? item.address ?? `Registro #${item.id}`,
          );
          const descriptionValue =
            resource === "usuarios"
              ? `${String(item.roleName ?? "Sin rol")} · ${item.lastAccessAt ? `último acceso ${new Date(String(item.lastAccessAt)).toLocaleString(locale)}` : "sin accesos registrados"}`
              : String(item.description ?? item.location ?? "");
          return (
            <article
              className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/80 shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:border-white/20 ${
                horizontal ? "min-w-72 snap-start" : "min-w-0"
              }`}
              key={item.id}
            >
              <div className="absolute z-10 m-3 flex gap-2">
                <label className="grid h-8 w-8 place-items-center rounded-lg bg-black/80">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={(event) =>
                      setSelectedIds((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(item.id);
                        else next.delete(item.id);
                        return next;
                      })
                    }
                    aria-label={`Seleccionar ${titleValue}`}
                  />
                </label>
                <button
                  className="grid h-8 w-8 place-items-center rounded-lg bg-black/80 text-amber-300"
                  type="button"
                  onClick={() => toggleFavorite(item.id)}
                  aria-label={favoriteIds.has(item.id) ? "Quitar favorito" : "Marcar favorito"}
                >
                  <Icon name={favoriteIds.has(item.id) ? "star-filled" : "star"} className="h-4 w-4" />
                </button>
              </div>
              {image ? (
                <div className="relative h-44 bg-gradient-to-br from-zinc-800 to-zinc-950">
                  <Image
                    src={image}
                    alt={titleValue}
                    fill
                    sizes="(max-width: 640px) 100vw, 320px"
                    className="pointer-events-none object-contain p-4 transition duration-500 group-hover:scale-105"
                    draggable={false}
                    onError={handleImageError}
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
                {resource === "promociones" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-pink-500/15 px-2.5 py-1 text-[10px] font-black uppercase text-pink-300">
                      {String(item.type ?? "promoción").replaceAll("_", " ")}
                    </span>
                    {item.code ? (
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-zinc-300">
                        Código {String(item.code)}
                      </span>
                    ) : null}
                    {Number(item.usageLimit) > 0 ? (
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-black tabular-nums ${
                          Number(item.usedCount ?? 0) >= Number(item.usageLimit)
                            ? "bg-red-500/15 text-red-300"
                            : Number(item.usedCount ?? 0) >= Number(item.usageLimit) * 0.8
                              ? "bg-amber-500/15 text-amber-300"
                              : "bg-emerald-500/15 text-emerald-300"
                        }`}
                      >
                        {String(item.usedCount ?? 0)}/{String(item.usageLimit)} usados
                      </span>
                    ) : null}
                    {(Boolean(item.startAt) || Boolean(item.endAt)) && (
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-black text-zinc-400">
                        {item.startAt ? new Date(String(item.startAt)).toLocaleDateString(locale) : "siempre"}
                        {" → "}
                        {item.endAt
                          ? new Date(String(item.endAt)).toLocaleDateString(locale)
                          : "sin fecha límite"}
                      </span>
                    )}
                  </div>
                )}
                {resource === "productos" && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-pink-300">
                      {new Intl.NumberFormat(locale, {
                        style: "currency",
                        currency,
                        maximumFractionDigits: 0,
                      }).format(Number(item.price ?? 0))}
                    </strong>
                    {item.model3dUrl ? (
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                          item.arEnabled
                            ? "bg-violet-500/15 text-violet-300"
                            : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {item.arEnabled ? "3D y AR activo" : "3D activo · AR desactivado"}
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[10px] font-black uppercase text-zinc-500">
                        Sin modelo 3D
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-5 flex gap-2 border-t border-white/10 pt-4">
                  <button
                    className="flex-1 rounded-xl bg-white/5 px-3 py-2.5 text-sm font-bold hover:bg-pink-500 hover:text-white"
                    onClick={() => openForm(item)}
                    type="button"
                  >
                    Editar
                  </button>
                  {!singular && ["productos", "promociones"].includes(resource) && (
                    <button
                      className="rounded-xl bg-white/5 px-3 py-2.5 text-sm font-bold hover:bg-white/10"
                      onClick={() => void duplicate(item)}
                      type="button"
                    >
                      Duplicar
                    </button>
                  )}
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

        {!visibleItems.length && (
          <div className="col-span-full rounded-3xl border border-dashed border-white/15 p-12 text-center">
            <span className="text-4xl">＋</span>
            <h3 className="mt-3 text-xl font-black">
              {query ? "No encontramos coincidencias" : "Todavía no hay contenido"}
            </h3>
            <p className="mt-2 text-sm text-zinc-500">
              {query
                ? "Probá con otra búsqueda o quitá los filtros."
                : "Usá el botón superior para crear el primer registro."}
            </p>
          </div>
        )}
      </div>
      {totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Paginación">
          <button
            className="btn btn-secondary py-2"
            type="button"
            disabled={effectivePage <= 1}
            onClick={() => setPage(Math.max(1, effectivePage - 1))}
          >
            Anterior
          </button>
          <span className="text-sm text-zinc-500">
            Página {effectivePage} de {totalPages}
          </span>
          <button
            className="btn btn-secondary py-2"
            type="button"
            disabled={effectivePage >= totalPages}
            onClick={() => setPage(Math.min(totalPages, effectivePage + 1))}
          >
            Siguiente
          </button>
        </nav>
      )}
    </section>
  );
}
