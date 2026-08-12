import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  buildTimeSlots,
  defaultReservationTimeZone,
  reservationAddressHash,
  reservationReference,
  reservationTime,
  timeText,
  zoneOffset,
} from "@/lib/reservations";
import { getDefaultTenant } from "@/lib/tenant";
import { isBranchOperational } from "@/lib/branch";

const reservationInput = z.object({
  customerName: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(6).max(60),
  email: z
    .string()
    .trim()
    .email()
    .max(190)
    .transform((value) => value.toLowerCase()),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  partySize: z.coerce.number().int().min(1).max(100),
  sector: z.string().trim().max(100).optional(),
  reason: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(1500).optional(),
  acceptedPolicy: z.literal(true),
  website: z.string().max(0).optional(),
  branchSlug: z.string().trim().max(120).optional(),
});

/** @summary Recupera la dirección de red declarada por el proxy para aplicar controles de abuso. */
function requestAddress(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** @summary Reduce la procedencia de la solicitud a una ruta breve apta para informes. */
function requestSource(request: Request) {
  const referer = request.headers.get("referer");
  if (!referer) return "website";
  try {
    return new URL(referer).pathname.slice(0, 60) || "website";
  } catch {
    return "website";
  }
}

/** @summary Indica que la franja seleccionada perdió capacidad durante la confirmación. */
class ReservationCapacityError extends Error {}

/** @summary Comprueba si una franja se encuentra dentro de un bloqueo total o parcial. */
function blockedTime(time: string, blocks: Array<{ startTime: Date | null; endTime: Date | null }>) {
  return blocks.some((block) => {
    if (!block.startTime || !block.endTime) return true;
    return time >= timeText(block.startTime) && time <= timeText(block.endTime);
  });
}

/** @summary Genera una referencia de reserva que todavía no exista en la base. */
async function uniqueReference() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const reference = reservationReference();
    const exists = await prisma.reservation.findUnique({ where: { reference }, select: { id: true } });
    if (!exists) return reference;
  }
  throw new Error("No se pudo generar la referencia de reserva");
}

/** @summary Informa franjas disponibles, sectores y políticas para una fecha determinada. */
export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Indicá una fecha válida" }, { status: 400 });
  }
  const tenant = await getDefaultTenant();
  const requestedBranchSlug = new URL(request.url).searchParams.get("branch") ?? "";
  const timeZone = tenant.timeZone ?? defaultReservationTimeZone;
  const offset = zoneOffset(timeZone);
  const selectedDate = new Date(`${date}T00:00:00${offset}`);
  const primaryBranch = await prisma.branch.findFirst({
    where: { tenantId: tenant.id, active: true, ...(requestedBranchSlug ? { slug: requestedBranchSlug } : {}) },
    orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
    select: { id: true },
  });
  if (!primaryBranch || !(await isBranchOperational(tenant.id, primaryBranch.id))) return NextResponse.json({ slots: [], sectors: [], policy: null, disabled: true });
  const branchWhere = primaryBranch ? { branchId: primaryBranch.id } : {};
  const [settings, hours, blocks, reservations] = await Promise.all([
    prisma.reservationSettings.findUnique({ where: { tenantId: tenant.id } }),
    prisma.openingHour.findMany({ where: { tenantId: tenant.id, ...branchWhere } }),
    prisma.reservationBlock.findMany({
      where: { tenantId: tenant.id, ...branchWhere, startDate: { lte: selectedDate }, endDate: { gte: selectedDate } },
    }),
    prisma.reservation.findMany({
      where: {
        tenantId: tenant.id,
        branchId: primaryBranch?.id,
        reservationDate: selectedDate,
        status: { in: ["pending", "confirmed"] },
      },
      select: { reservationTime: true, partySize: true },
    }),
  ]);
  if (!settings?.enabled) {
    return NextResponse.json({ slots: [], sectors: [], policy: settings?.policy, disabled: true });
  }

  const dayName = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    timeZone,
  })
    .format(selectedDate)
    .toLocaleLowerCase("es");
  const opening = hours.find((item) => item.dayOfWeek.toLocaleLowerCase("es").includes(dayName));
  const ranges: Array<[string, string]> = [];
  if (opening?.morningStartTime && opening.morningEndTime) {
    ranges.push([timeText(opening.morningStartTime), timeText(opening.morningEndTime)]);
  }
  if (opening?.eveningStartTime && opening.eveningEndTime) {
    ranges.push([timeText(opening.eveningStartTime), timeText(opening.eveningEndTime)]);
  }
  if (!ranges.length) ranges.push(["18:00", "23:30"]);
  const occupied = new Map<string, number>();
  for (const reservation of reservations) {
    const key = timeText(reservation.reservationTime);
    occupied.set(key, (occupied.get(key) ?? 0) + reservation.partySize);
  }
  const now = new Date();
  const slots = ranges
    .flatMap(([start, end]) => buildTimeSlots(start, end, settings.slotInterval))
    .filter((time, index, values) => values.indexOf(time) === index)
    .filter(
      (time) =>
        new Date(`${date}T${time}:00${offset}`).getTime() >=
        now.getTime() + settings.minimumLeadHours * 3_600_000,
    )
    .filter((time) => !blockedTime(time, blocks))
    .map((time) => ({ time, remaining: Math.max(0, settings.capacityPerSlot - (occupied.get(time) ?? 0)) }))
    .filter((slot) => slot.remaining > 0);

  return NextResponse.json({
    slots,
    sectors: Array.isArray(settings.sectors) ? settings.sectors : [],
    policy: settings.policy,
    maximumPartySize: settings.maximumPartySize,
  });
}

