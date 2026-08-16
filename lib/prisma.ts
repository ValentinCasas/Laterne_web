import { PrismaClient } from "@prisma/client";
import { getConfig } from "@/lib/config";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Construye la URL de conexión con límites de pool explícitos.
 *
 * Multiplicá por réplicas: `max_connections_estimadas = réplicas × connection_limit`.
 * El límite por defecto es acotado (10) para no agotar `max_connections` de MySQL
 * cuando se corren varias instancias detrás de un load balancer.
 */
function buildDatabaseUrl() {
  const { databaseUrl, prismaConnectionLimit, prismaPoolTimeoutSeconds } = getConfig();
  if (!databaseUrl) return undefined;
  const url = new URL(databaseUrl);
  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", String(prismaConnectionLimit));
  }
  if (!url.searchParams.has("pool_timeout")) {
    url.searchParams.set("pool_timeout", String(prismaPoolTimeoutSeconds));
  }
  return url.toString();
}

function createPrisma() {
  const url = buildDatabaseUrl();
  return url
    ? new PrismaClient({ datasources: { db: { url } } })
    : new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;