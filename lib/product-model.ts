const orientationPattern = /^-?\d+(?:\.\d+)?deg\s+-?\d+(?:\.\d+)?deg\s+-?\d+(?:\.\d+)?deg$/;

/** @summary Valida que un modelo pertenezca al espacio público aislado del negocio. */
export function localModelUrl(value: string, tenantId: number, extensions: string[]) {
  const normalized = value.trim();
  if (!normalized) return null;
  const prefix = `/models/${tenantId}/products/`;
  const extension = normalized.split(".").pop()?.toLowerCase();
  if (!normalized.startsWith(prefix) || !extension || !extensions.includes(extension)) {
    throw new Error("El modelo debe cargarse desde el gestor seguro de este negocio");
  }
  return normalized;
}

/** @summary Convierte una medida opcional y comprueba que se encuentre dentro de límites realistas. */
export function optionalMeasurement(value: string, minimum = 0.1, maximum = 1000) {
  if (!value.trim()) return null;
  const measurement = Number(value);
  if (!Number.isFinite(measurement) || measurement < minimum || measurement > maximum) {
    throw new Error(`La medida debe estar entre ${minimum} y ${maximum}`);
  }
  return measurement;
}

/** @summary Normaliza una rotación Euler expresada como tres ángulos seguros en grados. */
export function modelOrientation(value: string) {
  const normalized = value.trim() || "0deg 0deg 0deg";
  if (!orientationPattern.test(normalized)) {
    throw new Error("La rotación debe tener tres valores, por ejemplo: 0deg 90deg 0deg");
  }
  return normalized;
}
