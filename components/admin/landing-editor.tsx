"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { LandingRenderer } from "@/components/landing/landing-renderer";
import { ResponsivePreview, type ResponsivePreviewHandle } from "@/components/admin/responsive-preview";
import type { PublicEvent } from "@/components/home/event-grid";
import {
  LANDING_BEER_DEFAULTS,
  LANDING_IMAGE_PATH_RE,
  LANDING_STORY_DEFAULTS,
  type LandingHeroButtonConfig,
  type LandingHeroConfig,
  type LandingSectionKey,
  type LandingTestimonialSlide,
  type OpeningHourGroup,
  type TenantLandingData,
} from "@/lib/landing-content";
import { scopedFetch } from "@/lib/client-routing";
import { paletteCssVariables, paletteFromLegacy } from "@/lib/theme-palettes";
import type { CSSProperties } from "react";

export type LandingStory = { title: string; subtitle: string; image: string };
export type LandingSections = { beerImages: string[]; stories: LandingStory[] };

export type LandingData = {
  hero: LandingHeroConfig;
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
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  instagramUrl: string;
  facebookUrl: string;
  latitude: number | null;
  longitude: number | null;
  hasMap: boolean;
  openingGroups: OpeningHourGroup[];
};

type SectionKey = LandingSectionKey;

