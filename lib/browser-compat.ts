const volatileLocalStorage = new Map<string, string>();
const volatileSessionStorage = new Map<string, string>();

type StorageKind = "local" | "session";

/** @summary Obtiene el almacenamiento nativo disponible sin provocar errores en Safari privado o contextos restringidos. */
function nativeStorage(kind: StorageKind) {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/** @summary Recupera un texto local y utiliza memoria temporal cuando el navegador bloquea la persistencia. */
export function readBrowserText(key: string, kind: StorageKind = "local") {
  const fallback = kind === "local" ? volatileLocalStorage : volatileSessionStorage;
  try {
    return nativeStorage(kind)?.getItem(key) ?? fallback.get(key) ?? null;
  } catch {
    return fallback.get(key) ?? null;
  }
}

/** @summary Guarda un texto en el dispositivo y mantiene una copia temporal compatible con navegación privada. */
export function writeBrowserText(key: string, value: string, kind: StorageKind = "local") {
  const fallback = kind === "local" ? volatileLocalStorage : volatileSessionStorage;
  fallback.set(key, value);
  try {
    nativeStorage(kind)?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** @summary Elimina una preferencia tanto del almacenamiento persistente como de su respaldo temporal. */
export function removeBrowserText(key: string, kind: StorageKind = "local") {
  const fallback = kind === "local" ? volatileLocalStorage : volatileSessionStorage;
  fallback.delete(key);
  try {
    nativeStorage(kind)?.removeItem(key);
  } catch {
    // El respaldo temporal ya fue eliminado y la interfaz puede continuar normalmente.
  }
}

/** @summary Lee información JSON local, valida su estructura básica y devuelve un valor seguro ante datos dañados. */
export function readBrowserJson<T>(key: string, fallback: T, kind: StorageKind = "local"): T {
  const stored = readBrowserText(key, kind);
  if (!stored) return fallback;
  try {
    return JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
}

/** @summary Serializa información JSON sin interrumpir la experiencia cuando el dispositivo limita el espacio local. */
export function writeBrowserJson(key: string, value: unknown, kind: StorageKind = "local") {
  try {
    return writeBrowserText(key, JSON.stringify(value), kind);
  } catch {
    return false;
  }
}

/** @summary Genera un identificador compatible también con navegadores móviles servidos mediante una red local HTTP. */
export function createBrowserId() {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
    if (typeof globalThis.crypto?.getRandomValues === "function") {
      const values = globalThis.crypto.getRandomValues(new Uint32Array(4));
      return Array.from(values, (value) => value.toString(16).padStart(8, "0")).join("-");
    }
  } catch {
    // Continúa con una clave local suficientemente única para identificar una línea del carrito.
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** @summary Copia texto con la API moderna o con una alternativa compatible con Safari y conexiones HTTP locales. */
export async function copyBrowserText(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Safari puede exponer la API y rechazarla fuera de un contexto HTTPS.
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.readOnly = true;
  input.style.position = "fixed";
  input.style.inset = "-9999px auto auto -9999px";
  document.body.appendChild(input);
  input.select();
  input.setSelectionRange(0, value.length);
  const copied = document.execCommand("copy");
  input.remove();
  return copied;
}
