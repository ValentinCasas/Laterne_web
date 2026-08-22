import { NextResponse } from "next/server";
import { authorize, canAccessBranch } from "@/lib/auth";
import {
  DeliveryGeocodingUnavailableError,
  geocodeDeliveryAddress,
} from "@/lib/delivery-geocoding";
import { prisma } from "@/lib/prisma";

/** @summary Propone coordenadas para una dirección autorizada sin guardarlas hasta confirmación humana. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const delivery = await prisma.orderDelivery.findFirst({
    where: { id, tenantId: auth.tenant.id },
    select: {
      deliveryAddress: true,
      latitude: true,
      longitude: true,
      branchId: true,
      branch: { select: { address: true } },
    },
  });
  if (!delivery) return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
  if (delivery.branchId && !canAccessBranch(auth, delivery.branchId)) {
    return NextResponse.json({ error: "Sucursal no autorizada" }, { status: 403 });
  }
  if (delivery.latitude && delivery.longitude) {
    return NextResponse.json({ error: "La entrega ya tiene coordenadas" }, { status: 409 });
  }
  if (!delivery.deliveryAddress) return NextResponse.json({ error: "La entrega no tiene dirección" }, { status: 400 });

  const query = [delivery.deliveryAddress, delivery.branch?.address].filter(Boolean).join(", ");
  try {
    const candidates = await geocodeDeliveryAddress(query);
    return NextResponse.json({ candidates });
  } catch (error) {
    if (error instanceof DeliveryGeocodingUnavailableError) {
      return NextResponse.json({ error: error.message, code: "GEOCODING_NOT_CONFIGURED" }, { status: 503 });
    }
    return NextResponse.json({ error: "No se pudo consultar el geocodificador. Delivery sigue operativo." }, { status: 502 });
  }
}
