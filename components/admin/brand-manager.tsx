"use client";

import Image from "next/image";
import { useState } from "react";
import Swal from "sweetalert2";

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
  heroTitle: string | null;
  heroSubtitle: string | null;
  tone: string | null;
  socialLinks: unknown;
  customDomain: string | null;
  analyticsId: string | null;
  metaPixelId: string | null;
  searchConsoleId: string | null;
};

type BrandAsset = "logoUrl" | "isotypeUrl" | "faviconUrl";

/** @summary Recupera un enlace social de una configuración JSON sin asumir su estructura. */
function socialValue(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const item = (value as Record<string, unknown>)[key];
  return typeof item === "string" ? item : "";
}

/** @summary Administra identidad, textos, estilos, redes y configuración de presencia digital. */
export function BrandManager({ initialBrand }: { initialBrand: BrandData }) {
  const [brand, setBrand] = useState(initialBrand);
  const [uploading, setUploading] = useState<BrandAsset | null>(null);

  /** @summary Carga un recurso visual y lo asigna al campo de marca correspondiente. */
  async function uploadAsset(field: BrandAsset, file: File | undefined) {
    if (!file) return;
    setUploading(field);
    const form = new FormData();
    form.set("resource", "brand-image");
    form.set("file", file);
    const response = await fetch("/api/admin/upload", { method: "POST", body: form });
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

  /** @summary Guarda la identidad completa y actualiza la vista previa sin recargar. */
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const response = await fetch("/api/admin/brand", {
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
      <header className="mb-6 rounded-3xl border border-white/10 bg-zinc-950/80 p-5 sm:p-7">
        <p className="section-eyebrow">Identidad centralizada</p>
        <h1 className="mt-2 text-3xl font-black sm:text-5xl">Marca y presencia digital</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Una sola configuración controla colores, tipografía, recursos, textos y perfiles sociales.
        </p>
      </header>
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
                <input
                  className="sr-only"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif"
                  onChange={(event) => uploadAsset(field, event.target.files?.[0])}
                />
              </label>
            ))}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <label>
              <span className="label">Color principal</span>
              <input
                className="input h-12 p-1"
                name="primaryColor"
                type="color"
                defaultValue={brand.primaryColor}
              />
            </label>
            <label>
              <span className="label">Color secundario</span>
              <input
                className="input h-12 p-1"
                name="secondaryColor"
                type="color"
                defaultValue={brand.secondaryColor}
              />
            </label>
            <label>
              <span className="label">Fondo</span>
              <input
                className="input h-12 p-1"
                name="backgroundColor"
                type="color"
                defaultValue={brand.backgroundColor}
              />
            </label>
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
            configurar consentimiento de cookies.
          </p>
        </section>
      </div>
      <div className="sticky bottom-4 mt-6 flex justify-end">
        <button className="btn min-w-48">Guardar marca</button>
      </div>
    </form>
  );
}
