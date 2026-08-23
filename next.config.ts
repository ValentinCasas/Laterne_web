import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";
import { developmentAllowedOrigins } from "./lib/domains";

const storageIsRemote = (process.env.STORAGE_DRIVER ?? "").trim().toLocaleLowerCase("es") === "s3";
const isProd = process.env.NODE_ENV === "production";

/** @summary Habilita en next dev las IPv4 privadas reales del equipo para probar desde celulares de la misma red. */
function localNetworkDevOrigins() {
  return [
    ...new Set(
      Object.values(networkInterfaces())
        .flatMap((entries) => entries ?? [])
        .filter((entry) => entry.family === "IPv4" && !entry.internal)
        .map((entry) => entry.address),
    ),
  ];
}

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  typedRoutes: true,
  // Next bloquea recursos internos de dev cuando se accede mediante hosts alternativos.
  // Solo se permiten los hosts .test configurados y los aliases locales básicos.
  allowedDevOrigins:
    process.env.NODE_ENV === "development"
      ? [...developmentAllowedOrigins(), ...localNetworkDevOrigins()]
      : undefined,
  // Protección contra version skew durante despliegues en rolling. Opcional.
  ...(process.env.DEPLOYMENT_VERSION ? { deploymentId: process.env.DEPLOYMENT_VERSION } : {}),
  /** @summary Headers de seguridad + AR policy. CSP se configura por rutas para compatibilidad con MapLibre y uploads. */
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(self), geolocation=(self), xr-spatial-tracking=(self)",
      },
    ];
    if (isProd) {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }
    return [
      {
        source: "/models/:path*.usdz",
        headers: [
          { key: "Content-Type", value: "model/vnd.usdz+zip" },
          { key: "Content-Disposition", value: "inline" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          ...securityHeaders,
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
          },
        ],
      },
      {
        source: "/storage/:path*",
        headers: [
          ...securityHeaders,
          {
            key: "Content-Security-Policy",
            value: "default-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self';",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          ...securityHeaders,
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://tiles.openfreemap.org",
              "font-src 'self' data:",
              "connect-src 'self' https://tiles.openfreemap.org wss:",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
  /**
   * Cuando el almacenamiento es remoto (S3-compatible), los uploads ya no viven
   * en `public/`: las URLs públicas se reescriben a la ruta que los sirve desde
   * el bucket. En modo local no hay rewrite y Next sirve los archivos de forma
   * estática como siempre.
   */
  async rewrites() {
    if (!storageIsRemote) return [];
    return [
      { source: "/images/:path*", destination: "/storage/images/:path*" },
      { source: "/models/:path*", destination: "/storage/models/:path*" },
    ];
  },
};

export default nextConfig;
