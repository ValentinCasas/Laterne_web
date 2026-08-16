"use client";

import Image from "next/image";
import { useState } from "react";
import { AssetPicker } from "@/components/admin/asset-picker";
import { ImagePicker } from "@/components/admin/image-picker";
import { LocationPicker } from "@/components/admin/location-picker";
import { useDragToScroll } from "@/components/use-carousel-drag";
import { DEFAULT_IMAGE_PLACEHOLDERS, handleImageError } from "@/lib/image-fallback";

export type ResourceOption = { value: string; label: string; image?: string; disabled?: boolean };
export type ResourceField = {
  key: string;
  label: string;
  type?: string;
  min?: number;
  max?: number;
  step?: number | string;
  required?: boolean;
  group?: string;
  control?:
    "input" | "textarea" | "select" | "choice" | "multichoice" | "image" | "asset" | "location" | "checkbox";
  placeholder?: string;
  help?: string;
  options?: ResourceOption[];
  imageFolder?: string;
  fallbackImage?: string;
  accept?: string;
  previewModel?: boolean;
  defaultChecked?: boolean;
  defaultValue?: string;
  /** @summary Muestra el campo solo cuando otro campo (select) toma el valor indicado. */
  showWhen?: Array<{ key: string; value: string }>;
};

export type ResourceItem = Record<string, unknown> & { id: number };

const imageFolders: Record<string, string> = {
  productos: "images_product",
  categorias: "images_categories",
  eventos: "images_event",
  usuarios: "images_profile",
  promociones: "images_promotions",
};

/** @summary Adapta fechas, horarios y valores nulos para utilizarlos en controles HTML. */
export function inputValue(value: unknown, type?: string) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (type === "date") return text.slice(0, 10);
  if (type === "time") return text.includes("T") ? text.slice(11, 16) : text.slice(0, 5);
  if (type === "datetime-local") return text.includes("T") ? text.slice(0, 16) : text;
  return text;
}

/** @summary Obtiene la dirección pública de la imagen principal de un registro. */
export function itemImage(resource: string, item: ResourceItem) {
  const filename = String(item.imageUrl ?? "").trim();
  if (!filename || DEFAULT_IMAGE_PLACEHOLDERS.has(filename)) return "";
  const folder = imageFolders[resource];
  return folder ? `/images/${folder}/${filename}` : "";
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
                  onError={handleImageError}
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

/** @summary Permite relacionar varios productos o categorías mediante una lista buscable. */
function MultiChoiceField({ field, initialValue }: { field: ResourceField; initialValue: string }) {
  const [selected, setSelected] = useState(
    () =>
      new Set(
        initialValue
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      ),
  );
  const [query, setQuery] = useState("");
  const visibleOptions = field.options?.filter((option) =>
    option.label.toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es")),
  );

  /** @summary Agrega o quita una relación del conjunto que se enviará con el formulario. */
  function toggle(value: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  return (
    <fieldset className="min-w-0 rounded-2xl border border-white/10 p-4 md:col-span-2">
      <legend className="px-2 text-sm font-bold text-zinc-200">{field.label}</legend>
      <input name={field.key} type="hidden" value={[...selected].join(",")} />
      <label className="mt-2 block">
        <span className="sr-only">Buscar dentro de {field.label}</span>
        <input
          className="input py-2 text-sm"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Buscar en ${field.label.toLocaleLowerCase("es")}…`}
        />
      </label>
      <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
        {visibleOptions?.map((option) => {
          const checked = selected.has(option.value);
          return (
            <button
              className={`flex items-center gap-3 rounded-xl border p-3 text-left text-sm transition ${
                checked
                  ? "border-pink-400 bg-pink-500/10 text-white"
                  : "border-white/10 text-zinc-400 hover:border-white/25"
              }`}
              key={option.value}
              onClick={() => toggle(option.value)}
              type="button"
              aria-pressed={checked}
            >
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-md text-xs ${checked ? "bg-pink-500" : "bg-white/5"}`}
              >
                {checked ? "✓" : ""}
              </span>
              <span className="line-clamp-2">{option.label}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-zinc-600">{selected.size} seleccionados</p>
    </fieldset>
  );
}

/** @summary Determina si un campo debe mostrarse según el estado actual de los campos que condicionan su aparición. */
export function fieldVisible(
  field: ResourceField,
  item: ResourceItem | null,
  watchValues: Record<string, string>,
) {
  if (!field.showWhen?.length) return true;
  return field.showWhen.every((condition) => {
    const actual = String(watchValues[condition.key] ?? item?.[condition.key] ?? "").trim();
    return actual.toLocaleLowerCase("es") === condition.value;
  });
}

/** @summary Renderiza un campo con el control más apropiado para su tipo de contenido. */
export function FormField({
  field,
  item,
  isWatchedSelect = false,
  watchValues,
  onWatchChange,
}: {
  field: ResourceField;
  item: ResourceItem | null;
  isWatchedSelect?: boolean;
  watchValues?: Record<string, string>;
  onWatchChange?: (key: string, value: string) => void;
}) {
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

  if (field.control === "multichoice") {
    return <MultiChoiceField key={`${item?.id ?? "new"}-${field.key}`} field={field} initialValue={value} />;
  }

  if (field.control === "asset") {
    return (
      <AssetPicker
        key={`${item?.id ?? "new"}-${field.key}`}
        name={field.key}
        label={field.label}
        value={value}
        accept={field.accept ?? ""}
        help={field.help}
        previewModel={field.previewModel}
      />
    );
  }

  if (field.control === "checkbox") {
    const checked = item
      ? item[field.key] === true || item[field.key] === "true" || item[field.key] === 1
      : Boolean(field.defaultChecked);
    return (
      <label className="flex min-h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] px-4 py-3 hover:border-pink-500/40">
        <input name={field.key} type="hidden" value="false" />
        <input
          className="h-5 w-5 accent-pink-500"
          name={field.key}
          type="checkbox"
          value="true"
          defaultChecked={checked}
          key={`${item?.id ?? "new"}-${field.key}`}
        />
        <span className="text-sm font-bold text-zinc-200">{field.label}</span>
      </label>
    );
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
    const initial = value || field.defaultValue || "";
    return (
      <label>
        {label}
        <select
          className="input mt-2 appearance-none"
          name={field.key}
          required={field.required}
          key={`${item?.id ?? "new"}-${field.key}`}
          {...(isWatchedSelect
            ? {
                value: watchValues?.[field.key] ?? initial,
                onChange: (event) => onWatchChange?.(field.key, event.target.value),
              }
            : { defaultValue: initial })}
        >
          {!field.required && <option value="">Sin especificar</option>}
          {field.options?.map((option) => (
            <option value={option.value} key={option.value} disabled={option.disabled}>
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
        min={field.min}
        max={field.max}
        step={field.step}
        required={field.required}
        placeholder={field.placeholder}
        defaultValue={value}
        key={`${item?.id ?? "new"}-${field.key}`}
      />
    </label>
  );
}
