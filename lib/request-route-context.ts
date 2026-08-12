import { headers } from "next/headers";

export type RequestRouteContext = {
  routeKind: string;
  originalPath: string;
  tenantSlug?: string;
  branchSlug?: string;
  adminScope?: string;
};

/** @summary Lee el contexto canónico que el gateway resolvió a partir de la URL visible. */
export async function requestRouteContext(): Promise<RequestRouteContext> {
  const requestHeaders = await headers();
  const clean = (value: string | null) => value?.trim().toLocaleLowerCase("es") || undefined;
  return {
    routeKind: requestHeaders.get("x-menuclick-route-kind") ?? "",
    originalPath: requestHeaders.get("x-menuclick-original-path") ?? "",
    tenantSlug: clean(requestHeaders.get("x-menuclick-tenant-slug")),
    branchSlug: clean(requestHeaders.get("x-menuclick-branch-slug")),
    adminScope: clean(requestHeaders.get("x-menuclick-admin-scope")),
  };
}
