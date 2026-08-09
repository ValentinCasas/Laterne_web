import { LeadBoard } from "@/components/admin/lead-board";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/** @summary Carga las solicitudes comerciales y las organiza dentro del tablero de oportunidades. */
export default async function OpportunitiesPage() {
  await requirePermission("lead.manage");
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
