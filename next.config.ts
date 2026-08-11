import type { NextConfig } from "next";
import { developmentAllowedOrigins } from "./lib/domains";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  typedRoutes: true,
  // Next bloquea recursos internos de dev cuando se accede mediante hosts alternativos.
  // Solo se permiten los hosts .test configurados y los aliases locales básicos.
  allowedDevOrigins: process.env.NODE_ENV === "development" ? developmentAllowedOrigins() : undefined,
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
};

export default nextConfig;
