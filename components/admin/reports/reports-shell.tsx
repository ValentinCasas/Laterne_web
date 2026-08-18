"use client";

import type { Route } from "next";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader, Tabs } from "@/components/admin/ui";
import { ReportsFilters } from "./reports-filters";

/** @summary Layout compartido para páginas de reportes: filtros URL-driven y contenido. */
export function ReportsShell({
  children,
  branches,
  categories,
  products,
  suppliers,
  users,
  paymentMethods,
  channels,
  sources,
  defaultFrom,
  defaultTo,
  periodPreset,
  title,
  description,
  section,
  tabs,
}: {
  children: React.ReactNode;
  branches: Array<{ id: number; name: string }>;
  categories: Array<{ id: number; name: string }>;
  products: Array<{ id: number; name: string }>;
  suppliers: Array<{ id: number; name: string }>;
  users: Array<{ id: number; name: string }>;
  paymentMethods: string[];
  channels: string[];
  sources: string[];
  defaultFrom?: string;
  defaultTo?: string;
  periodPreset?: string;
  title?: string;
  description?: string;
  section?: string;
  tabs?: Array<{ key: string; label: string; disabled?: boolean }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => ({
      from: searchParams.get("from") || defaultFrom || undefined,
      to: searchParams.get("to") || defaultTo || undefined,
      branchId: searchParams.has("branchId") ? Number(searchParams.get("branchId")) : null,
      categoryId: searchParams.has("categoryId") ? Number(searchParams.get("categoryId")) : null,
      productId: searchParams.has("productId") ? Number(searchParams.get("productId")) : null,
      supplierId: searchParams.has("supplierId") ? Number(searchParams.get("supplierId")) : null,
      userId: searchParams.has("userId") ? Number(searchParams.get("userId")) : null,
      paymentMethod: searchParams.get("paymentMethod") || null,
      channel: searchParams.get("channel") || null,
      source: searchParams.get("source") || null,
      period: searchParams.get("period") || periodPreset || undefined,
    }),
    [searchParams, defaultFrom, defaultTo, periodPreset],
  );

  function handleFilterChange(patch: Record<string, unknown>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "" || value === undefined) {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    }
    const query = params.toString();
    router.replace((query ? `${pathname}?${query}` : pathname) as Route);
  }

  return (
    <div className="space-y-6">
      {title && (
        <PageHeader
          section={section ?? "Reportes"}
          title={title}
          description={description}
        />
      )}
      {tabs && tabs.length > 0 && <Tabs tabs={tabs} defaultTab={tabs[0]?.key} />}
      <ReportsFilters
        filters={filters}
        onChange={handleFilterChange}
        branches={branches}
        categories={categories}
        products={products}
        suppliers={suppliers}
        users={users}
        paymentMethods={paymentMethods}
        channels={channels}
        sources={sources}
        periodPreset={filters.period}
      />
      {children}
    </div>
  );
}