/** @summary Valida disponibilidad, guarda una reserva y genera un aviso para administración. */
export async function POST(request: Request) {
  const parsed = reservationInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Revisá los datos obligatorios de la reserva" }, { status: 400 });
  }
  if (parsed.data.website) return NextResponse.json({ ok: true }, { status: 201 });
  const tenant = await getDefaultTenant();
  const branch =
    parsed.data.branchSlug
      ? await prisma.branch.findFirst({ where: { tenantId: tenant.id, slug: parsed.data.branchSlug, active: true } })
      :
    (await prisma.branch.findFirst({
      where: { tenantId: tenant.id, active: true },
      orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
      select: { id: true },
    })) ?? null;
  if (parsed.data.branchSlug && !branch) return NextResponse.json({ error: "La sucursal no está disponible" }, { status: 409 });
  if (branch && !(await isBranchOperational(tenant.id, branch.id))) return NextResponse.json({ error: "La sucursal no está operativa" }, { status: 409 });
  const settings = await prisma.reservationSettings.findUnique({ where: { tenantId: tenant.id } });
  if (!settings?.enabled) {
    return NextResponse.json(
      { error: "Las reservas online no están disponibles temporalmente" },
      { status: 503 },
    );
  }
  if (parsed.data.partySize > settings.maximumPartySize) {
    return NextResponse.json(
      { error: `Para grupos de más de ${settings.maximumPartySize} personas, contactanos directamente.` },
      { status: 400 },
    );
  }

  const timeZone = tenant.timeZone ?? defaultReservationTimeZone;
  const offset = zoneOffset(timeZone);
  const selectedDate = new Date(`${parsed.data.date}T00:00:00${offset}`);
  const selectedDateTime = new Date(`${parsed.data.date}T${parsed.data.time}:00${offset}`);
  const now = new Date();
  if (selectedDateTime.getTime() < now.getTime() + settings.minimumLeadHours * 3_600_000) {
    return NextResponse.json({ error: "Ese horario ya no posee anticipación suficiente" }, { status: 409 });
  }
  if (selectedDateTime.getTime() > now.getTime() + settings.maximumAdvanceDays * 86_400_000) {
    return NextResponse.json(
      { error: "La fecha supera el período habilitado para reservas" },
      { status: 400 },
    );
  }

  const ipHash = reservationAddressHash(requestAddress(request));
  const recentRequests = await prisma.reservation.count({
    where: { ipHash, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recentRequests >= 5) {
    return NextResponse.json({ error: "Alcanzaste el límite temporal de solicitudes" }, { status: 429 });
  }
  const [blocks] = await Promise.all([
    prisma.reservationBlock.findMany({
      where: {
           tenantId: tenant.id,
           branchId: branch?.id ?? null,
        ...(branch ? { branchId: branch.id } : {}),
        startDate: { lte: selectedDate },
        endDate: { gte: selectedDate },
      },
    }),
  ]);
  if (blockedTime(parsed.data.time, blocks)) {
    return NextResponse.json({ error: "Ese horario se encuentra bloqueado" }, { status: 409 });
  }

  const status = settings.confirmationMode === "automatic" ? "confirmed" : "pending";
  const reference = await uniqueReference();
  try {
    await prisma.$transaction(async (transaction) => {
      // Bloquea la fila de configuración del negocio para serializar las escrituras
      // sobre la misma franja y evitar que dos solicitudes simultáneas sobrevendan la capacidad.
      await transaction.$queryRaw`SELECT id FROM reservationsettings WHERE tenantId = ${tenant.id} FOR UPDATE`;
      const occupied = await transaction.reservation.aggregate({
        where: {
          tenantId: tenant.id,
          reservationDate: selectedDate,
          reservationTime: reservationTime(parsed.data.time),
          status: { in: ["pending", "confirmed"] },
        },
        _sum: { partySize: true },
      });
      if ((occupied._sum.partySize ?? 0) + parsed.data.partySize > settings.capacityPerSlot) {
        throw new ReservationCapacityError();
      }
      const reservation = await transaction.reservation.create({
        data: {
          tenantId: tenant.id,
          branchId: branch?.id ?? null,
          reference,
          status,
          reservationDate: selectedDate,
          reservationTime: reservationTime(parsed.data.time),
          partySize: parsed.data.partySize,
          sector: parsed.data.sector || null,
          customerName: parsed.data.customerName,
          phone: parsed.data.phone,
          email: parsed.data.email,
          notes: parsed.data.notes || null,
          reason: parsed.data.reason || null,
          acceptedPolicy: true,
          source: requestSource(request),
          ipHash,
          estimatedDuration: settings.defaultDuration,
        },
      });
      await transaction.reservationStatusHistory.create({
        data: { reservationId: reservation.id, toStatus: status, note: "Solicitud creada desde la web" },
      });
      await transaction.notification.create({
        data: {
          tenantId: tenant.id,
          branchId: branch?.id ?? null,
          type: "reservation.new",
          title: `Nueva reserva · ${parsed.data.customerName}`,
          message: `${parsed.data.partySize} personas el ${parsed.data.date} a las ${parsed.data.time}.`,
          link: "/admin/reservas",
        },
      });
    });
  } catch (error) {
    if (error instanceof ReservationCapacityError) {
      return NextResponse.json(
        { error: "La franja seleccionada ya no tiene capacidad suficiente" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "No se pudo concretar la reserva" }, { status: 409 });
  }

  return NextResponse.json({ ok: true, reference, status }, { status: 201 });
}
