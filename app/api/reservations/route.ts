import { NextResponse } from "next/server";
import { z } from "zod";
import { isBranchOperational } from "@/lib/branch";
import { prisma } from "@/lib/prisma";
import {
  getReservationAvailability,
  getReservationAvailabilityRange,
  reservationDateValue,
} from "@/lib/reservation-availability";
import { reservationAddressHash, reservationReference } from "@/lib/reservation-security";
import { defaultReservationTimeZone, reservationTime } from "@/lib/reservations";
import { getDefaultTenant } from "@/lib/tenant";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @summary Valida la entrada relacionada con las reservas.
 */
const reservationInput = z.object({
  customerName: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(6).max(60),
  email: z
    .string()
    .trim()
    .email()
    .max(190)
    .transform((value) => value.toLowerCase()),
  date: z.string().regex(datePattern),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  partySize: z.coerce.number().int().min(1).max(100),
  sector: z.string().trim().max(100).optional(),
  reason: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(1500).optional(),
  acceptedPolicy: z.literal(true),
  website: z.string().max(0).optional(),
  branchSlug: z.string().trim().max(120).optional(),
});

/**
 * @summary Obtiene una representación estable de la dirección de origen de la solicitud.
 */
function requestAddress(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * @summary Obtiene el origen identificable de una solicitud pública.
 */
function requestSource(request: Request) {
  const referer = request.headers.get("referer");
  if (!referer) return "website";
  try {
    return new URL(referer).pathname.slice(0, 60) || "website";
  } catch {
    return "website";
  }
}

/**
 * @summary Representa un rechazo de reserva por falta de capacidad disponible.
 */
class ReservationCapacityError extends Error {}

/**
 * @summary Genera una referencia pública que no colisiona con reservas existentes.
 */
async function uniqueReference() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const reference = reservationReference();
    const exists = await prisma.reservation.findUnique({ where: { reference }, select: { id: true } });
    if (!exists) return reference;
  }
  throw new Error("No se pudo generar la referencia de reserva");
}

/**
 * @summary Resuelve la sucursal explícita en la que se solicita la reserva.
 */
async function resolveReservationBranch(tenantId: number, requestedSlug: string) {
  return prisma.branch.findFirst({
    where: { tenantId, active: true, ...(requestedSlug ? { slug: requestedSlug } : {}) },
    orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
    select: { id: true, slug: true },
  });
}

/**
 * @summary Construye el detalle de disponibilidad que acompaña una respuesta de reservas.
 */
function availabilityMetadata(result: Awaited<ReturnType<typeof getReservationAvailability>>) {
  return {
    sectors: result.settings.sectors,
    policy: result.settings.policy,
    maximumPartySize: result.settings.maximumPartySize,
    minimumLeadMinutes: result.settings.minimumLeadMinutes,
    disabled: !result.settings.enabled,
  };
}

