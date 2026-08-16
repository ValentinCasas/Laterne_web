import type { SyntheticEvent } from "react";

/** @summary Imagen por defecto de un producto cuando el archivo referenciado no existe o falta. */
export const PRODUCT_IMAGE_FALLBACK = "/images/image_defect/product_default.png";

/** @summary Nombre del archivo por defecto de categoría dentro de `images_categories`. */
export const CATEGORY_IMAGE_FALLBACK_FILE = "bottle-1-svgrepo-com.png";

/** @summary Ruta pública de la imagen por defecto de categoría. */
export const CATEGORY_IMAGE_FALLBACK = `/images/images_categories/${CATEGORY_IMAGE_FALLBACK_FILE}`;

/** @summary Rutas públicas de imágenes por defecto que no viven en la carpeta del recurso. */
export const DEFAULT_IMAGE_PLACEHOLDERS = new Set([
  "product_default.png",
  "avatar_profile_default.png",
  "default.png",
]);

/**
 * @summary Sustituye una imagen fallida por el recurso de respaldo apropiado.
 *
 * Maneja el error de carga de una imagen con un único reintento hacia un recurso de respaldo.
 *
 * - Primera vez: reemplaza `src` por `data-fallback-src` (o el respaldo de producto).
 * - Si el respaldo también falla: no se vuelve a intentar (marca `data-image-error-handled`).
 *
 * No usa estado ni dispara renders, así que nunca puede provocar un loop
 * `onError → setState → render → misma src rota`. Usado con `<Image onError={handleImageError}>`.
 */
export function handleImageError(event: SyntheticEvent<HTMLImageElement>) {
  const img = event.currentTarget;
  if (img.dataset.imageErrorHandled === "true") return;
  img.dataset.imageErrorHandled = "true";
  const fallback = img.dataset.fallbackSrc || PRODUCT_IMAGE_FALLBACK;
  if (fallback !== img.currentSrc) img.src = fallback;
}
