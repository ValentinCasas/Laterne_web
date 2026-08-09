"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { useDragToScroll } from "@/components/use-carousel-drag";

type ImageOption = { filename: string; url: string };

/** @summary Permite elegir una imagen existente o cargar un archivo con vista previa inmediata. */
export function ImagePicker({
  name,
  label,
  value,
  options,
  required,
  imageFolder,
  fallbackImage,
  allowEmpty,
}: {
  name: string;
  label: string;
  value: string;
  options: ImageOption[];
  required?: boolean;
  imageFolder?: string;
  fallbackImage?: string;
  allowEmpty?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const {
    ref: gallery,
    isDragging: isDraggingGallery,
    dragProps: galleryDragProps,
  } = useDragToScroll<HTMLDivElement>();
  const initialFilename = value.split("/").pop() ?? value;
  const initialOption = options.find(
    (option) => option.filename.toLocaleLowerCase("es") === initialFilename.toLocaleLowerCase("es"),
  );
  const [selected, setSelected] = useState(initialOption?.filename ?? initialFilename);
  const [preview, setPreview] = useState(
    () =>
      initialOption?.url ??
      (value && imageFolder ? `/images/${imageFolder}/${initialFilename}` : (fallbackImage ?? "")),
  );
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    return () => {
      if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  /** @summary Actualiza la vista previa y conserva el archivo para enviarlo con el formulario. */
  function selectFile(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setSelected("");
    setPreview(URL.createObjectURL(file));
  }

  /** @summary Incorpora al input la imagen que el usuario soltó sobre el área de carga. */
  function dropFile(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (!file || !input.current) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.current.files = transfer.files;
    selectFile(file);
  }

  /** @summary Selecciona una imagen ya disponible y elimina cualquier archivo pendiente. */
  function selectExisting(option: ImageOption) {
    if (input.current) input.current.value = "";
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setSelected(option.filename);
    setPreview(option.url);
  }

  return (
    <fieldset className="min-w-0 md:col-span-2">
      <legend className="text-sm font-bold text-zinc-200">{label}</legend>
      <input name={name} type="hidden" value={selected} />

      <div className="mt-3 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <label
          className={`group relative grid min-h-52 cursor-pointer place-items-center overflow-hidden rounded-3xl border border-dashed p-4 text-center transition ${
            dragging
              ? "border-pink-400 bg-pink-500/15"
              : "border-white/20 bg-white/[.03] hover:border-pink-500/60 hover:bg-pink-500/5"
          }`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={dropFile}
        >
          {preview ? (
            <>
              <Image
                src={preview}
                alt="Vista previa de la imagen seleccionada"
                fill
                sizes="220px"
                className="object-contain p-3"
                unoptimized={preview.startsWith("blob:")}
                onError={(event) => {
                  if (fallbackImage && !event.currentTarget.dataset.fallback) {
                    event.currentTarget.dataset.fallback = "true";
                    event.currentTarget.src = fallbackImage;
                  }
                }}
              />
              <span className="absolute inset-x-3 bottom-3 rounded-xl bg-black/75 px-3 py-2 text-xs font-bold backdrop-blur">
                Cambiar imagen
              </span>
            </>
          ) : (
            <span>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-pink-500/15 text-2xl text-pink-300">
                +
              </span>
              <strong className="mt-3 block sm:hidden">Tocá para elegir</strong>
              <strong className="mt-3 hidden sm:block">Elegir o arrastrar</strong>
              <small className="mt-1 block text-zinc-500">JPG, PNG, WebP, AVIF o GIF · Máximo 5 MB</small>
            </span>
          )}
          <input
            ref={input}
            className="sr-only"
            name={`${name}File`}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            required={required && !selected && !allowEmpty}
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
        </label>

        <div className="min-w-0 max-w-full overflow-hidden">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Galería disponible</p>
            <span className="text-xs text-zinc-600">
              <span className="sm:hidden">Deslizá para recorrer</span>
              <span className="hidden sm:inline">Arrastrá para recorrer</span>
            </span>
          </div>
          <div
            ref={gallery}
            {...galleryDragProps}
            className={`mt-3 flex w-full max-w-full gap-3 overflow-x-auto pb-3 select-none [scrollbar-color:#ec4899_#27272a] ${
              isDraggingGallery
                ? "cursor-grabbing snap-none"
                : "cursor-grab snap-x snap-mandatory scroll-smooth"
            }`}
          >
            {options.map((option) => (
              <button
                className={`relative h-28 min-w-28 snap-start overflow-hidden rounded-2xl border bg-zinc-900 transition hover:-translate-y-1 ${
                  selected === option.filename
                    ? "border-pink-400 ring-2 ring-pink-500/30"
                    : "border-white/10 hover:border-white/30"
                }`}
                key={option.filename}
                onClick={() => selectExisting(option)}
                type="button"
                title={option.filename}
              >
                <Image
                  src={option.url}
                  alt={option.filename}
                  fill
                  sizes="112px"
                  className="object-contain p-2"
                />
                {selected === option.filename && (
                  <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-pink-500 text-xs">
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </fieldset>
  );
}
