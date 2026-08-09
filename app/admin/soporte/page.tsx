import { SupportBoard, type SupportTicketData } from "@/components/admin/support-board";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/** @summary Carga las consultas de soporte del negocio para su seguimiento interno. */
export default async function SupportPage() {
  const context = await requirePermission("support.manage");
  const tickets = await prisma.supportTicket.findMany({
    where: { tenantId: context.tenant.id },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return <SupportBoard initialTickets={serialize(tickets) as unknown as SupportTicketData[]} />;
}
