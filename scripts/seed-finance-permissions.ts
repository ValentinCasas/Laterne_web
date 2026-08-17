import { prisma } from "@/lib/prisma";

const FINANCE_PERMISSIONS = [
  { key: "finance.view", name: "Ver finanzas", description: "Permite consultar cuentas, movimientos y reportes financieros." },
  { key: "finance.manage", name: "Gestionar finanzas", description: "Permite crear y editar cuentas y registrar movimientos manuales." },
  { key: "finance.transfer", name: "Transferir entre cuentas", description: "Permite mover dinero entre cuentas financieras." },
  { key: "finance.payment", name: "Registrar cobros y pagos", description: "Permite registrar cobros a clientes y pagos a proveedores." },
  { key: "finance.export", name: "Exportar finanzas", description: "Permite exportar reportes financieros a CSV." },
  { key: "finance.reversal", name: "Anular movimientos", description: "Permite anular movimientos, cobros y pagos dejando trazabilidad." },
];

const PRIVILEGED_ROLES = ["owner", "administrator"];

export async function seedFinancePermissions() {
  for (const perm of FINANCE_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: {},
      create: {
        key: perm.key,
        name: perm.name,
        description: perm.description,
      },
    });
  }

  const roles = await prisma.role.findMany({
    where: { key: { in: PRIVILEGED_ROLES } },
    select: { id: true, key: true },
  });

  const permissions = await prisma.permission.findMany({
    where: { key: { in: FINANCE_PERMISSIONS.map((p) => p.key) } },
    select: { id: true, key: true },
  });

  for (const role of roles) {
    for (const perm of permissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: perm.id,
        },
      });
    }
    console.log(`Permisos de finanzas asignados al rol ${role.key}`);
  }

  console.log("Seed de permisos de finanzas completado.");
}

if (require.main === module) {
  seedFinancePermissions()
    .then(() => prisma.$disconnect())
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
