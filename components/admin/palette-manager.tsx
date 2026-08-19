"use client";

import { useState } from "react";
import {
  paletteCssVariables,
  validatePalette,
  type PaletteColors,
  type PalettePreset,
} from "@/lib/theme-palettes";
import { scopedFetch } from "@/lib/client-routing";

export type PaletteRecord = PaletteColors & {
  id: number;
  tenantId: number;
  name: string;
  isSystem: boolean;
  presetKey: string | null;
};

const editableColors: Array<[keyof PaletteColors, string]> = [
  ["primary", "Principal"],
  ["secondary", "Secundario"],
  ["accent", "Acento"],
  ["background", "Fondo"],
  ["surface", "Superficie"],
  ["text", "Texto"],
];

/**
 * @summary Devuelve los colores representativos que resumen una paleta.
 */
function swatches(colors: PaletteColors) {
  return [colors.primary, colors.secondary, colors.background, colors.text];
}

/** @summary Editor visual de presets y paletas personalizadas aisladas por tenant. */
export function PaletteManager({
  initialPalettes,
  initialActiveId,
  presets,
}: {
  initialPalettes: PaletteRecord[];
  initialActiveId: number | null;
  presets: PalettePreset[];
}) {
  const [palettes, setPalettes] = useState(initialPalettes);
  const [activeId, setActiveId] = useState(initialActiveId);
  const [draft, setDraft] = useState<PaletteColors>(
    (initialPalettes.find((palette) => palette.id === initialActiveId) ?? presets[0]) as PaletteColors,
  );
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  /**
   * @summary Notifica el resultado de una operación del administrador de paletas.
   */
  function notify(value: string) {
    setMessage(value);
    window.setTimeout(() => setMessage(""), 3500);
  }

  /**
   * @summary Aplica la selección solicitada en el administrador de paletas.
   */
  async function selectPreset(preset: PalettePreset) {
    setBusy(true);
    setMessage("");
    const response = await scopedFetch("/api/admin/palettes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presetKey: preset.key }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      palette?: PaletteRecord;
      activePaletteId?: number;
      error?: string;
    };
    setBusy(false);
    if (!response.ok || !result.palette) return notify(result.error ?? "No se pudo activar la paleta");
    setPalettes((current) =>
      current.some((palette) => palette.id === result.palette!.id) ? current : [...current, result.palette!],
    );
    setActiveId(result.palette.id);
    setDraft(result.palette);
    notify("Paleta aplicada. Actualizando la interfaz…");
    window.setTimeout(() => window.location.reload(), 250);
  }

  /**
   * @summary Aplica la selección solicitada en el administrador de paletas.
   */
  async function selectSaved(palette: PaletteRecord) {
    setBusy(true);
    const response = await scopedFetch("/api/admin/palettes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paletteId: palette.id }),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) return notify(result.error ?? "No se pudo activar la paleta");
    setActiveId(palette.id);
    setDraft(palette);
    notify("Paleta activa actualizada. Actualizando la interfaz…");
    window.setTimeout(() => window.location.reload(), 250);
  }

  /**
   * @summary Actualiza el estado del administrador de paletas y conserva su consistencia.
   */
  async function saveAsPalette() {
    const errors = validatePalette(draft);
    if (errors.length) return notify(errors[0]);
    const paletteName = name.trim();
    if (paletteName.length < 2) return notify("Escribí un nombre para la paleta");
    setBusy(true);
    const response = await scopedFetch("/api/admin/palettes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: paletteName, colors: draft }),
    });
    const result = (await response.json().catch(() => ({}))) as { palette?: PaletteRecord; error?: string };
    setBusy(false);
    if (!response.ok || !result.palette) return notify(result.error ?? "No se pudo guardar la paleta");
    setPalettes((current) => [...current, result.palette!]);
    setActiveId(result.palette.id);
    setDraft(result.palette);
    setName("");
    notify("Paleta guardada y aplicada. Actualizando la interfaz…");
    window.setTimeout(() => window.location.reload(), 250);
  }

  /**
   * @summary Actualiza el estado del administrador de paletas y conserva su consistencia.
   */
  async function updatePalette() {
    const current = palettes.find((palette) => palette.id === activeId);
    if (!current || current.isSystem) return;
    const errors = validatePalette(draft);
    if (errors.length) return notify(errors[0]);
    setBusy(true);
    const response = await scopedFetch(`/api/admin/palettes/${current.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colors: draft }),
    });
    const result = (await response.json().catch(() => ({}))) as { palette?: PaletteRecord; error?: string };
    setBusy(false);
    if (!response.ok || !result.palette) return notify(result.error ?? "No se pudo actualizar la paleta");
    setPalettes((items) => items.map((item) => (item.id === current.id ? result.palette! : item)));
    setDraft(result.palette);
    notify("Paleta actualizada. Actualizando la interfaz…");
    window.setTimeout(() => window.location.reload(), 250);
  }

  /**
   * @summary Actualiza el estado del administrador de paletas y conserva su consistencia.
   */
  async function renamePalette(palette: PaletteRecord) {
    const nextName = window.prompt("Nuevo nombre de la paleta", palette.name)?.trim();
    if (!nextName || nextName === palette.name) return;
    const response = await scopedFetch(`/api/admin/palettes/${palette.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nextName }),
    });
    const result = (await response.json().catch(() => ({}))) as { palette?: PaletteRecord; error?: string };
    if (!response.ok || !result.palette) return notify(result.error ?? "No se pudo renombrar la paleta");
    setPalettes((items) => items.map((item) => (item.id === palette.id ? result.palette! : item)));
  }

  /**
   * @summary Duplica una paleta guardada para editarla sin alterar la original.
   */
  async function duplicatePalette(palette: PaletteRecord | PalettePreset) {
    const response = await scopedFetch("/api/admin/palettes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        "id" in palette
          ? { sourceId: palette.id, name: `${palette.name} personalizada` }
          : { name: `${palette.name} personalizada`, colors: palette },
      ),
    });
    const result = (await response.json().catch(() => ({}))) as { palette?: PaletteRecord; error?: string };
    if (!response.ok || !result.palette) return notify(result.error ?? "No se pudo duplicar la paleta");
    setPalettes((items) => [...items, result.palette!]);
    setActiveId(result.palette.id);
    setDraft(result.palette);
    notify("Copia creada y aplicada.");
  }

  /**
   * @summary Elimina un elemento del administrador de paletas tras las comprobaciones necesarias.
   */
  async function deletePalette(palette: PaletteRecord) {
    if (activeId === palette.id) return notify("Seleccioná otra paleta antes de eliminar la activa.");
    const response = await scopedFetch(`/api/admin/palettes/${palette.id}`, { method: "DELETE" });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) return notify(result.error ?? "No se pudo eliminar la paleta");
    setPalettes((items) => items.filter((item) => item.id !== palette.id));
    notify("Paleta eliminada.");
  }

  const active = palettes.find((palette) => palette.id === activeId);
  const draftErrors = validatePalette(draft);
  return (
    <section className="card p-5 sm:p-7 xl:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-eyebrow">Identidad global</p>
          <h2 className="text-2xl font-black">Apariencia</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-muted)]">
            Una paleta coherente para landing, carta, reservas, pedidos y toda la administración.
          </p>
        </div>
        {message && (
          <p
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text)]"
            role="status"
          >
            {message}
          </p>
        )}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-[var(--color-text-muted)]">
            Paletas predefinidas
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {presets.map((preset) => {
              const saved = palettes.find((palette) => palette.presetKey === preset.key);
              const selected = saved?.id === activeId;
              return (
                <div
                  className={`rounded-2xl border p-3 ${selected ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10" : "border-[var(--color-border)] bg-[var(--color-surface)]"}`}
                  key={preset.key}
                >
                  <button
                    className="flex w-full items-center gap-3 text-left"
                    disabled={busy}
                    onClick={() => void selectPreset(preset)}
                    type="button"
                  >
                    <span className="flex shrink-0 gap-1" aria-hidden="true">
                      {swatches(preset).map((color) => (
                        <i
                          className="h-5 w-5 rounded-full border border-black/20"
                          style={{ backgroundColor: color }}
                          key={color}
                        />
                      ))}
                    </span>
                    <span>
                      <strong className="block text-sm">{preset.name}</strong>
                      <small className="mt-1 block text-xs text-[var(--color-text-muted)]">
                        {preset.description}
                      </small>
                    </span>
                  </button>
                  <button
                    className="mt-3 text-xs font-black text-[var(--color-primary)]"
                    onClick={() => void duplicatePalette(preset)}
                    type="button"
                  >
                    Duplicar y personalizar
                  </button>
                </div>
              );
            })}
          </div>
          <h3 className="mt-8 text-sm font-black uppercase tracking-wider text-[var(--color-text-muted)]">
            Mis paletas
          </h3>
          <div className="mt-3 space-y-2">
            {palettes
              .filter((palette) => !palette.isSystem)
              .map((palette) => (
                <div
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${palette.id === activeId ? "border-[var(--color-primary)]" : "border-[var(--color-border)]"}`}
                  key={palette.id}
                >
                  <button
                    className="flex items-center gap-3 text-left"
                    onClick={() => void selectSaved(palette)}
                    type="button"
                  >
                    <span className="flex gap-1" aria-hidden="true">
                      {swatches(palette).map((color) => (
                        <i
                          className="h-4 w-4 rounded-full border border-black/20"
                          style={{ backgroundColor: color }}
                          key={color}
                        />
                      ))}
                    </span>
                    <strong className="text-sm">{palette.name}</strong>
                  </button>
                  <div className="flex gap-3">
                    <button
                      className="text-xs font-bold text-[var(--color-primary)]"
                      onClick={() => setDraft(palette)}
                      type="button"
                    >
                      Editar
                    </button>
                    <button
                      className="text-xs font-bold text-[var(--color-primary)]"
                      onClick={() => void renamePalette(palette)}
                      type="button"
                    >
                      Renombrar
                    </button>
                    <button
                      className="text-xs font-bold text-[var(--color-danger)]"
                      onClick={() => void deletePalette(palette)}
                      type="button"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            {!palettes.some((palette) => !palette.isSystem) && (
              <p className="rounded-xl border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-text-muted)]">
                Todavía no guardaste paletas personalizadas.
              </p>
            )}
          </div>
        </div>
        <div
          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4"
          style={paletteCssVariables(draft)}
        >
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: draft.accent }}>
            Preview en tiempo real
          </p>
          <div
            className="mt-4 rounded-xl border p-4"
            style={{ borderColor: draft.border, background: draft.surface, color: draft.text }}
          >
            <div className="flex items-center justify-between gap-3">
              <strong>{active?.name ?? "Nueva paleta"}</strong>
              <span
                className="rounded-full px-2 py-1 text-xs"
                style={{ background: draft.success, color: draft.background }}
              >
                Activo
              </span>
            </div>
            <p className="mt-3 text-sm" style={{ color: draft.textMuted }}>
              Botones, links, superficies y estados usan estos tokens.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="rounded-lg px-3 py-2 text-sm font-bold"
                style={{ background: draft.primary, color: draft.background }}
                type="button"
              >
                Botón principal
              </button>
              <a
                className="rounded-lg border px-3 py-2 text-sm font-bold"
                style={{ borderColor: draft.border, color: draft.accent }}
                href="#preview"
              >
                Link
              </a>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {editableColors.map(([key, label]) => (
              <label className="text-xs font-bold" key={key}>
                <span className="mb-1 block" style={{ color: draft.textMuted }}>
                  {label}
                </span>
                <input
                  className="h-10 w-full cursor-pointer rounded-lg border p-1"
                  style={{ background: draft.surfaceElevated, borderColor: draft.border }}
                  type="color"
                  value={draft[key]}
                  onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                />
              </label>
            ))}
          </div>
          {draftErrors.length > 0 && (
            <p
              className="mt-4 rounded-xl border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 p-3 text-xs"
              style={{ color: draft.warning }}
            >
              {draftErrors[0]}
            </p>
          )}
          <div className="mt-5 space-y-3">
            <div className="flex gap-2">
              <input
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nombre de la nueva paleta"
              />
              <button
                className="btn shrink-0"
                disabled={busy}
                onClick={() => void saveAsPalette()}
                type="button"
              >
                Guardar como paleta
              </button>
            </div>
            {active && !active.isSystem && (
              <button
                className="btn btn-secondary w-full"
                disabled={busy}
                onClick={() => void updatePalette()}
                type="button"
              >
                Guardar cambios en {active.name}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
