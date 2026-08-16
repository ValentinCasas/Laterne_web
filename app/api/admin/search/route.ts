import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { activeBranchWhere, branchProductWhere } from "@/lib/branch";
import { prisma } from "@/lib/prisma";

/** @summary Busca en el servidor de forma consolidada dentro del alcance del tenant y la sucursal. */
export async function GET(request: Request) {
  const auth = await authorize("admin.access");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  const contains = { contains: query, mode: "insensitive" as const };
  const tenantId = auth.tenant.id;

  if (!query) {
    return NextResponse.json({ products: [], customers: [], orders: [], reservations: [] });
  }

  const [products, customers, orders, reservations] = await Promise.all([
    auth.permissions.includes("product.manage")
      ? prisma.product
          .findMany({
            where: { ...branchProductWhere(tenantId, auth.activeBranchId), name: contains },
            select: { id: true, name: true, price: true, status: true },
            take: 6,
          })
          .then((items) =>
            items.map((item) => ({
              id: item.id,
              name: item.name,
              price: item.price === null ? null : item.price.toString(),
              status: item.status,
            })),
          )
      : Promise.resolve([]),
    auth.permissions.includes("customer.manage")
      ? prisma.loyaltyCustomer
          .findMany({
            where: { tenantId, OR: [{ name: contains }, { email: contains }, { phone: contains }] },
            select: { id: true, name: true, email: true, phone: true, points: true },
            take: 6,
          })
          .then((items) =>
            items.map((item) => ({
              id: item.id,
              name: item.name,
              email: item.email,
              phone: item.phone,
              points: item.points,
            })),
          )
      : Promise.resolve([]),
    auth.permissions.includes("order.manage")
      ? prisma.customerOrder
          .findMany({
            where: {
              ...activeBranchWhere(tenantId, auth.activeBranchId),
              OR: [{ reference: contains }, { customerName: contains }],
            },
            select: {
              id: true,
              reference: true,
              customerName: true,
              status: true,
              orderType: true,
              total: true,
              currency: true,
            },
            take: 8,
          })
          .then((items) =>
            items.map((item) => ({
              id: item.id,
              reference: item.reference,
              customerName: item.customerName,
              status: item.status,
              orderType: item.orderType,
              total: item.total === null ? null : item.total.toString(),
              currency: item.currency,
            })),
          )
      : Promise.resolve([]),
    auth.permissions.includes("reservation.manage")
      ? prisma.reservation
          .findMany({
            where: {
              ...activeBranchWhere(tenantId, auth.activeBranchId),
              OR: [{ reference: contains }, { customerName: contains }],
            },
            select: {
              id: true,
              reference: true,
              customerName: true,
              status: true,
              reservationDate: true,
              reservationTime: true,
            },
            take: 8,
          })
          .then((items) =>
            items.map((item) => ({
              id: item.id,
              reference: item.reference,
              customerName: item.customerName,
              status: item.status,
              reservationDate:
                item.reservationDate instanceof Date
                  ? item.reservationDate.toISOString().slice(0, 10)
                  : String(item.reservationDate).slice(0, 10),
              reservationTime: item.reservationTime ? String(item.reservationTime) : null,
            })),
          )
      : Promise.resolve([]),
  ]);

  return NextResponse.json({ products, customers, orders, reservations });
}
