import { logger } from "@/lib/logger";

type SafeQueryOptions<T> = {
  /** Nombre lógico para logging (ej: "delivery.list", "branch.findMany") */
  name: string;
  /** Si es true y la query falla, relanza el error. Default: false */
  required?: boolean;
  /** Valor de fallback cuando la query falla y no es required */
  fallback: T;
  /** Contexto adicional para logging (tenantId, branchId, etc.) */
  context?: Record<string, unknown>;
  /** La query a ejecutar */
  query: () => Promise<T>;
};

/**
 * Ejecuta una query de Prisma con manejo de errores estructurado.
 * Si la query falla:
 * - Si `required` es true, relanza el error.
 * - Si `required` es false (default), devuelve `fallback` y loguea el error.
 *
 * Logging incluye: module, query name, error code, message y contexto.
 */
export async function safeQuery<T>({
  name,
  required = false,
  fallback,
  context,
  query,
}: SafeQueryOptions<T>): Promise<T> {
  try {
    return await query();
  } catch (error: unknown) {
    const fields: Record<string, unknown> = { query: name, ...context };

    if (error && typeof error === "object" && "code" in error) {
      fields.prismaCode = (error as { code: string }).code;
    }
    if (error && typeof error === "object" && "meta" in error) {
      fields.meta = (error as { meta: unknown }).meta;
    }
    if (error instanceof Error) {
      fields.message = error.message;
    }

    logger.error(`[safeQuery] ${name} failed`, fields);

    if (required) throw error;
    return fallback;
  }
}
