import type { ComandaData } from "@/lib/comanda";

/**
 * Contrato de impresión de MenuClick.
 *
 * Define los tipos y la interfaz que usarán los futuros proveedores de impresión
 * (Ethernet, Bluetooth, USB o servicio local). Hoy el registro está VACÍO a
 * propósito: no hay drivers, conexiones ni colas operativas. Cuando exista una
 * implementación real solo hay que registrarla en `registerPrintProvider` y el
 * resto de la arquitectura (áreas, destinos, comandas, cola) ya está preparada.
 */

export const printDestinationTypes = ["ETHERNET", "BLUETOOTH", "USB", "LOCAL_SERVICE"] as const;
export type PrintDestinationType = (typeof printDestinationTypes)[number];

/** @summary Etiquetas legibles de los tipos de conexión de destino. */
export const printDestinationTypeLabel: Record<PrintDestinationType, string> = {
  ETHERNET: "Ethernet / red",
  BLUETOOTH: "Bluetooth",
  USB: "USB",
  LOCAL_SERVICE: "Servicio local",
};

export const printJobStatuses = ["pending", "processing", "printed", "failed", "cancelled"] as const;
export type PrintJobStatus = (typeof printJobStatuses)[number];

/** @summary Etiquetas legibles del estado conceptual de una comanda en cola. */
export const printJobStatusLabel: Record<PrintJobStatus, string> = {
  pending: "En espera",
  processing: "Enviando",
  printed: "Impreso",
  failed: "Fallido",
  cancelled: "Cancelado",
};

/** @summary Contenido estructurado de una comanda, independiente del formato físico. */
export type PrintJobPayload = ComandaData;

/** @summary Un trabajo de impresión dirigido a un destino concreto. */
export type PrintDispatch = {
  destination: {
    id: number;
    name: string;
    type: PrintDestinationType;
    connection: string | null;
  };
  payload: PrintJobPayload;
};

/** @summary Resultado de un envío: éxito o error legible para reintentos futuros. */
export type PrintResult = { ok: true } | { ok: false; error: string };

/** @summary Interfaz mínima que debe implementar todo proveedor de impresión futuro. */
export interface PrintProvider {
  readonly type: PrintDestinationType;
  /** Nombre comercial o descriptivo del proveedor. */
  readonly label: string;
  /** Envía una comanda estructurada al destino configurado. */
  send(dispatch: PrintDispatch): Promise<PrintResult>;
}

/** @summary Registro de proveedores disponibles, vacío hasta que exista una integración real. */
const providers = new Map<PrintDestinationType, PrintProvider>();

/** @summary Registra un proveedor de impresión implementado. */
export function registerPrintProvider(provider: PrintProvider) {
  providers.set(provider.type, provider);
}

/** @summary Devuelve el proveedor registrado para un tipo de destino, o null si no existe. */
export function resolvePrintProvider(type: PrintDestinationType): PrintProvider | null {
  return providers.get(type) ?? null;
}

/** @summary Devuelve los proveedores registrados actualmente (hoy: ninguno). */
export function registeredPrintProviders(): PrintProvider[] {
  return [...providers.values()];
}
