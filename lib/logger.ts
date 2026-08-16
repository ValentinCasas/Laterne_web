import { isDevelopment } from "@/lib/config";

export type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

/**
 * Logging estructurado hacia stdout/stderr.
 *
 * En producción emite una línea JSON por evento con timestamp y nivel, para que
 * un recolector (Docker logs, Loki, etc.) la consuma sin post-procesamiento.
 * En desarrollo imprime texto legible. Nunca se escriben secretos.
 */
function write(level: LogLevel, message: string, fields: LogFields = {}) {
  const timestamp = new Date().toISOString();
  if (isDevelopment) {
    const summary = Object.keys(fields).length
      ? ` ${JSON.stringify(fields)}`
      : "";
    const line = `[${timestamp}] ${level.toUpperCase()} ${message}${summary}`;
    if (level === "error") process.stderr.write(`${line}\n`);
    else process.stdout.write(`${line}\n`);
    return;
  }
  const line = JSON.stringify({ timestamp, level, message, ...fields });
  if (level === "error") process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

/** @summary Convierte un motivo de rechazo desconocido en un objeto serializable. */
function reasonToFields(reason: unknown): LogFields {
  if (reason instanceof Error) {
    return { message: reason.message, stack: reason.stack, name: reason.name };
  }
  if (typeof reason === "object" && reason !== null) return { reason };
  return { reason: String(reason) };
}

export const logger = {
  debug(message: string, fields: LogFields = {}) {
    write("debug", message, fields);
  },
  info(message: string, fields: LogFields = {}) {
    write("info", message, fields);
  },
  warn(message: string, fields: LogFields = {}) {
    write("warn", message, fields);
  },
  error(message: string, fields: LogFields = {}) {
    write("error", message, fields);
  },
  errorFromUnknown(message: string, reason: unknown) {
    write("error", message, reasonToFields(reason));
  },
};

/** @summary Serializa un motivo de rechazo sin exponer datos sensibles. */
export { reasonToFields };