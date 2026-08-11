import { notFound, redirect } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenant";
import { publicTenantUrl } from "@/lib/domains";

/** @summary Alias legible que lleva al sitio público aislado del tenant solicitado. */
export default async function TenantShortcutPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug.trim().toLocaleLowerCase("es");
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  redirect(publicTenantUrl(tenant.slug) as never);
}
