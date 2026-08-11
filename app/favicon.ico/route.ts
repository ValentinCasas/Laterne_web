import { headers } from "next/headers";
import { classifyHost } from "@/lib/domains";

const fallbackIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#e8ff6a"/><path d="M18 18h8v28h-8zm10 0h8v28h-8zm10 0h8v28h-8z" fill="#0b0d12"/></svg>`;

/** @summary Sirve un favicon global seguro sin resolver tenants en Platform ni en App. */
export async function GET() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "";
  const kind = classifyHost(host).kind;
  return new Response(fallbackIcon, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": kind === "tenant" ? "public, max-age=300" : "public, max-age=3600",
    },
  });
}
