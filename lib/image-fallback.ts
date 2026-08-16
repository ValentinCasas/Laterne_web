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

/** @summary Extensión de imagen que los gestores de archivos aceptan para la carta. */
const IMAGE_FILE_PATTERN = /^[\w\-. ]+\.(png|jpe?g|webp|avif|gif)$/i;

/**
 * @summary Devuelve la URL pública de la imagen de un producto o el respaldo si no es un archivo válido.
 *
 * Algunos registros históricos guardaron texto libre (nombres, rutas rotas) en
 * `imageUrl`. Esta función evita renderizar imágenes rotas o texto ALT encima
 * de la interfaz: solo trata como imagen un nombre de archivo con extensión
 * conocida; todo lo demás usa el placeholder de producto.
 */
export function productImageSrc(imageUrl: string | null | undefined): string {
  const value = (imageUrl ?? "").trim();
  if (!value || DEFAULT_IMAGE_PLACEHOLDERS.has(value)) return PRODUCT_IMAGE_FALLBACK;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/")) return value;
  if (!IMAGE_FILE_PATTERN.test(value)) return PRODUCT_IMAGE_FALLBACK;
  return `/images/images_product/${value}`;
}

/** @summary Devuelve la URL pública de un modelo 3D normalizando el formato histórico almacenado. */
export function modelPublicUrl(value: string | null | undefined): string {
  const model = (value ?? "").trim();
  if (!model) return "";
  if (/^(?:https?:)?\/\//i.test(model)) return model.replace(/^https?:\/\//i, "");
  return model.startsWith("/") ? model : `/${model}`;
}

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
