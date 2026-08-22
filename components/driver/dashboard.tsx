"use client";

import { useEffect, useState } from "react";
import { DriverActiveDeliveries, type DriverDelivery } from "@/components/driver/active-deliveries";
import { DriverLocationSharing } from "@/components/driver/location-sharing";
import { DriverProfileCard } from "@/components/driver/profile-card";
import { DriverSummaryCards } from "@/components/driver/summary-cards";
import { scopedFetch } from "@/lib/client-routing";

type DriverProfile = Parameters<typeof DriverProfileCard>[0]["driver"];
type LastPosition = Parameters<typeof DriverLocationSharing>[0]["initialLastPosition"];
type CompletedDelivery = { id: number; number: string; customerName: string; deliveredAt?: string | Date | null; order?: { reference: string } | null };

/** @summary Orquesta el home del repartidor y refresca datos operativos sin recargar la página. */
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
    <div className="space-y-4">
      <DriverSummaryCards active={deliveries.length} deliveredToday={deliveredTodayCount} averageMinutes={averageMinutes} incidents={incidentCount} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,.8fr)]">
        <div className="space-y-4 lg:col-start-1">
          <DriverProfileCard driver={driver} activeDeliveries={deliveries.length} />
          <section>
            <div className="mb-3 flex items-end justify-between gap-3 px-1">
              <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-pink-300">Operación</p><h1 className="mt-1 text-xl font-black">Mis entregas</h1></div>
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-bold text-zinc-400">{deliveries.length} activas</span>
            </div>
            <DriverActiveDeliveries deliveries={deliveries} onChange={setDeliveries} onDelivered={() => setDeliveredTodayCount((value) => value + 1)} onIncident={() => setIncidentCount((value) => value + 1)} />
          </section>
        </div>
        <aside className="space-y-4 lg:col-start-2 lg:row-start-1">
          <DriverLocationSharing
            deliveries={deliveries.map((delivery) => ({ id: delivery.id, branchId: delivery.branch?.id, status: delivery.status }))}
            fallbackBranchId={driver.branches?.[0]?.branch?.id}
            initialEnabled={driver.locationSharingEnabled}
            initialLastPosition={lastPosition}
          />
          {completedToday.length > 0 && (
            <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-4">
              <div className="flex items-center justify-between"><h2 className="text-sm font-black text-white">Últimas completadas</h2><span className="text-xs font-bold text-emerald-300">Hoy</span></div>
              <ul className="mt-2 divide-y divide-white/5">
                {completedToday.slice(0, 4).map((delivery) => <li key={delivery.id} className="flex items-center justify-between gap-3 py-2.5 text-xs"><span className="min-w-0 truncate font-bold text-zinc-200">{delivery.customerName}<span className="font-normal text-zinc-500"> · {delivery.order?.reference ?? delivery.number}</span></span><span className="shrink-0 text-emerald-300">Entregado</span></li>)}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
