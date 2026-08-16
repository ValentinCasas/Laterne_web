import { LeadBoard } from "@/components/admin/lead-board";
import { requireSuperAdmin } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/** @summary Carga las solicitudes de demostración recibidas y las organiza por etapa comercial. */
export default async function PlatformOpportunitiesPage() {
  await requireSuperAdmin();
  const leads = await prisma.salesLead.findMany({
    include: { plan: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return (
    <LeadBoard
      initialLeads={leads.map((lead) => ({
        ...serialize(lead),
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
        requiredFeatures: Array.isArray(lead.requiredFeatures)
          ? lead.requiredFeatures.filter((feature): feature is string => typeof feature === "string")
          : null,
      }))}
    />
  );
}
