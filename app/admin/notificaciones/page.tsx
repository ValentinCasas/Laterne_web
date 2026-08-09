import {
  NotificationSettings,
  type NotificationSettingsData,
} from "@/components/admin/notification-settings";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/** @summary Carga o inicializa las preferencias de notificación del negocio. */
export default async function NotificationSettingsPage() {
  const context = await requirePermission("notification.manage");
  const settings = await prisma.notificationSettings.upsert({
    where: { tenantId: context.tenant.id },
    create: { tenantId: context.tenant.id },
    update: {},
  });
  return (
    <NotificationSettings initialSettings={serialize(settings) as unknown as NotificationSettingsData} />
  );
}
