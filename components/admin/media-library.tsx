"use client";

import Image from "next/image";
import { useState } from "react";
import Swal from "sweetalert2";
import { PageHeader, SearchBox, ActionMenu, EmptyState } from "@/components/admin/ui";
import { scopedFetch } from "@/lib/client-routing";

export type MediaAssetData = {
  id: number;
  folder: string;
  filename: string;
  url: string;
  thumbnailUrl: string | null;
  mimeType: string;
  sizeBytes: string | number;
  altText: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  user: { name: string } | null;
};

/** @summary Convierte bytes en una unidad breve para inspeccionar el peso de un archivo. */
function fileSize(value: string | number) {
  const bytes = Number(value);
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** @summary Explora archivos por colección, formato y búsqueda, con edición y borrado seguro. */
export function MediaLibrary({ initialAssets }: { initialAssets: MediaAssetData[] }) {
  const [assets, setAssets] = useState(initialAssets);
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const folders = [...new Set(assets.map((asset) => asset.folder))].sort();
  const normalizedQuery = query.trim().toLocaleLowerCase("es");
  const visible = assets.filter(
    (asset) =>
      (folder === "all" || asset.folder === folder) &&
      (!normalizedQuery ||
        `${asset.filename} ${asset.altText ?? ""} ${asset.mimeType}`
          .toLocaleLowerCase("es")
          .includes(normalizedQuery)),
  );

  /** @summary Edita el texto alternativo para mejorar accesibilidad y SEO. */
  async function edit(asset: MediaAssetData) {
    const result = await Swal.fire({
      title: "Texto alternativo",
      input: "text",
      inputValue: asset.altText ?? "",
      inputPlaceholder: "Describí el contenido de la imagen",
      showCancelButton: true,
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
      background: "#18181b",
      color: "#fafafa",
      inputAttributes: { maxlength: "300" },
    });
    if (!result.isConfirmed) return;
    const response = await scopedFetch(`/api/admin/media/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ altText: result.value }),
    });
    const body = (await response.json().catch(() => ({}))) as { asset?: MediaAssetData; error?: string };
    if (!response.ok || !body.asset) {
      await Swal.fire({
        title: "No se pudo guardar",
        text: body.error ?? "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setAssets((current) => current.map((item) => (item.id === asset.id ? body.asset! : item)));
  }

  /** @summary Crea una variante recortada no destructiva con una proporción elegida por el administrador. */
  async function crop(asset: MediaAssetData) {
    const selection = await Swal.fire({
      title: "Crear variante recortada",
      text: "La imagen original se conserva y la nueva copia aparecerá en esta colección.",
      input: "select",
      inputOptions: {
        square: "Cuadrada · 1:1",
        landscape: "Horizontal · 16:9",
        portrait: "Vertical · 4:5",
      },
      showCancelButton: true,
      confirmButtonText: "Crear recorte",
      cancelButtonText: "Cancelar",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!selection.isConfirmed) return;
    const response = await scopedFetch(`/api/admin/media/${asset.id}/crop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preset: selection.value }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      asset?: MediaAssetData;
      error?: string;
    };
    if (!response.ok || !body.asset) {
      await Swal.fire({
        title: "No se pudo recortar",
        text: body.error ?? "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setAssets((current) =>
      current.some((item) => item.id === body.asset!.id) ? current : [body.asset!, ...current],
    );
  }

  /** @summary Confirma y solicita la eliminación, que el servidor rechaza si existe algún uso. */
  async function remove(asset: MediaAssetData) {
    const confirmation = await Swal.fire({
      title: `¿Eliminar ${asset.filename}?`,
      text: "Solo se eliminará si no está utilizado en ningún contenido.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmation.isConfirmed) return;
    const response = await scopedFetch(`/api/admin/media/${asset.id}`, { method: "DELETE" });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      await Swal.fire({
        title: "No se pudo eliminar",
        text: body.error ?? "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setAssets((current) => current.filter((item) => item.id !== asset.id));
  }

  return (
    <section>
      <PageHeader
        eyebrow="Recursos del negocio"
        title="Biblioteca multimedia"
        description="Archivos nuevos, modelos 3D, formatos, pesos, autores y textos alternativos."
        section="archivos"
      >
        <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_220px_auto]">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Buscar archivo o descripción"
          />
          <select className="input" value={folder} onChange={(event) => setFolder(event.target.value)}>
            <option value="all">Todas las colecciones</option>
            {folders.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <button
            className="btn btn-secondary"
            onClick={() => setView((current) => (current === "grid" ? "list" : "grid"))}
          >
            {view === "grid" ? "Ver lista" : "Ver grilla"}
          </button>
        </div>
      </PageHeader>
      <div className={view === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "space-y-3"}>
        {visible.map((asset) => (
          <article
            className={`card overflow-hidden ${view === "list" ? "flex items-center gap-4 p-3" : ""}`}
            key={asset.id}
          >
            <div
              className={`relative shrink-0 bg-white/5 ${view === "list" ? "h-20 w-20 rounded-xl" : "aspect-video"}`}
            >
              {asset.mimeType.startsWith("image/") ? (
                <Image
                  src={asset.thumbnailUrl || asset.url}
                  alt={asset.altText ?? ""}
                  fill
                  className="object-contain p-2"
                />
              ) : (
                <span className="grid h-full place-items-center text-3xl font-black text-pink-300">3D</span>
              )}
            </div>
            <div className="min-w-0 flex-1 p-4">
              <h2 className="truncate font-black" title={asset.filename}>
                {asset.filename}
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                {asset.folder} · {asset.mimeType} · {fileSize(asset.sizeBytes)}
              </p>
              {asset.width && asset.height && (
                <p className="mt-1 text-xs text-zinc-600">
                  {asset.width} × {asset.height} px · miniatura optimizada
                </p>
              )}
              <p className="mt-1 line-clamp-2 text-xs text-zinc-400">
                {asset.altText || "Sin texto alternativo"}
              </p>
              <p className="mt-1 text-[10px] text-zinc-600">
                {asset.user?.name ?? "Sistema"} · {new Date(asset.createdAt).toLocaleDateString("es-AR")}
              </p>
              <div className="mt-3 flex gap-2">
                <button className="btn btn-secondary px-3 py-2 text-xs" onClick={() => edit(asset)}>
                  Editar texto
                </button>
                {asset.mimeType.startsWith("image/") && asset.mimeType !== "image/gif" && (
                  <button
                    className="btn btn-secondary px-3 py-2 text-xs"
                    onClick={() => crop(asset)}
                    type="button"
                  >
                    Recortar copia
                  </button>
                )}
                <ActionMenu
                  align="left"
                  items={[
                    { label: "Editar texto", onClick: () => edit(asset) },
                    {
                      label: "Eliminar",
                      onClick: () => remove(asset),
                      tone: "danger",
                    },
                  ]}
                />
              </div>
            </div>
          </article>
        ))}
        {!visible.length && (
          <EmptyState
            title="Sin archivos"
            description="No hay recursos registrados con esos filtros."
          />
        )}
      </div>
    </section>
  );
}