/** @summary Publica días o franjas usando la misma fuente del servidor que valida el alta final. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const rawPartySize = Number(params.get("partySize") ?? "1");
  const partySize = Number.isInteger(rawPartySize) && rawPartySize > 0 ? Math.min(rawPartySize, 100) : 1;
  const tenant = await getDefaultTenant();
  const routeBranchSlug =
    request.headers.get("x-menuclick-branch-slug")?.trim().toLocaleLowerCase("es") ?? "";
  const branch = await resolveReservationBranch(tenant.id, routeBranchSlug || params.get("branch") || "");
  if (!branch || !(await isBranchOperational(tenant.id, branch.id))) {
    return NextResponse.json({ slots: [], availableDates: [], sectors: [], policy: null, disabled: true });
  }

  const timeZone = tenant.timeZone ?? defaultReservationTimeZone;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  if (from || to) {
    if (!datePattern.test(from) || !datePattern.test(to) || from > to) {
      return NextResponse.json({ error: "Indicá un rango de fechas válido" }, { status: 400 });
    }
    const rangeDays = Math.round(
      (reservationDateValue(to).getTime() - reservationDateValue(from).getTime()) / 86_400_000,
    );
    if (rangeDays > 62) {
      return NextResponse.json({ error: "El rango de disponibilidad es demasiado amplio" }, { status: 400 });
    }
    const result = await getReservationAvailabilityRange({
      tenantId: tenant.id,
      branchId: branch.id,
      from,
      to,
      partySize,
      sector: params.get("sector"),
      timeZone,
    });
    return NextResponse.json({
      availableDates: result.availableDates,
      sectors: result.settings.sectors,
      policy: result.settings.policy,
      maximumPartySize: result.settings.maximumPartySize,
      minimumLeadMinutes: result.settings.minimumLeadMinutes,
      disabled: !result.settings.enabled,
    });
  }

  const date = params.get("date") ?? "";
  if (!datePattern.test(date)) {
    return NextResponse.json({ error: "Indicá una fecha válida" }, { status: 400 });
  }
  const result = await getReservationAvailability({
    tenantId: tenant.id,
    branchId: branch.id,
    date,
    partySize,
    sector: params.get("sector"),
    timeZone,
  });
  return NextResponse.json({
    slots: result.slots,
    hasAvailability: result.hasAvailability,
    ...availabilityMetadata(result),
  });
}

/** @summary Valida y crea una reserva bajo bloqueo, recalculando exactamente la misma disponibilidad. */
export async function POST(request: Request) {
  const parsed = reservationInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Revisá los datos obligatorios de la reserva" }, { status: 400 });
  }
  if (parsed.data.website) return NextResponse.json({ ok: true }, { status: 201 });

  const tenant = await getDefaultTenant();
  const routeBranchSlug =
    request.headers.get("x-menuclick-branch-slug")?.trim().toLocaleLowerCase("es") || "";
  if (
    routeBranchSlug &&
    parsed.data.branchSlug &&
    parsed.data.branchSlug.toLocaleLowerCase("es") !== routeBranchSlug
  ) {
    return NextResponse.json({ error: "La sucursal de la reserva no coincide con la URL" }, { status: 409 });
  }
  const branch = await resolveReservationBranch(tenant.id, routeBranchSlug || parsed.data.branchSlug || "");
  if (!branch) return NextResponse.json({ error: "La sucursal no está disponible" }, { status: 404 });
  if (!(await isBranchOperational(tenant.id, branch.id))) {
    return NextResponse.json({ error: "La sucursal no está operativa" }, { status: 409 });
  }

  const timeZone = tenant.timeZone ?? defaultReservationTimeZone;
  const initialAvailability = await getReservationAvailability({
    tenantId: tenant.id,
    branchId: branch.id,
    date: parsed.data.date,
    partySize: parsed.data.partySize,
    sector: parsed.data.sector,
    timeZone,
  });
  if (!initialAvailability.settings.enabled) {
    return NextResponse.json(
      { error: "Las reservas online no están disponibles temporalmente" },
      { status: 503 },
    );
  }
  if (parsed.data.partySize > initialAvailability.settings.maximumPartySize) {
    return NextResponse.json(
      {
        error: `Para grupos de más de ${initialAvailability.settings.maximumPartySize} personas, contactanos directamente.`,
      },
      { status: 400 },
    );
  }
  const initialSlot = initialAvailability.slots.find((slot) => slot.time === parsed.data.time);
  if (!initialSlot || initialSlot.status === "full") {
    return NextResponse.json({ error: "Ese horario ya no está disponible" }, { status: 409 });
  }
  if (
    parsed.data.sector &&
    initialAvailability.settings.sectors.length > 0 &&
    !initialAvailability.settings.sectors.includes(parsed.data.sector)
  ) {
    return NextResponse.json({ error: "El sector seleccionado no está disponible" }, { status: 409 });
  }

  const ipHash = reservationAddressHash(requestAddress(request));
  const recentRequests = await prisma.reservation.count({
    where: { ipHash, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recentRequests >= 5) {
    return NextResponse.json({ error: "Alcanzaste el límite temporal de solicitudes" }, { status: 429 });
  }

  const reference = await uniqueReference();
  let status = "pending";
  try {
    await prisma.$transaction(async (transaction) => {
      // La sucursal siempre existe; bloquearla también protege tenants que aún no
      // poseen una fila explícita en ReservationSettings.
      await transaction.$queryRaw`SELECT id FROM branch WHERE id = ${branch.id} FOR UPDATE`;
      const current = await getReservationAvailability({
        tenantId: tenant.id,
        branchId: branch.id,
        date: parsed.data.date,
        partySize: parsed.data.partySize,
        sector: parsed.data.sector,
        timeZone,
        database: transaction,
      });
      const slot = current.slots.find((candidate) => candidate.time === parsed.data.time);
      if (!slot || slot.status === "full") throw new ReservationCapacityError();
      status = current.settings.confirmationMode === "automatic" ? "confirmed" : "pending";

      const reservation = await transaction.reservation.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          reference,
          status,
          reservationDate: reservationDateValue(parsed.data.date),
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
          estimatedDuration: current.settings.defaultDuration,
        },
      });
      await transaction.reservationStatusHistory.create({
        data: { reservationId: reservation.id, toStatus: status, note: "Solicitud creada desde la web" },
      });
      await transaction.notification.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
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
