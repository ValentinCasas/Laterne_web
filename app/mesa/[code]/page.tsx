import { notFound } from "next/navigation";
import { TableEntry } from "@/components/tables/table-entry";
import { prisma } from "@/lib/prisma";
import { getDefaultTenant } from "@/lib/tenant";

type TableEntryPageProps = { params: Promise<{ code: string }> };

/** @summary Valida el QR de una mesa activa antes de vincularlo con la carta de su sucursal. */
export default async function TableEntryPage({ params }: TableEntryPageProps) {
  const { code } = await params;
  const tenant = await getDefaultTenant();
  const table = await prisma.diningTable.findFirst({
    where: { tenantId: tenant.id, code, active: true },
    include: { branch: { select: { id: true, slug: true, active: true } } },
  });
  if (!table) notFound();
  const branchPath = table.branch ? `/s/${table.branch.slug}` : "";
  return (
    <main className="shell grid min-h-[70vh] place-items-center py-12">
      <section className="card max-w-xl p-8 text-center">
        <p className="section-eyebrow">Mesa reconocida</p>
        <h1 className="mt-3 text-4xl font-black">{table.name}</h1>
        <TableEntry code={table.code} name={table.name} branchPath={branchPath} />
      </section>
    </main>
  );
}