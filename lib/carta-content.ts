/**
 * Tipos, defaults y normalización del contenido editable de la carta virtual.
 *
 * Solo se editan los TEXTOS de la cabecera: el fondo, los colores, el diseño de
 * tarjetas y los íconos dependen del tema/marca del negocio y no se tocan acá.
 *
 * Este módulo NO importa node:fs, node:path ni prisma: puede importarse desde
 * componentes client (preview del editor) y server (páginas públicas).
 */

export type CartaHeaderConfig = {
  /** Línea superior (eyebrow): "Cervezas · Cocina · Momentos". */
  eyebrow: string;
  /** Título principal de la cabecera: "Carta". */
  title: string;
  /** Palabra destacada del título; si queda vacía se usa el nombre del negocio. */
  highlight: string;
  /** Descripción debajo del título. */
  description: string;
  /** Texto del botón principal que lleva a los productos. */
  primaryButton: string;
  /** Texto del botón del pedido (la cantidad se agrega en tiempo real). */
  cartButton: string;
};

export const CARTA_HEADER_DEFAULTS: CartaHeaderConfig = {
  eyebrow: "Cervezas · Cocina · Momentos",
  title: "Carta",
  highlight: "",
  description: "Recorré las categorías, elegí tus favoritos y armá tu pedido.",
  primaryButton: "Ver carta",
  cartButton: "Pedido",
};

/** @summary Normaliza la configuración guardada de la cabecera combinándola con los defaults. */
export function resolveCartaHeaderConfig(raw: unknown): CartaHeaderConfig {
  const source =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const text = (value: unknown, max: number, fallback: string) =>
    typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
  return {
    eyebrow: text(source.eyebrow, 120, CARTA_HEADER_DEFAULTS.eyebrow),
    title: text(source.title, 120, CARTA_HEADER_DEFAULTS.title),
    highlight: text(source.highlight, 120, ""),
    description: text(source.description, 500, CARTA_HEADER_DEFAULTS.description),
    primaryButton: text(source.primaryButton, 60, CARTA_HEADER_DEFAULTS.primaryButton),
    cartButton: text(source.cartButton, 60, CARTA_HEADER_DEFAULTS.cartButton),
  };
}
