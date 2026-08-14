"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { scopedFetch } from "@/lib/client-routing";

export type LandingData = {
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string | null;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  fontFamily: string;
  tenantName: string;
  branchName: string;
};

/** @summary Editor visual de la portada con vista previa en vivo e imágenes por arrastre. */
export function LandingEditor({ initialBrand }: { initialBrand: LandingData }) {
  const [brand, setBrand] = useState(initialBrand);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** @summary Sube una imagen de portada con el gestor de marca y la asigna al instante. */
  async function uploadHero(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.set("resource", "brand-image");
    form.set("file", file);
    const response = await scopedFetch("/api/admin/upload", { method: "POST", body: form });
    const result = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
    setUploading(false);
    if (!response.ok || !result.url) {
      await Swal.fire({
        title: "No se pudo cargar la imagen",
        text: result.error ?? "Intentá con otra imagen.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setBrand((current) => ({ ...current, heroImageUrl: result.url! }));
  }

  /** @summary Elimina la imagen de portada confirmando y sin tocar el resto de la marca. */
  async function removeHero() {
    if (!brand.heroImageUrl) return;
    const confirmed = await Swal.fire({
      title: "¿Quitar la imagen de portada?",
      text: "El fondo quedará en el color del negocio.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, quitar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#e11d48",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmed.isConfirmed) return;
    const response = await scopedFetch("/api/admin/brand", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ field: "heroImageUrl", assetUrl: brand.heroImageUrl }),
    });
    const result = (await response.json().catch(() => ({}))) as { brand?: LandingData; error?: string };
    if (!response.ok || !result.brand) {
      await Swal.fire({
        title: "No se pudo quitar",
        text: result.error ?? "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setBrand((current) => ({ ...current, heroImageUrl: result.brand!.heroImageUrl ?? null }));
  }

  /** @summary Guarda textos e imagen usando la API de marca y audita el cambio. */
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await scopedFetch("/api/admin/brand", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        heroTitle: String(form.get("heroTitle") ?? "").trim() || null,
        heroSubtitle: String(form.get("heroSubtitle") ?? "").trim() || null,
        heroImageUrl: brand.heroImageUrl || null,
      }),
    });
    const result = (await response.json().catch(() => ({}))) as { brand?: LandingData; error?: string };
    if (!response.ok || !result.brand) {
      await Swal.fire({
        title: "No se pudo guardar",
        text: result.error ?? "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    await Swal.fire({
      title: "Portada guardada",
      text: "Los cambios ya están visibles para tus clientes.",
      icon: "success",
      timer: 1400,
      showConfirmButton: false,
      background: "#18181b",
      color: "#fafafa",
    });
  }

  const previewTitle = brand.heroTitle.trim() || `${brand.tenantName} es`;
  const previewSubtitle =
    brand.heroSubtitle.trim() ||
    "Pedí online desde tu carta, reservá una mesa y conocé lo que hacemos.";

  return (
    <section>
      <AdminPageHeader
        eyebrow="Página pública"
        title="Editor de portada"
        description="Cambiá el título, el texto y la imagen del inicio y mirá el resultado en vivo."
        section="landing"
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(300px,.8fr)_minmax(0,1.4fr)]">
        <form className="card space-y-4 p-5" onSubmit={save}>
          <label>
            <span className="label">Título de portada</span>
            <input
              className="input"
              name="heroTitle"
              value={brand.heroTitle}
              maxLength={220}
              onChange={(event) => setBrand((current) => ({ ...current, heroTitle: event.target.value }))}
              placeholder={`Ej. ${brand.tenantName} es`}
            />
          </label>
          <label>
            <span className="label">Texto de portada</span>
            <textarea
              className="input min-h-24"
              name="heroSubtitle"
              value={brand.heroSubtitle}
              maxLength={500}
              onChange={(event) => setBrand((current) => ({ ...current, heroSubtitle: event.target.value }))}
              placeholder="Contá en una o dos líneas qué hace especial a este lugar."
            />
          </label>

          <div>
            <span className="label">Imagen de portada</span>
            <div
              className={`relative mt-2 overflow-hidden rounded-2xl border-2 border-dashed transition ${
                dragging ? "border-pink-500 bg-pink-500/10" : "border-white/15 bg-white/[.02]"
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void uploadHero(event.dataTransfer.files?.[0]);
              }}
            >
              {brand.heroImageUrl ? (
                <div className="relative aspect-[16/7] w-full">
                  <Image src={brand.heroImageUrl} alt="Portada actual" fill unoptimized className="object-cover" />
                  <button
                    className="absolute right-2 top-2 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-red-300"
                    onClick={() => void removeHero()}
                    type="button"
                  >
                    Quitar
                  </button>
                </div>
              ) : (
                <button
                  className="grid min-h-40 w-full place-items-center p-6 text-center text-sm text-zinc-400"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  {uploading
                    ? "Subiendo imagen…"
                    : "Arrastrá una imagen acá o tocá para elegirla"}
                </button>
              )}
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                accept="image/*"
                onChange={(event) => void uploadHero(event.target.files?.[0])}
              />
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Formato horizontal recomendado (16:7). La imagen se guarda en tu biblioteca multimedia.
            </p>
          </div>

          <button className="btn w-full" disabled={uploading}>
            Guardar portada
          </button>
        </form>

        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black">Vista previa</h2>
            <div className="flex gap-1 rounded-full bg-white/5 p-1">
              {(["desktop", "mobile"] as const).map((candidate) => (
                <button
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    device === candidate ? "bg-pink-500/20 text-pink-200" : "text-zinc-500"
                  }`}
                  key={candidate}
                  onClick={() => setDevice(candidate)}
                  type="button"
                >
                  {candidate === "desktop" ? "Escritorio" : "Celular"}
                </button>
              ))}
            </div>
          </div>
          <div
            className={`relative overflow-hidden rounded-3xl border border-white/10 transition-all ${
              device === "mobile" ? "mx-auto w-full max-w-[400px]" : "w-full"
            }`}
            style={{
              backgroundColor: brand.backgroundColor,
              fontFamily: brand.fontFamily,
            }}
          >
            {brand.heroImageUrl ? (
              <div className="absolute inset-0">
                <Image src={brand.heroImageUrl} alt="" fill unoptimized className="object-cover opacity-30" />
              </div>
            ) : null}
            <div className={`relative z-10 flex flex-col items-start justify-center gap-4 ${device === "mobile" ? "min-h-96 p-6" : "min-h-72 p-8 sm:min-h-80 sm:p-12"}`}>
              {brand.logoUrl ? (
                <Image
                  src={brand.logoUrl}
                  alt=""
                  width={device === "mobile" ? 44 : 64}
                  height={device === "mobile" ? 44 : 64}
                  unoptimized
                  className="rounded-2xl object-cover"
                  style={{ width: device === "mobile" ? 44 : 64, height: device === "mobile" ? 44 : 64 }}
                />
              ) : null}
              <h3 className={`max-w-2xl font-black leading-tight text-white ${device === "mobile" ? "text-3xl" : "text-4xl sm:text-5xl"}`}>
                {previewTitle}
              </h3>
              <p className={`max-w-xl leading-relaxed text-zinc-300 ${device === "mobile" ? "text-base" : "text-base sm:text-lg"}`}>
                {previewSubtitle}
              </p>
              <span
                className="mt-2 rounded-full px-6 py-3 text-sm font-black text-white"
                style={{ backgroundColor: brand.primaryColor }}
              >
                Ver carta
              </span>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-zinc-600">
            La vista real usa la marca completa, la carta y las secciones ya publicadas.
          </p>
        </div>
      </div>
    </section>
  );
}