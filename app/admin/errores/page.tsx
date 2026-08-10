import { ErrorLogManager } from "@/components/admin/error-log-manager";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** @summary Carga los incidentes técnicos recientes del tenant para su seguimiento operativo. */
export default async function ErrorLogsPage() {
  const context = await requirePermission("audit.read");
  const errors = await prisma.errorLog.findMany({
    where: { tenantId: context.tenant.id },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return (
    <ErrorLogManager
      initialErrors={serialize(errors) as unknown as Parameters<typeof ErrorLogManager>[0]["initialErrors"]}
    />
  );
}
