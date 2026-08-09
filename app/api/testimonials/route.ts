import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({ description: z.string().trim().min(3).max(500) });
/** @summary Valida y guarda una opinión pública para que luego pueda ser moderada. */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Comentario inválido" }, { status: 400 });
  const testimonial = await prisma.testimonial.create({
    data: { description: parsed.data.description, state: false, date: new Date() },
  });
  return NextResponse.json({ testimonial }, { status: 201 });
}
