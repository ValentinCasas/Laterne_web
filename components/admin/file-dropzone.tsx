"use client";

import { createElement, useEffect, useRef, useState } from "react";
import { scopedFetch } from "@/lib/client-routing";
import { modelPublicUrl, productImageSrc } from "@/lib/image-fallback";
import { Icon } from "@/components/admin/ui/icons";

/**
 * Zona de carga por arrastre o selección para el editor de productos.
 *
 * Reutiliza el gestor de Archivos existente (`/api/admin/upload`) con los
 * recursos `productos` (imagen) y `product-model` (GLB/GLTF/USDZ), de modo
 * que la validación, optimización, deduplicación y auditoría quedan del lado
 * del servidor. El valor devuelto por `onUploaded` es el que se guarda en el
 * producto (nombre de archivo para imágenes, ruta relativa para modelos).
 */

type FileDropzoneProps = {
  /** Recurso del gestor de Archivos que valida y guarda el archivo. */
  resource: "productos" | "product-model";
  /** Extensiones o tipos aceptados por el selector nativo (p. ej. ".glb,.gltf"). */
  accept: string;
  /** Descripción breve mostrada dentro de la zona. */
  hint: string;
  /** Etiqueta del botón/estado cuando todavía no hay archivo. */
  emptyLabel: string;
  /** Valor actual guardado (nombre de archivo o ruta relativa). */
  value: string;
  /** Recibe el valor guardado una vez que el servidor aceptó el archivo. */
  onUploaded: (storedValue: string) => void;
  /** Elimina la referencia actual del borrador. */
  onCleared: () => void;
  /** Modo de vista previa: imagen, modelo 3D o solo nombre de archivo. */
  preview?: "image" | "model" | "file";
  /** Nombre del archivo a mostrar cuando hay uno cargado. */
  displayName?: string;
};

/** @summary Convierte una ruta relativa de modelo en su URL pública para el visor. */
function previewUrl(preview: FileDropzoneProps["preview"], value: string): string {
  if (preview === "image") return productImageSrc(value);
  return modelPublicUrl(value);
}

/** @summary Zona de carga por arrastre o selección con vista previa y estados claros. */
export function FileDropzone({
  resource,
  accept,
  hint,
  emptyLabel,
  value,
  onUploaded,
  onCleared,
  preview = "file",
  displayName,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  /** @summary Sube el archivo elegido y notifica el valor guardado al editor. */
  async function uploadFile(file: File) {
    setError("");
    setUploading(true);
    try {
      const form = new FormData();
      form.set("resource", resource);
      form.set("file", file);
      const response = await scopedFetch("/api/admin/upload", { method: "POST", body: form });
      const body = (await response.json().catch(() => ({}))) as {
        filename?: string;
        url?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "No se pudo cargar el archivo");
      // Las imágenes se guardan por nombre de archivo; los modelos conservan su ruta aislada.
      onUploaded(resource === "productos" ? String(body.filename ?? "") : String(body.url ?? ""));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ocurrió un error al cargar el archivo.");
    } finally {
      setUploading(false);
    }
  }

  const hasValue = Boolean(value && value.trim());

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadFile(file);
          event.target.value = "";
        }}
        aria-hidden
        tabIndex={-1}
      />
      {hasValue && (
        <div className="mb-3 flex items-center gap-3">
          {preview === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl("image", value)}
              alt="Vista previa"
              className="h-20 w-20 shrink-0 rounded-xl border border-[var(--admin-border)] object-cover"
            />
          )}
          {preview === "model" && value.trim() && <EditorModelPreview modelUrl={previewUrl("model", value)} />}
          {preview === "file" && (
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-[var(--admin-border)] bg-white/5">
              <Icon name="file" className="h-6 w-6 text-zinc-500" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-zinc-200">
              {displayName ?? (preview === "image" ? "Imagen cargada" : "Archivo cargado")}
            </p>
            <p className="mt-0.5 truncate text-xs text-[var(--admin-muted)]">{value}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="rounded-lg border border-[var(--admin-border)] bg-white/5 px-2.5 py-1 text-xs font-bold hover:bg-white/10"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                Reemplazar
              </button>
              <button
                type="button"
                className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-300 hover:bg-red-500/20"
                onClick={onCleared}
                disabled={uploading}
              >
                Quitar
              </button>
            </div>
          </div>
        </div>
      )}
      {!hasValue && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) void uploadFile(file);
          }}
          className={`grid w-full place-items-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
            dragging
              ? "border-pink-500 bg-pink-500/10"
              : "border-[var(--admin-border)] bg-white/[.03] hover:border-pink-500/40 hover:bg-white/5"
          }`}
        >
          <Icon name={resource === "product-model" ? "cube" : "image"} className="mx-auto h-8 w-8 text-zinc-500" />
          <span className="mt-2 block text-sm font-bold text-zinc-200">
            {uploading ? "Subiendo…" : emptyLabel}
          </span>
          <span className="mt-1 block text-xs text-[var(--admin-muted)]">{hint}</span>
        </button>
      )}
      {error && <p className="mt-2 text-xs font-semibold text-red-400">{error}</p>}
    </div>
  );
}

/**
 * @summary Vista previa 3D compacta para el editor, cargada bajo demanda.
 *
 * Reutiliza `@google/model-viewer`, el mismo visor del detalle público del
 * producto: el modelo solo se descarga al montarse la vista previa, nunca en
 * los listados. Se construye el elemento nativo con React puro para no
 * duplicar el componente de experiencia completo.
 */
export function EditorModelPreview({ modelUrl }: { modelUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("@google/model-viewer")
      .then(async () => {
        await customElements.whenDefined("model-viewer");
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div ref={containerRef} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[var(--admin-border)] bg-zinc-900">
      {ready && !failed ? (
        <ModelViewerCanvas
          src={modelUrl}
          alt="Vista previa 3D"
          style={{ width: "100%", height: "100%" }}
          cameraControls
          autoRotate
          interactionPrompt="none"
          shadowIntensity="1"
          shadowSoftness="0.6"
          exposure="1"
        />
      ) : (
        <div className="grid h-full w-full place-items-center"><Icon name={failed ? "alert-triangle" : "loader"} className="h-8 w-8 text-zinc-400" /></div>
      )}
    </div>
  );
}

/** @summary Adapta el elemento web de Google para declarar props con nombres React. */
function ModelViewerCanvas(props: Record<string, unknown>) {
  return createElement("model-viewer", props);
}
