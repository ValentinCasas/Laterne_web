import { assertStartupConfig, isDevelopment } from "@/lib/config";
import { logger } from "@/lib/logger";

/**
 * Instrumentación de arranque del servidor.
 *
 * - Valida la configuración crítica antes de recibir tráfico (fail-fast en
 *   producción, advertencia en desarrollo).
 * - Instala handlers para errores asíncronos no capturados: se registran con
 *   logs estructurados y, en producción, el proceso termina para que el
 *   orquestador lo reinicie limpio (nunca se sigue con un proceso corrupto).
 * - Maneja SIGTERM/SIGINT para un shutdown graceful: se cierra Prisma y se
 *   deja drenar el tráfico en curso (Next.js ya gestiona la finalización de
 *   requests). Un timeout fuerza la salida si algo se queda colgado.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Durante `next build` no se exige la base de datos ni el secreto.
  if (process.env.NEXT_PHASE !== "phase-production-build") {
    assertStartupConfig();
  }

  installProcessErrorHandlers();
  installSignalHandlers();

  logger.info("server_start", {
    nodeEnv: process.env.NODE_ENV,
    nodeVersion: process.version,
    pid: process.pid,
  });
}

/** @summary Registra errores fatales y decide si el proceso debe terminar. */
function installProcessErrorHandlers() {
  process.on("uncaughtException", (error) => {
    logger.error("uncaught_exception", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    if (!isDevelopment) process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("unhandled_rejection", {
      reason:
        reason instanceof Error
          ? { message: reason.message, stack: reason.stack, name: reason.name }
          : String(reason),
    });
    if (!isDevelopment) process.exit(1);
  });
}

let shuttingDown = false;

/** @summary Cierra Prisma y permite que Next.js drene las requests antes de salir. */
function handleShutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("shutdown_start", { signal });

  const forceExit = setTimeout(() => {
    logger.error("shutdown_forced");
    process.exit(1);
  }, 30_000);
  forceExit.unref();

  import("@/lib/prisma")
    .then(({ prisma }) => prisma.$disconnect().catch(() => undefined))
    .catch(() => undefined);
}

/** @summary Reacciona a SIGTERM/SIGINT (detención limpia del container). */
function installSignalHandlers() {
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));
}