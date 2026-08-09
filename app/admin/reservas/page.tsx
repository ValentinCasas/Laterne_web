import {
  ReservationBoard,
  type ReservationBlockData,
  type ReservationItem,
  type ReservationSettingsData,
} from "@/components/admin/reservation-board";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** @summary Carga reservas, reglas y bloqueos del negocio para su administración integral. */
export default async function AdminReservationsPage() {
  const context = await requirePermission("reservation.manage");
  const [reservations, settings, blocks] = await Promise.all([
    prisma.reservation.findMany({
      where: { tenantId: context.tenant.id },
      orderBy: [{ reservationDate: "asc" }, { reservationTime: "asc" }],
      take: 1000,
    }),
    prisma.reservationSettings.findUnique({ where: { tenantId: context.tenant.id } }),
    prisma.reservationBlock.findMany({
      where: { tenantId: context.tenant.id },
      orderBy: { startDate: "desc" },
      take: 100,
    }),
  ]);
  const fallbackSettings = {
    enabled: true,
    capacityPerSlot: 30,
    slotInterval: 30,
    minimumLeadHours: 2,
    maximumAdvanceDays: 60,
    maximumPartySize: 20,
    defaultDuration: 120,
    sectors: ["Salón", "Exterior"],
    policy: "La reserva queda pendiente hasta recibir confirmación.",
    confirmationMode: "manual",
  };

  return (
    <ReservationBoard
      initialReservations={serialize(reservations) as unknown as ReservationItem[]}
      initialSettings={serialize(settings ?? fallbackSettings) as unknown as ReservationSettingsData}
      initialBlocks={serialize(blocks) as unknown as ReservationBlockData[]}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}
