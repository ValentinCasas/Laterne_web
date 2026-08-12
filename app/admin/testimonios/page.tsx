import type { Metadata } from "next";
import { TestimonialBoard } from "@/components/admin/testimonial-board";
import { requirePermission } from "@/lib/auth";
import { activeBranchWhere } from "@/lib/branch";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const context = await requirePermission("testimonial.moderate");
  return { title: `${context.tenant.name} | Testimonios` };
}

/** @summary Carga moderación de testimonios con un filtro explícito de tenant y sucursal activa. */
export default async function TestimonialsPage() {
  const context = await requirePermission("testimonial.moderate");
  const items = await prisma.testimonial.findMany({
    where: activeBranchWhere(context.tenant.id, context.activeBranchId),
    orderBy: { id: "desc" },
  });
  return <TestimonialBoard initialItems={serialize(items) as unknown as Parameters<typeof TestimonialBoard>[0]["initialItems"]} />;
}
