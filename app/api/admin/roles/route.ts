import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** @summary Agrupación de permisos por módulo funcional para la matriz visual. */
const PERMISSION_GROUPS: Record<string, string[]> = {
  "Operación": ["admin.access", "order.manage", "table.manage", "kitchen.manage", "reservation.manage", "customer.manage"],
  "Productos": ["product.manage", "category.manage", "inventory.manage"],
  "Compras": ["purchase.manage"],
  "Finanzas": ["finance.view", "finance.manage", "finance.transfer", "finance.payment", "finance.export", "finance.reversal"],
  "Delivery": ["driver.view", "driver.self"],
  "Reportes": ["analytics.read"],
  "Contenido": ["event.manage", "hours.manage", "promotion.manage", "brand.manage", "content.manage", "testimonial.moderate"],
  "Configuración": ["business.manage", "user.manage", "notification.manage", "media.manage", "support.manage", "audit.read"],
};

/**
 * @summary Lista los roles del tenant con la matriz de permisos agrupada por módulo.
 */
export async function GET() {
  const auth = await authorize("user.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const roles = await prisma.role.findMany({
    where: { tenantId: auth.tenant.id },
    include: {
      permissions: {
        select: { permission: { select: { key: true, name: true } } },
      },
      _count: { select: { memberships: true } },
    },
    orderBy: [{ system: "desc" }, { name: "asc" }],
  });

  // Todos los permisos disponibles
  const allPermissions = await prisma.permission.findMany({
    select: { key: true, name: true, description: true },
    orderBy: { key: "asc" },
  });

  const groups = Object.entries(PERMISSION_GROUPS).map(([group, keys]) => ({
    group,
    permissions: allPermissions.filter((p) => keys.includes(p.key)),
  }));

  // Agregar permisos no agrupados
  const groupedKeys = Object.values(PERMISSION_GROUPS).flat();
  const ungrouped = allPermissions.filter((p) => !groupedKeys.includes(p.key));
  if (ungrouped.length) {
    groups.push({ group: "Otros", permissions: ungrouped });
  }

  return NextResponse.json({
    roles: roles.map((role) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      system: role.system,
      userCount: role._count.memberships,
      permissions: role.permissions.map((rp) => rp.permission.key),
    })),
    groups,
    allPermissions: allPermissions.map((p) => p.key),
  });
}
