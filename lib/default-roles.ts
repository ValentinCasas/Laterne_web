import type { Prisma } from "@prisma/client";

/**
 * Roles de sistema que recibe cada tenant al ser creado.
 *
 * Replica la matriz de permisos que la migración base aplicó al tenant original
 * (propietario/administrador con todos los permisos; el resto con un alcance
 * operativo específico). `plan.manage` y `lead.manage` quedan excluidos porque
 * son exclusivos del superadmin de Platform.
 */

export type DefaultRoleDefinition = {
  key: string;
  name: string;
  description: string;
  /** `"*"` = todos los permisos excepto los exclusivos de Platform. */
  permissionKeys: string[];
};

export const TENANT_FORBIDDEN_PERMISSIONS = ["plan.manage", "lead.manage"];

export const DEFAULT_TENANT_ROLES: DefaultRoleDefinition[] = [
  {
    key: "owner",
    name: "Propietario",
    description: "Control total del negocio.",
    permissionKeys: ["*"],
  },
  {
    key: "administrator",
    name: "Administrador",
    description: "Administra contenido, usuarios y configuración.",
    permissionKeys: ["*"],
  },
  {
    key: "menu_editor",
    name: "Editor de carta",
    description: "Gestiona carta, eventos, horarios y promociones.",
    permissionKeys: [
      "admin.access",
      "product.manage",
      "purchase.manage",
      "category.manage",
      "event.manage",
      "hours.manage",
      "promotion.manage",
    ],
  },
  {
    key: "moderator",
    name: "Moderador",
    description: "Gestiona opiniones de la comunidad.",
    permissionKeys: ["admin.access", "testimonial.moderate"],
  },
  {
    key: "reservation_manager",
    name: "Responsable de reservas",
    description: "Administra reservas.",
    permissionKeys: ["admin.access", "reservation.manage"],
  },
  {
    key: "order_manager",
    name: "Responsable de pedidos",
    description: "Administra pedidos y mesas.",
    permissionKeys: ["admin.access", "order.manage", "table.manage"],
  },
  {
    key: "analyst",
    name: "Analista",
    description: "Consulta información y estadísticas.",
    permissionKeys: ["admin.access", "analytics.read"],
  },
  {
    key: "viewer",
    name: "Solo lectura",
    description: "Consulta contenido sin modificarlo.",
    permissionKeys: ["admin.access"],
  },
];

/** @summary Crea los roles de sistema de un tenant y sus permisos dentro de una transacción. */
export async function createDefaultTenantRoles(
  transaction: Prisma.TransactionClient,
  tenantId: number,
): Promise<void> {
  const permissions = await transaction.permission.findMany({ select: { id: true, key: true } });
  const allGranted = permissions.filter(
    (permission) => !TENANT_FORBIDDEN_PERMISSIONS.includes(permission.key),
  );
  for (const definition of DEFAULT_TENANT_ROLES) {
    const role = await transaction.role.create({
      data: {
        tenantId,
        key: definition.key,
        name: definition.name,
        description: definition.description,
        system: true,
      },
    });
    const granted = definition.permissionKeys.includes("*")
      ? allGranted
      : permissions.filter((permission) => definition.permissionKeys.includes(permission.key));
    if (granted.length > 0) {
      await transaction.rolePermission.createMany({
        data: granted.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
      });
    }
  }
}