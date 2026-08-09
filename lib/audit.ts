import type { Prisma } from "@prisma/client";
import type { AuthorizationContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AuditInput = {
  context: AuthorizationContext;
  action: string;
  entityType: string;
  entityId?: string | number;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
  request?: Request;
  result?: string;
};

/** @summary Convierte fechas, decimales y valores grandes en contenido JSON apto para auditoría. */
export function toAuditValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item)),
  ) as Prisma.InputJsonValue;
}

/** @summary Recupera una referencia de red sin conservar encabezados completos de la solicitud. */
function requestAddress(request?: Request) {
  if (!request) return null;
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null
  );
}

/** @summary Registra una operación administrativa para poder reconstruir cambios sensibles. */
export async function recordAudit(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      tenantId: input.context.tenant.id,
      userId: input.context.session.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId === undefined ? null : String(input.entityId),
      oldValues: input.oldValues,
      newValues: input.newValues,
      ipAddress: requestAddress(input.request),
      result: input.result ?? "success",
    },
  });
}