const sectionMeta: Record<SectionKey, { label: string; hint: string }> = {
  hero: { label: "Hero / Portada", hint: "Textos, botones e imagen de inicio." },
  beers: { label: "Productos / Cervezas", hint: "Imágenes del carrusel de productos." },
  stories: { label: "Historia", hint: "Tarjetas con imagen, título y texto." },
  events: { label: "Eventos", hint: "Los flyers se administran desde Eventos." },
  testimonials: { label: "Testimonios", hint: "Las opiniones se moderan desde Testimonios." },
  map: { label: "Mapa / Ubicación", hint: "El mapa usa la dirección del negocio." },
  contact: { label: "Contacto / Pie", hint: "Teléfono, email, dirección y redes." },
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const IMAGE_TYPES_LABEL = "JPG, PNG, WEBP o AVIF";

/** @summary Valida una imagen contra los límites reales de carga y devuelve el error a mostrar. */
function validateImageFile(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) {
    return `Formato no compatible. Usá ${IMAGE_TYPES_LABEL}.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `La imagen es demasiado grande. Tamaño: ${(file.size / (1024 * 1024)).toFixed(1)} MB. Máximo: 5 MB.`;
  }
  return null;
}

function imageAlert(error: string) {
  void Swal.fire({
    title: "Imagen no válida",
    text: error,
    icon: "error",
    confirmButtonColor: "#ec4899",
    background: "#18181b",
    color: "#fafafa",
  });
}

const isBlobUrl = (value: string | null | undefined) =>
  typeof value === "string" && value.startsWith("blob:");

/** @summary Abre el selector de archivos, valida la imagen y entrega la elegida a la acción indicada. */
function pickFile(onFile: (file: File) => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = IMAGE_TYPES.join(",");
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const error = validateImageFile(file);
    if (error) {
      imageAlert(error);
      return;
    }
    onFile(file);
  };
  input.click();
}

/** @summary Sube una imagen al gestor de marca y devuelve la URL pública final. */
async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.set("resource", "brand-image");
  form.set("file", file);
  const response = await scopedFetch("/api/admin/upload", { method: "POST", body: form });
  const result = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!response.ok || !result.url) {
    throw new Error(result.error ?? "No se pudo cargar una imagen");
  }
  return result.url;
}

/** @summary Editor visual de la landing completa con preview vertical en vivo. */
export function LandingEditor({
  initialBrand,
  initialSections,
  initialEvents,
  initialTestimonials,
  eventCount,
  testimonialCount,
}: {
  initialBrand: LandingData;
  initialSections: LandingSections;
  initialEvents: PublicEvent[];
  initialTestimonials: LandingTestimonialSlide[];
  eventCount: number;
  testimonialCount: number;
}) {
  const [brand, setBrand] = useState(initialBrand);
  const [hero, setHero] = useState<LandingHeroConfig>(initialBrand.hero);
  const [contact, setContact] = useState({
    phone: initialBrand.contactPhone,
    email: initialBrand.contactEmail,
    address: initialBrand.contactAddress,
    instagram: initialBrand.instagramUrl,
    facebook: initialBrand.facebookUrl,
  });
  const [sections, setSections] = useState<LandingSections>({
    beerImages: initialSections.beerImages.length
      ? [...new Set(initialSections.beerImages)]
      : LANDING_BEER_DEFAULTS,
    stories: initialSections.stories.length ? initialSections.stories : LANDING_STORY_DEFAULTS,
  });
  const [selected, setSelected] = useState<SectionKey>("hero");
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const pendingFiles = useRef(new Map<string, File>());
  const previewRef = useRef<ResponsivePreviewHandle>(null);

  const pendingHeroImage = brand.heroImageUrl || null;

  /** @summary Crea un objeto URL local para ver la imagen al instante sin esperar la subida. */
  function stageImage(file: File): string {
    const url = URL.createObjectURL(file);
    pendingFiles.current.set(url, file);
    return url;
  }

  function replaceHeroImage(file: File) {
    const url = stageImage(file);
    setBrand((current) => {
      if (isBlobUrl(current.heroImageUrl)) URL.revokeObjectURL(current.heroImageUrl!);
      return { ...current, heroImageUrl: url };
    });
  }

  function replaceInList(kind: "beerImages" | "stories", index: number, file: File) {
    const url = stageImage(file);
    setSections((current) => {
      if (kind === "beerImages") {
        const previous = current.beerImages[index];
        if (isBlobUrl(previous)) URL.revokeObjectURL(previous);
        const beerImages = [...current.beerImages];
        beerImages[index] = url;
        return { ...current, beerImages };
      }
      const previous = current.stories[index]?.image;
      if (isBlobUrl(previous)) URL.revokeObjectURL(previous);
      const stories = current.stories.map((slide, slideIndex) =>
        slideIndex === index ? { ...slide, image: url } : slide,
      );
      return { ...current, stories };
    });
  }

  function appendImage(kind: "beerImages" | "stories", file: File) {
    if (kind === "beerImages") {
      const alreadyStaged = [...pendingFiles.current.values()].some(
        (pending) =>
          pending.name === file.name && pending.size === file.size && pending.lastModified === file.lastModified,
      );
      if (alreadyStaged) {
        void Swal.fire({
          title: "Imagen repetida",
          text: "Esa imagen ya está en el carrusel. Elegí otra o quitá la anterior si querés repetirla.",
          icon: "warning",
          timer: 1800,
          showConfirmButton: false,
          background: "#18181b",
          color: "#fafafa",
        });
        return;
      }
    }
    const url = stageImage(file);
    setSections((current) =>
      kind === "beerImages"
        ? { ...current, beerImages: [...current.beerImages, url] }
        : {
            ...current,
            stories: [
              ...current.stories,
              { title: "Nueva historia", subtitle: "Contá qué hace especial este lugar.", image: url },
            ],
          },
    );
  }

  function removeFrom(kind: "beerImages" | "stories", index: number) {
    setSections((current) => {
      if (kind === "beerImages") {
        const previous = current.beerImages[index];
        if (isBlobUrl(previous)) URL.revokeObjectURL(previous);
        return { ...current, beerImages: current.beerImages.filter((_, i) => i !== index) };
      }
      const previous = current.stories[index]?.image;
      if (isBlobUrl(previous)) URL.revokeObjectURL(previous);
      return { ...current, stories: current.stories.filter((_, i) => i !== index) };
    });
  }

  function move(kind: "beerImages" | "stories", index: number, direction: -1 | 1) {
    setSections((current) => {
      const list = kind === "beerImages" ? [...current.beerImages] : [...current.stories];
      const target = index + direction;
      if (target < 0 || target >= list.length) return current;
      [list[index], list[target]] = [list[target], list[index]];
      return kind === "beerImages"
        ? { ...current, beerImages: list as string[] }
        : { ...current, stories: list as LandingStory[] };
    });
  }

  function updateStoryText(index: number, field: "title" | "subtitle", value: string) {
    setSections((current) => ({
      ...current,
      stories: current.stories.map((slide, slideIndex) =>
        slideIndex === index ? { ...slide, [field]: value } : slide,
      ),
    }));
  }

  /** @summary Sube la imagen pendiente (blob local) y devuelve la URL persistida. */
  async function resolveImage(value: string | null | undefined): Promise<string | null> {
    if (!value || !isBlobUrl(value)) return value ?? null;
    const file = pendingFiles.current.get(value);
    if (!file) return null;
    const url = await uploadImage(file);
    pendingFiles.current.delete(value);
    URL.revokeObjectURL(value);
    return url;
  }

  async function removeHero() {
    if (!pendingHeroImage) return;
    const confirmed = await Swal.fire({
      title: "¿Quitar la imagen de fondo?",
      text: "Se mostrará un fondo decorado con los colores del negocio.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, quitar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#e11d48",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmed.isConfirmed) return;
    if (isBlobUrl(pendingHeroImage)) {
      pendingFiles.current.delete(pendingHeroImage);
      URL.revokeObjectURL(pendingHeroImage);
      setBrand((current) => ({ ...current, heroImageUrl: null }));
      return;
    }
    const response = await scopedFetch("/api/admin/brand", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ field: "heroImageUrl", assetUrl: pendingHeroImage }),
    });
    const result = (await response.json().catch(() => ({}))) as { brand?: LandingData; error?: string };
    if (!response.ok || !result.brand) return;
    setBrand((current) => ({ ...current, heroImageUrl: result.brand!.heroImageUrl ?? null }));
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const heroImageUrl = await resolveImage(brand.heroImageUrl);
      const beerImages: string[] = [];
      for (const image of sections.beerImages) {
        const resolved = await resolveImage(image);
        if (resolved) beerImages.push(resolved);
      }
      const uniqueBeerImages = [...new Set(beerImages)];
      const removedDuplicates = beerImages.length - uniqueBeerImages.length;
      const stories: LandingStory[] = [];
      for (const slide of sections.stories) {
        const resolved = await resolveImage(slide.image);
        stories.push({ ...slide, image: resolved ?? LANDING_STORY_DEFAULTS[0].image });
      }

      const response = await scopedFetch("/api/admin/brand", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroTitle: hero.title.trim() || null,
          heroSubtitle: hero.description.trim() || null,
          heroImageUrl,
          landingSections: {
            beerImages: uniqueBeerImages,
            stories,
            hero: {
              eyebrow: hero.eyebrow.trim(),
              title: hero.title.trim(),
              highlight: hero.highlight,
              description: hero.description.trim(),
              primaryButton: hero.primaryButton,
              secondaryButton: hero.secondaryButton,
            },
          },
          contact: {
            phone: contact.phone.trim(),
            email: contact.email.trim(),
            address: contact.address.trim(),
            instagram: contact.instagram.trim(),
            facebook: contact.facebook.trim(),
          },
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        brand?: LandingData;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error ?? "No se pudo guardar la landing");

      setBrand((current) => ({ ...current, heroImageUrl }));
      setSections({ beerImages: uniqueBeerImages, stories });
      if (removedDuplicates > 0) {
        await Swal.fire({
          title: "Landing guardada",
          text: `Se quitaron ${removedDuplicates} ${
            removedDuplicates === 1 ? "imagen repetida" : "imágenes repetidas"
          } del carrusel para que no se muestren dos veces.`,
          icon: "info",
          timer: 2400,
          showConfirmButton: false,
          background: "#18181b",
          color: "#fafafa",
        });
        return;
      }
      await Swal.fire({
        title: "Landing guardada",
        text: "Los cambios ya están visibles para tus clientes.",
        icon: "success",
        timer: 1400,
        showConfirmButton: false,
        background: "#18181b",
        color: "#fafafa",
      });
    } catch (error) {
      await Swal.fire({
        title: "No se pudo guardar",
        text: error instanceof Error ? error.message : "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
    } finally {
      setSaving(false);
    }
  }

  const previewHero: LandingHeroConfig = { ...hero, imageUrl: pendingHeroImage };
  const previewBeers = [
    ...new Set(
      (sections.beerImages.length ? sections.beerImages : LANDING_BEER_DEFAULTS).filter((source) =>
        LANDING_IMAGE_PATH_RE.test(source),
      ),
    ),
  ];
  const previewStories = sections.stories.length ? sections.stories : LANDING_STORY_DEFAULTS;
  const previewHasMap = initialBrand.hasMap && initialBrand.latitude !== null && initialBrand.longitude !== null;
  const previewData: TenantLandingData = {
    displayName: brand.tenantName,
    hero: previewHero,
    heroTitle: hero.title,
    heroSubtitle: hero.description,
    heroImageUrl: pendingHeroImage,
    primaryColor: brand.primaryColor,
    secondaryColor: brand.secondaryColor,
    backgroundColor: brand.backgroundColor,
    beers: previewBeers,
    stories: previewStories,
    events: initialEvents,
    testimonials: initialTestimonials,
    openingGroups: initialBrand.openingGroups,
    phone: contact.phone,
    email: contact.email,
    address: contact.address,
    instagramUrl: contact.instagram,
    facebookUrl: contact.facebook,
    latitude: initialBrand.latitude,
    longitude: initialBrand.longitude,
    hasMap: initialBrand.hasMap,
  };

  const previewPalette = paletteFromLegacy(brand.primaryColor, brand.secondaryColor, brand.backgroundColor);
  const previewBodyStyle: CSSProperties = {
    ...paletteCssVariables(previewPalette),
    backgroundColor: brand.backgroundColor,
    fontFamily: brand.fontFamily,
    colorScheme: "dark",
  };

  const sectionIdByKey: Record<SectionKey, string> = {
    hero: "landing-sec-hero",
    events: "eventos",
    beers: "landing-sec-beers",
    stories: "landing-sec-stories",
    testimonials: "landing-sec-testimonials",
    map: "landing-sec-map",
    contact: "redes",
  };

  function selectSection(key: SectionKey) {
    setSelected(key);
    previewRef.current?.scrollToId(sectionIdByKey[key]);
  }

  const editorFor: Record<SectionKey, React.ReactNode> = {
    hero: (
      <div className="space-y-4">
        <label>
          <span className="label">Texto de arriba (eyebrow)</span>
          <input
            className="input"
            value={hero.eyebrow}
            maxLength={120}
            onChange={(event) => setHero((current) => ({ ...current, eyebrow: event.target.value }))}
            placeholder={`Ej. ${brand.tenantName}`}
          />
        </label>
        <label>
          <span className="label">Título principal</span>
          <input
            className="input"
            value={hero.title}
            maxLength={220}
            onChange={(event) => setHero((current) => ({ ...current, title: event.target.value }))}
            placeholder={`Ej. ${brand.tenantName} es`}
          />
        </label>
        <label>
          <span className="label">Palabra destacada</span>
          <input
            className="input"
            value={hero.highlight}
            maxLength={80}
            onChange={(event) => setHero((current) => ({ ...current, highlight: event.target.value }))}
            placeholder="Ej. birra."
          />
          <p className="mt-1 text-xs text-zinc-500">Si lo dejás vacío, no se muestra.</p>
        </label>
        <label>
          <span className="label">Descripción</span>
          <textarea
            className="input min-h-24"
            value={hero.description}
            maxLength={500}
            onChange={(event) => setHero((current) => ({ ...current, description: event.target.value }))}
            placeholder="Contá en una o dos líneas qué hace especial a este lugar."
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <ButtonConfigEditor
            title="Botón principal"
            value={hero.primaryButton}
            onChange={(next) => setHero((current) => ({ ...current, primaryButton: next }))}
          />
          <ButtonConfigEditor
            title="Botón secundario"
            value={hero.secondaryButton}
            onChange={(next) => setHero((current) => ({ ...current, secondaryButton: next }))}
          />
        </div>
        <ImageDropzone
          label="Imagen de fondo"
          hint="Formato horizontal recomendado (16:7). Máx. 5 MB (JPG, PNG, WEBP o AVIF)."
          uploading={saving}
          dragging={dragging}
          setDragging={setDragging}
          onDrop={(file) => {
            setDragging(false);
            replaceHeroImage(file);
          }}
          onPick={() => pickFile((file) => replaceHeroImage(file))}
          onRemove={pendingHeroImage ? removeHero : undefined}
          value={pendingHeroImage}
        />
        <p className="text-xs leading-relaxed text-zinc-500">
          Sin imagen se muestra un fondo con los colores del negocio. Si una imagen no carga, se usa el mismo fondo.
        </p>
      </div>
    ),
    beers: (
      <div className="space-y-3">
        <p className="text-sm text-zinc-500">
          Imágenes del carrusel «Nuestros productos». Podés subir varias, arrastrarlas al recuadro y ordenarlas.
        </p>
        {sections.beerImages.map((image, index) => (
          <ImageRow
            key={`${index}-${image}`}
            image={image}
            onReplace={(file) => replaceInList("beerImages", index, file)}
            onRemove={() => removeFrom("beerImages", index)}
            onMoveUp={index > 0 ? () => move("beerImages", index, -1) : undefined}
            onMoveDown={
              index < sections.beerImages.length - 1 ? () => move("beerImages", index, 1) : undefined
            }
          />
        ))}
        <DropAddButton label="Agregar imagen" onPick={() => pickFile((file) => appendImage("beerImages", file))} />
      </div>
    ),
    stories: (
      <div className="space-y-4">
        <p className="text-sm text-zinc-500">Tarjetas de la sección «Historia»: imagen, título y texto.</p>
        {sections.stories.map((slide, index) => (
          <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4" key={`${index}-${slide.image}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-widest text-pink-300">Tarjeta {index + 1}</p>
              <div className="flex gap-1">
                {index > 0 && (
                  <button className="rounded-lg bg-white/5 px-2 py-1 text-xs" onClick={() => move("stories", index, -1)} type="button">
                    ↑
                  </button>
                )}
                {index < sections.stories.length - 1 && (
                  <button className="rounded-lg bg-white/5 px-2 py-1 text-xs" onClick={() => move("stories", index, 1)} type="button">
                    ↓
                  </button>
                )}
                <button
                  className="rounded-lg bg-red-500/10 px-2 py-1 text-xs text-red-300"
                  onClick={() => removeFrom("stories", index)}
                  type="button"
                >
                  Quitar
                </button>
              </div>
            </div>
            <label className="mt-3 block">
              <span className="label">Título</span>
              <input
                className="input"
                value={slide.title}
                maxLength={120}
                onChange={(event) => updateStoryText(index, "title", event.target.value)}
              />
            </label>
            <label className="mt-3 block">
              <span className="label">Texto</span>
              <textarea
                className="input min-h-16"
                value={slide.subtitle}
                maxLength={300}
                onChange={(event) => updateStoryText(index, "subtitle", event.target.value)}
              />
            </label>
            <div className="mt-3">
              <ImageDropzone
                label="Imagen"
                hint=""
                uploading={saving}
                dragging={dragging}
                setDragging={setDragging}
                onDrop={(file) => {
                  setDragging(false);
                  replaceInList("stories", index, file);
                }}
                onPick={() => pickFile((file) => replaceInList("stories", index, file))}
                onRemove={() => removeFrom("stories", index)}
                value={slide.image}
              />
            </div>
          </div>
        ))}
        <DropAddButton label="Agregar tarjeta" onPick={() => pickFile((file) => appendImage("stories", file))} />
      </div>
    ),
    events: (
      <div className="rounded-2xl border border-white/10 bg-white/[.03] p-5 text-sm leading-relaxed text-zinc-400">
        <p>
          La sección <strong className="text-white">Eventos</strong> muestra los flyers publicados en el recurso
          Eventos.
        </p>
        <p className="mt-2">
          Actualmente hay <strong className="text-pink-300">{eventCount}</strong>{" "}
          {eventCount === 1 ? "evento publicado" : "eventos publicados"}.
        </p>
      </div>
    ),
    testimonials: (
      <div className="rounded-2xl border border-white/10 bg-white/[.03] p-5 text-sm leading-relaxed text-zinc-400">
        <p>
          La sección <strong className="text-white">Testimonios</strong> muestra las opiniones aprobadas que moderás
          en el recurso Testimonios.
        </p>
        <p className="mt-2">
          Hay <strong className="text-pink-300">{testimonialCount}</strong>{" "}
          {testimonialCount === 1 ? "opinión aprobada" : "opiniones aprobadas"} visibles.
        </p>
      </div>
    ),
    map: (
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/[.03] p-5 text-sm leading-relaxed text-zinc-400">
          <p>
            La sección <strong className="text-white">Mapa</strong> muestra la ubicación del negocio sobre un mapa
            interactivo.
          </p>
          <p className="mt-2">La dirección y las coordenadas se administran en el recurso Información del negocio.</p>
          {!previewHasMap && (
            <p className="mt-2 font-semibold text-amber-300">
              El mapa no se muestra porque el negocio todavía no tiene coordenadas cargadas.
            </p>
          )}
        </div>
      </div>
    ),
    contact: (
      <div className="space-y-4">
        <p className="text-sm text-zinc-500">Datos que aparecen en el pie de la página pública y en la sección de contacto.</p>
        <label>
          <span className="label">Teléfono (WhatsApp)</span>
          <input
            className="input"
            type="tel"
            value={contact.phone}
            maxLength={30}
            onChange={(event) => setContact((current) => ({ ...current, phone: event.target.value }))}
            placeholder="5491122334455"
          />
        </label>
        <label>
          <span className="label">Email</span>
          <input
            className="input"
            type="email"
            value={contact.email}
            maxLength={255}
            onChange={(event) => setContact((current) => ({ ...current, email: event.target.value }))}
            placeholder="hola@example.com"
          />
        </label>
        <label>
          <span className="label">Dirección</span>
          <input
            className="input"
            value={contact.address}
            maxLength={255}
            onChange={(event) => setContact((current) => ({ ...current, address: event.target.value }))}
            placeholder="Calle y número"
          />
        </label>
        <label>
          <span className="label">Instagram (URL)</span>
          <input
            className="input"
            value={contact.instagram}
            maxLength={500}
            onChange={(event) => setContact((current) => ({ ...current, instagram: event.target.value }))}
            placeholder="https://instagram.com/..."
          />
        </label>
        <label>
          <span className="label">Facebook (URL)</span>
          <input
            className="input"
            value={contact.facebook}
            maxLength={500}
            onChange={(event) => setContact((current) => ({ ...current, facebook: event.target.value }))}
            placeholder="https://facebook.com/..."
          />
        </label>
      </div>
    ),
  };

  return (
    <section>
      <AdminPageHeader
        eyebrow="Página pública"
        title="Editor de landing"
        description="Elegí una sección, cargá imágenes o textos y mirá el resultado en vivo."
        section="landing"
        actions={
          <button className="btn" disabled={saving} onClick={() => void save()} type="button">
            {saving ? "Guardando…" : "Guardar landing"}
          </button>
        }
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(300px,.9fr)_minmax(0,1.1fr)]">
        <div className="card space-y-4 p-5">
          <div>
            <span className="label">Sección a editar</span>
            <div className="mt-2 grid gap-2">
              {(Object.keys(sectionMeta) as SectionKey[]).map((key) => (
                <button
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-bold transition ${
                    selected === key
                      ? "border-pink-500/50 bg-pink-500/10 text-white"
                      : "border-white/10 bg-white/[.02] text-zinc-300 hover:border-white/20"
                  }`}
                  key={key}
                  onClick={() => selectSection(key)}
                  type="button"
                >
                  <span>{sectionMeta[key].label}</span>
                  <span className="text-xs font-medium text-zinc-500">{sectionMeta[key].hint}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-white/10 pt-4">{editorFor[selected]}</div>
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-black">Vista previa</h2>
            <p className="text-xs text-zinc-500">
              El ancho se emula de verdad: los saltos responsive reaccionan al tamaño elegido.
            </p>
          </div>
          <div className="h-[min(720px,calc(100dvh-16rem))]">
            <ResponsivePreview ref={previewRef} bodyClass="tenant-theme" bodyStyle={previewBodyStyle}>
              <LandingRenderer
                data={previewData}
                preview
                activeSection={selected}
                onSectionSelect={setSelected}
                compact
              />
            </ResponsivePreview>
          </div>
          <p className="mt-3 text-center text-xs text-zinc-600">
            La vista usa exactamente los mismos componentes y datos que la landing pública de {brand.tenantName}.
          </p>
        </div>
      </div>
    </section>
  );
}

/** @summary Editor de configuración de un botón del hero: visibilidad, texto y destino. */
function ButtonConfigEditor({
  title,
  value,
  onChange,
}: {
  title: string;
  value: LandingHeroButtonConfig;
  onChange: (next: LandingHeroButtonConfig) => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[.03] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-widest text-pink-300">{title}</p>
        <label className="flex items-center gap-1.5 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={value.visible}
            onChange={(event) => onChange({ ...value, visible: event.target.checked })}
            className="accent-pink-500"
          />
          Mostrar
        </label>
      </div>
      <label className="block">
        <span className="label">Texto del botón</span>
        <input
          className="input"
          value={value.label}
          maxLength={60}
          onChange={(event) => onChange({ ...value, label: event.target.value })}
        />
      </label>
      <label className="block">
        <span className="label">Destino</span>
        <input
          className="input"
          value={value.href}
          maxLength={300}
          onChange={(event) => onChange({ ...value, href: event.target.value })}
          placeholder="/carta"
        />
      </label>
    </div>
  );
}

/** @summary Zona de arrastre y selección para una imagen con estado visual de drag y validación de formato/tamaño. */
function ImageDropzone({
  label,
  hint,
  value,
  uploading,
  dragging,
  setDragging,
  onDrop,
  onPick,
  onRemove,
}: {
  label: string;
  hint: string;
  value: string | null;
  uploading: boolean;
  dragging: boolean;
  setDragging: (value: boolean) => void;
  onDrop: (file: File) => void;
  onPick: () => void;
  onRemove?: () => void;
}) {
  return (
    <div>
      <span className="label">{label}</span>
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
          const file = event.dataTransfer.files?.[0];
          if (!file) return;
          const error = validateImageFile(file);
          if (error) {
            imageAlert(error);
            return;
          }
          onDrop(file);
        }}
      >
        {value ? (
          <div className="relative aspect-[16/7] w-full">
            <Image src={value} alt={label} fill unoptimized className="object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent p-2">
              <button className="rounded-lg bg-black/70 px-3 py-1 text-xs font-bold" onClick={onPick} type="button">
                Reemplazar
              </button>
              {onRemove && (
                <button
                  className="rounded-lg bg-black/70 px-3 py-1 text-xs font-bold text-red-300"
                  onClick={onRemove}
                  type="button"
                >
                  Quitar
                </button>
              )}
            </div>
          </div>
        ) : (
          <button
            className="grid min-h-32 w-full place-items-center p-6 text-center text-sm text-zinc-400"
            onClick={onPick}
            type="button"
          >
            {uploading ? "Guardando…" : "Arrastrá una imagen acá o tocá para elegirla"}
          </button>
        )}
      </div>
      {hint && <p className="mt-1.5 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

/** @summary Fila con miniatura, reemplazo, reordenamiento y eliminación para listas de imágenes. */
function ImageRow({
  image,
  onReplace,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  image: string;
  onReplace: (file: File) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-2">
      <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-black/40">
        {image ? <Image src={image} alt="" fill unoptimized className="object-cover" /> : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
        {onMoveUp && (
          <button className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs" onClick={onMoveUp} type="button" aria-label="Subir">
            ↑
          </button>
        )}
        {onMoveDown && (
          <button className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs" onClick={onMoveDown} type="button" aria-label="Bajar">
            ↓
          </button>
        )}
        <button
          className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-bold hover:bg-white/10"
          onClick={() => pickFile(onReplace)}
          type="button"
        >
          Reemplazar
        </button>
        <button className="rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs font-bold text-red-300" onClick={onRemove} type="button">
          Quitar
        </button>
      </div>
    </div>
  );
}

/** @summary Botón para agregar un elemento nuevo mediante selector de archivos. */
function DropAddButton({ label, onPick }: { label: string; onPick: () => void }) {
  return (
    <button
      className="w-full rounded-2xl border-2 border-dashed border-white/15 p-4 text-sm font-bold text-zinc-400 transition hover:border-pink-500/40 hover:text-pink-200"
      onClick={onPick}
      type="button"
    >
      + {label}
    </button>
  );
}