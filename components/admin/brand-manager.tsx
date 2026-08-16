"use client";

import Image from "next/image";
import { useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { PaletteManager, type PaletteRecord } from "@/components/admin/palette-manager";
import type { PalettePreset } from "@/lib/theme-palettes";
import { scopedFetch } from "@/lib/client-routing";

export type BrandData = {
  logoUrl: string | null;
  isotypeUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  fontFamily: string;
  buttonStyle: string;
  cardStyle: string;
  adminTheme: string;
  adminAccent: string;
  heroTitle: string | null;
  heroSubtitle: string | null;
  tone: string | null;
  socialLinks: unknown;
  customDomain: string | null;
  analyticsId: string | null;
  metaPixelId: string | null;
  searchConsoleId: string | null;
  defaultCurrency: string;
  locale: string;
  timeZone: string;
};

type BrandAsset = "logoUrl" | "isotypeUrl" | "faviconUrl";

/** @summary Recupera un enlace social de una configuración JSON sin asumir su estructura. */
function socialValue(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const item = (value as Record<string, unknown>)[key];
  return typeof item === "string" ? item : "";
}

/** @summary Administra identidad, textos, estilos, redes y configuración de presencia digital. */
export function BrandManager({
  initialBrand,
  palettes,
  activePaletteId,
  presets,
}: {
  initialBrand: BrandData;
  palettes: PaletteRecord[];
  activePaletteId: number | null;
  presets: PalettePreset[];
}) {
  const [brand, setBrand] = useState(initialBrand);
  const [uploading, setUploading] = useState<BrandAsset | null>(null);
  const [deleting, setDeleting] = useState<BrandAsset | null>(null);

  /** @summary Carga un recurso visual y lo asigna al campo de marca correspondiente. */
  async function uploadAsset(field: BrandAsset, file: File | undefined) {
    if (!file) return;
    setUploading(field);
    const form = new FormData();
    form.set("resource", "brand-image");
    form.set("file", file);
    const response = await scopedFetch("/api/admin/upload", { method: "POST", body: form });
    const result = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
    setUploading(null);
    if (!response.ok || !result.url) {
      await Swal.fire({
        title: "No se pudo cargar",
        text: result.error ?? "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setBrand((current) => ({ ...current, [field]: result.url! }));
  }

  /** @summary Elimina un recurso visual de marca tras confirmar y actualiza la vista al instante. */
  async function deleteAsset(field: BrandAsset, label: string) {
    const current = brand[field];
    if (!current) return;
    const confirmed = await Swal.fire({
      title: `¿Quitar ${label.toLowerCase()}?`,
      text: "Se eliminará de tu carta y se volverá a mostrar el nombre del negocio.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, quitar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#e11d48",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmed.isConfirmed) return;
    setDeleting(field);
    try {
      const response = await scopedFetch("/api/admin/brand", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ field, assetUrl: current }),
      });
      const result = (await response.json().catch(() => ({}))) as { brand?: BrandData; error?: string };
      if (!response.ok || !result.brand) throw new Error(result.error ?? "No se pudo quitar");
      setBrand(result.brand);
    } catch (error) {
      await Swal.fire({
        title: "No se pudo quitar",
        text: error instanceof Error ? error.message : "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
    } finally {
      setDeleting(null);
    }
  }

  /** @summary Guarda la identidad completa y actualiza la vista previa sin recargar. */
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const response = await scopedFetch("/api/admin/brand", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        logoUrl: brand.logoUrl ?? "",
        isotypeUrl: brand.isotypeUrl ?? "",
        faviconUrl: brand.faviconUrl ?? "",
      }),
    });
    const result = (await response.json().catch(() => ({}))) as { brand?: BrandData; error?: string };
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
    setBrand(result.brand);
    await Swal.fire({
      title: "Marca actualizada",
      text: "Los cambios ya están disponibles en el sitio.",
      icon: "success",
      timer: 1700,
      showConfirmButton: false,
      background: "#18181b",
      color: "#fafafa",
    });
  }

  return (
    <form onSubmit={save}>
      <AdminPageHeader
        eyebrow="Identidad centralizada"
        title="Marca y presencia digital"
        description="Una sola configuración controla colores, tipografía, recursos, textos y perfiles sociales."
        section="marca"
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-5 sm:p-7">
          <h2 className="text-2xl font-black">Recursos visuales</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {(
              [
                ["logoUrl", "Logo"],
                ["isotypeUrl", "Isotipo"],
                ["faviconUrl", "Favicon"],
              ] as const
            ).map(([field, label]) => (
              <label
                className="group rounded-2xl border border-dashed border-white/15 p-3 text-center"
                key={field}
              >
                <span className="label">{label}</span>
                <span className="relative mt-2 block aspect-square overflow-hidden rounded-xl bg-white/5">
                  {brand[field] ? (
                    <Image src={brand[field]!} alt={label} fill className="object-contain p-3" />
                  ) : (
                    <span className="grid h-full place-items-center text-3xl text-zinc-600">+</span>
                  )}
                </span>
                <span className="mt-2 block text-xs text-pink-300">
                  {uploading === field ? "Cargando…" : "Elegir archivo"}
                </span>
                {brand[field] && uploading !== field && (
                  <button
                    type="button"
                    className="mt-1 w-full text-[11px] font-bold text-red-300 transition hover:text-red-200"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void deleteAsset(field, label);
                    }}
                  >
                    {deleting === field ? "Quitando…" : "Quitar"}
                  </button>
                )}
                <input
                  className="sr-only"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif"
                  onChange={(event) => uploadAsset(field, event.target.files?.[0])}
                />
              </label>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label>
              <span className="label">Tipografía</span>
              <select className="input" name="fontFamily" defaultValue={brand.fontFamily}>
                <option>Inter</option>
                <option>system-ui</option>
                <option>Georgia</option>
                <option>Arial</option>
              </select>
            </label>
            <label>
              <span className="label">Botones</span>
              <select className="input" name="buttonStyle" defaultValue={brand.buttonStyle}>
                <option value="rounded">Redondeados</option>
                <option value="pill">Píldora</option>
                <option value="square">Rectos</option>
              </select>
            </label>
            <label>
              <span className="label">Tarjetas</span>
              <select className="input" name="cardStyle" defaultValue={brand.cardStyle}>
                <option value="soft">Suaves</option>
                <option value="bordered">Marcadas</option>
                <option value="flat">Planas</option>
              </select>
            </label>
          </div>
        </section>
        <PaletteManager initialPalettes={palettes} initialActiveId={activePaletteId} presets={presets} />
        <section className="card p-5 sm:p-7">
          <h2 className="text-2xl font-black">Voz y portada</h2>
          <div className="mt-5 space-y-4">
            <label>
              <span className="label">Título principal</span>
              <input className="input" name="heroTitle" defaultValue={brand.heroTitle ?? ""} />
            </label>
            <label>
              <span className="label">Texto principal</span>
              <textarea
                className="input min-h-24"
                name="heroSubtitle"
                defaultValue={brand.heroSubtitle ?? ""}
              />
            </label>
            <label>
              <span className="label">Tono de comunicación</span>
              <input
                className="input"
                name="tone"
                defaultValue={brand.tone ?? ""}
                placeholder="Ej. cercano, alegre y directo"
              />
            </label>
            <label>
              <span className="label">Instagram</span>
              <input
                className="input"
                name="instagram"
                type="url"
                defaultValue={socialValue(brand.socialLinks, "instagram")}
              />
            </label>
            <label>
              <span className="label">Facebook</span>
              <input
                className="input"
                name="facebook"
                type="url"
                defaultValue={socialValue(brand.socialLinks, "facebook")}
              />
            </label>
          </div>
        </section>
        <section className="card p-5 sm:p-7 xl:col-span-2">
          <h2 className="text-2xl font-black">Dominio, SEO y medición</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <label>
              <span className="label">Moneda pública</span>
              <select className="input" name="defaultCurrency" defaultValue={brand.defaultCurrency}>
                <option value="ARS">Peso argentino (ARS)</option>
                <option value="USD">Dólar (USD)</option>
                <option value="UYU">Peso uruguayo (UYU)</option>
                <option value="BRL">Real (BRL)</option>
                <option value="CLP">Peso chileno (CLP)</option>
                <option value="EUR">Euro (EUR)</option>
              </select>
            </label>
            <label>
              <span className="label">Idioma y región</span>
              <select className="input" name="locale" defaultValue={brand.locale}>
                <option value="es-AR">Español · Argentina</option>
                <option value="es-UY">Español · Uruguay</option>
                <option value="es-CL">Español · Chile</option>
                <option value="en-US">English · United States</option>
                <option value="pt-BR">Português · Brasil</option>
              </select>
            </label>
            <label>
              <span className="label">Zona horaria</span>
              <select className="input" name="timeZone" defaultValue={brand.timeZone}>
                <option value="America/Argentina/Buenos_Aires">Argentina · Buenos Aires</option>
                <option value="America/Montevideo">Uruguay · Montevideo</option>
                <option value="America/Santiago">Chile · Santiago</option>
                <option value="America/Sao_Paulo">Brasil · São Paulo</option>
                <option value="America/New_York">Estados Unidos · Nueva York</option>
                <option value="Europe/Madrid">España · Madrid</option>
              </select>
            </label>
            <label>
              <span className="label">Dominio personalizado</span>
              <input
                className="input"
                name="customDomain"
                defaultValue={brand.customDomain ?? ""}
                placeholder="menu.negocio.com"
              />
            </label>
            <label>
              <span className="label">Google Analytics</span>
              <input
                className="input"
                name="analyticsId"
                defaultValue={brand.analyticsId ?? ""}
                placeholder="G-XXXXXXXX"
              />
            </label>
            <label>
              <span className="label">Meta Pixel</span>
              <input className="input" name="metaPixelId" defaultValue={brand.metaPixelId ?? ""} />
            </label>
            <label>
              <span className="label">Search Console</span>
              <input className="input" name="searchConsoleId" defaultValue={brand.searchConsoleId ?? ""} />
            </label>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Los identificadores quedan preparados; los scripts externos solo deben activarse después de
            configurar consentimiento de cookies. Cambiar la moneda modifica el formato, no convierte precios
            automáticamente.
          </p>
        </section>
      </div>
      <div className="sticky bottom-4 mt-6 flex justify-end">
        <button className="btn min-w-48">Guardar marca</button>
      </div>
    </form>
  );
}
