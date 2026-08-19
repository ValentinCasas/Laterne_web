"use client";

import Image from "next/image";
import { useState } from "react";
import Swal from "sweetalert2";
import { PageHeader, Card, CardHeader, CardContent } from "@/components/admin/ui";
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

/** @summary Tile de carga profesional para un recurso visual de marca (logo, isotipo, favicon). */
function AssetUploadTile({
  label,
  value,
  uploading,
  deleting,
  onUpload,
  onDelete,
  hint,
}: {
  label: string;
  value: string | null;
  uploading: boolean;
  deleting: boolean;
  onUpload: (file: File | undefined) => void;
  onDelete: (label: string) => void;
  hint: string;
}) {
  return (
    <label className="group relative flex flex-col rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-4 transition-colors hover:border-[var(--admin-primary-strong)]/60 hover:bg-white/[0.04]">
      <span className="label">{label}</span>
      <span className="relative mt-3 grid aspect-square place-items-center overflow-hidden rounded-xl border border-white/5 bg-white/5 transition-colors group-hover:border-white/10">
        {value ? (
          <Image src={value} alt={label} fill className="object-contain p-4" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-zinc-600">
            <span className="text-3xl leading-none">+</span>
            <span className="text-[11px] font-semibold">{hint}</span>
          </span>
        )}
      </span>
      <span className="mt-3 block text-center text-sm font-bold text-[var(--admin-primary-strong)]">
        {uploading ? "Cargando…" : value ? "Reemplazar" : "Elegir archivo"}
      </span>
      {value && !uploading && (
        <button
          type="button"
          className="mt-2 w-full rounded-lg border border-white/10 py-1.5 text-[11px] font-bold text-red-300 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void onDelete(label);
          }}
        >
          {deleting ? "Quitando…" : "Quitar"}
        </button>
      )}
      <input
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        onChange={(event) => onUpload(event.target.files?.[0])}
      />
    </label>
  );
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
      <PageHeader
        eyebrow="Identidad centralizada"
        title="Marca y presencia digital"
        description="Una sola configuración controla colores, tipografía, recursos, textos y perfiles sociales."
        section="marca"
      />
      <div className="grid gap-6">
        <Card padding="default">
          <CardHeader
            title="Recursos visuales"
            description="Subí el logo, isotipo y favicon. Se usan en la carta, el sitio y la app."
          />
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  ["logoUrl", "Logo", "PNG/JPG"],
                  ["isotypeUrl", "Isotipo", "PNG/JPG"],
                  ["faviconUrl", "Favicon", "ICO/PNG"],
                ] as const
              ).map(([field, label, hint]) => (
                <AssetUploadTile
                  key={field}
                  label={label}
                  hint={hint}
                  value={brand[field]}
                  uploading={uploading === field}
                  deleting={deleting === field}
                  onUpload={(file) => void uploadAsset(field, file)}
                  onDelete={(l) => void deleteAsset(field, l)}
                />
              ))}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
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
          </CardContent>
        </Card>
        <PaletteManager initialPalettes={palettes} initialActiveId={activePaletteId} presets={presets} />
        <Card padding="default">
          <CardHeader
            title="Voz y portada"
            description="Textos que presentan el negocio en la landing y la carta pública."
          />
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="label">Título principal</span>
                <input className="input" name="heroTitle" defaultValue={brand.heroTitle ?? ""} />
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
              <label className="sm:col-span-2">
                <span className="label">Texto principal</span>
                <textarea
                  className="input min-h-24"
                  name="heroSubtitle"
                  defaultValue={brand.heroSubtitle ?? ""}
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
          </CardContent>
        </Card>
        <Card padding="default">
          <CardHeader
            title="Dominio, SEO y medición"
            description="Configuración regional y etiquetas para buscadores y analítica."
          />
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
            <p className="mt-4 text-xs leading-relaxed text-zinc-500">
              Los identificadores quedan preparados; los scripts externos solo deben activarse después de
              configurar consentimiento de cookies. Cambiar la moneda modifica el formato, no convierte precios
              automáticamente.
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="sticky bottom-4 mt-6 flex justify-end">
        <button className="btn min-w-48">Guardar marca</button>
      </div>
    </form>
  );
}
