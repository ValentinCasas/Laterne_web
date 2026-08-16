import type { NextConfig } from "next";
import { developmentAllowedOrigins } from "./lib/domains";

const storageIsRemote = (process.env.STORAGE_DRIVER ?? "").trim().toLocaleLowerCase("es") === "s3";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  typedRoutes: true,
  // Next bloquea recursos internos de dev cuando se accede mediante hosts alternativos.
  // Solo se permiten los hosts .test configurados y los aliases locales básicos.
  allowedDevOrigins: process.env.NODE_ENV === "development" ? developmentAllowedOrigins() : undefined,
  // Protección contra version skew durante despliegues en rolling. Opcional.
  ...(process.env.DEPLOYMENT_VERSION ? { deploymentId: process.env.DEPLOYMENT_VERSION } : {}),
  /** @summary Habilita seguimiento espacial únicamente para experiencias AR del mismo origen. */
  async headers() {
    return [
      {
        source: "/models/:path*.usdz",
        headers: [
          { key: "Content-Type", value: "model/vnd.usdz+zip" },
          { key: "Content-Disposition", value: "inline" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(self), xr-spatial-tracking=(self)",
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