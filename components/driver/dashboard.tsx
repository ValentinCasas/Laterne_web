"use client";

import { useEffect, useState } from "react";
import { DriverActiveDeliveries, type DriverDelivery } from "@/components/driver/active-deliveries";
import { DriverLocationSharing } from "@/components/driver/location-sharing";
import { DriverProfileCard } from "@/components/driver/profile-card";
import { DriverSummaryCards } from "@/components/driver/summary-cards";
import { DriverRouteMap } from "@/components/driver/route-map";
import { scopedFetch } from "@/lib/client-routing";
import { Icon } from "@/components/admin/ui/icons";

type DriverProfile = Parameters<typeof DriverProfileCard>[0]["driver"];
type LastPosition = Parameters<typeof DriverLocationSharing>[0]["initialLastPosition"];
type CompletedDelivery = { id: number; number: string; customerName: string; deliveredAt?: string | Date | null; order?: { reference: string } | null };

/** @summary Dashboard operativo premium del repartidor con KPIs, mapa, entregas y estado GPS. */
export function DriverDashboard({
  driver,
  initialDeliveries,
  completedToday: initialCompleted,
  averageMinutes,
  incidents,
  lastPosition,
}: {
  driver: DriverProfile;
  initialDeliveries: DriverDelivery[];
  completedToday: CompletedDelivery[];
  averageMinutes: number | null;
  incidents: number;
  lastPosition: LastPosition;
}) {
  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const [completedToday, setCompletedToday] = useState(initialCompleted);
  const [deliveredTodayCount, setDeliveredTodayCount] = useState(initialCompleted.length);
  const [incidentCount, setIncidentCount] = useState(incidents);

  useEffect(() => {
    let disposed = false;
    async function refresh() {
      const response = await scopedFetch("/api/driver/deliveries", { cache: "no-store" }).catch(() => null);
      if (!response?.ok || disposed) return;
      const body = (await response.json()) as { activeDeliveries?: DriverDelivery[]; completedToday?: CompletedDelivery[]; deliveredTodayCount?: number };
      if (body.activeDeliveries) setDeliveries(body.activeDeliveries);
      if (body.completedToday) setCompletedToday(body.completedToday);
      if (body.deliveredTodayCount !== undefined) setDeliveredTodayCount(body.deliveredTodayCount);
    }
    const timer = window.setInterval(() => void refresh(), 20_000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="space-y-5">
      {/* ── Hero KPIs ── */}
      <DriverSummaryCards active={deliveries.length} deliveredToday={deliveredTodayCount} averageMinutes={averageMinutes} incidents={incidentCount} />

      {/* ── Mapa + Panel lateral ── */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(340px,.8fr)]">
        <div className="space-y-4 lg:col-start-1">
          {/* Mapa */}
          <DriverRouteMap deliveries={deliveries} />

          {/* Entregas activas */}
          <section>
            <div className="mb-3 flex items-end justify-between gap-3 px-1">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-pink-300">Operación</p>
                <h2 className="mt-1 text-xl font-black text-white">Mis entregas</h2>
              </div>
              {deliveries.length > 0 && (
                <span className="flex items-center gap-1.5 rounded-full bg-sky-500/15 px-3 py-1.5 text-xs font-black text-sky-300">
                  <Icon name="package" className="h-3 w-3" />
                  {deliveries.length} activas
                </span>
              )}
            </div>
            <DriverActiveDeliveries
              deliveries={deliveries}
              onChange={setDeliveries}
              onDelivered={() => {
                setDeliveredTodayCount((value) => value + 1);
                setCompletedToday((current) => {
                  const newEntry = { id: Date.now(), number: "", customerName: "", deliveredAt: new Date() };
                  return [newEntry, ...current];
                });
              }}
              onIncident={() => setIncidentCount((value) => value + 1)}
            />
          </section>
        </div>

        {/* ── Panel lateral ── */}
        <aside className="space-y-4 lg:col-start-2 lg:row-start-1">
          {/* GPS */}
          <DriverLocationSharing
            deliveries={deliveries.map((delivery) => ({ id: delivery.id, branchId: delivery.branch?.id, status: delivery.status }))}
            fallbackBranchId={driver.branches?.[0]?.branch?.id}
            initialEnabled={driver.locationSharingEnabled}
            initialLastPosition={lastPosition}
          />

          {/* Últimas completadas */}
          {completedToday.length > 0 && (
            <section className="overflow-hidden rounded-3xl border border-white/[.08] bg-gradient-to-br from-emerald-500/[.06] via-zinc-900 to-zinc-950 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/5 px-5 py-3.5">
                <div>
                  <h2 className="text-sm font-black text-white">Completadas hoy</h2>
                  <p className="text-[10px] font-medium text-zinc-500">{deliveredTodayCount} entregas finalizadas</p>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-black text-emerald-300">
                  <Icon name="check-circle" className="mr-1 inline h-3 w-3" />
                  Hoy
                </span>
              </div>
              <ul className="divide-y divide-white/5">
                {completedToday.slice(0, 5).map((delivery) => (
                  <li key={delivery.id} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-white/[.02]">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-zinc-200">{delivery.customerName}</p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">{delivery.order?.reference ?? delivery.number}</p>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold text-emerald-400">
                      {delivery.deliveredAt ? new Date(delivery.deliveredAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </li>
                ))}
              </ul>
              {completedToday.length > 5 && (
                <div className="border-t border-white/5 px-5 py-2.5 text-center">
                  <span className="text-[11px] font-bold text-zinc-500">+{completedToday.length - 5} más</span>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
