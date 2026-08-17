import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

function privateHash(value: string) {
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? "development-only-change-me"}:${value}`)
    .digest("hex");
}

const customerInput = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(190).optional().nullable(),
  phone: z.string().trim().max(60).optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  paymentTerms: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

/** @summary Crea un nuevo cliente en el tenant actual. */
export async function POST(request: Request) {
  const auth = await authorize("customer.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = customerInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const email = parsed.data.email ?? `${Date.now()}@temp.local`;
  const customer = await prisma.loyaltyCustomer.create({
    data: {
      tenantId: auth.tenant.id,
      publicTokenHash: privateHash(`${auth.tenant.id}:${Date.now()}:${Math.random()}`),
      name: parsed.data.name,
      email: email,
      phone: parsed.data.phone,
      address: parsed.data.address,
      paymentTerms: parsed.data.paymentTerms,
      consentAt: new Date(),
    },
  });

  await recordAudit({
    context: auth,
    action: "customer-create",
    entityType: "loyalty-customer",
    entityId: customer.id,
    oldValues: undefined,
    newValues: toAuditValue(serialize(customer)),
    request,
  });

  return NextResponse.json({ customer: serialize(customer) }, { status: 201 });
}
