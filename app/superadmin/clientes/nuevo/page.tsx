import Link from "next/link";
import { TenantCreateForm } from "@/components/platform/tenant-create-form";
import { prisma } from "@/lib/prisma";

export default async function NewPlatformClientPage() { const plans = await prisma.plan.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { displayOrder: "asc" } }); return <section className="mx-auto max-w-4xl"><Link className="text-sm font-bold text-amber-300" href="/platform/clientes">← Clientes</Link><header className="my-7"><p className="text-xs font-black uppercase tracking-[.25em] text-amber-300">Alta SaaS</p><h1 className="mt-2 text-4xl font-black">Nuevo cliente</h1><p className="mt-3 text-slate-400">Creá el tenant y su propietario inicial. Las credenciales se almacenan hasheadas.</p></header><TenantCreateForm plans={plans} /></section>; }
