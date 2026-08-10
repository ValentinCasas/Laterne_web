import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  typedRoutes: true,
  // Next bloquea los módulos del cliente al abrir el servidor de desarrollo desde otro equipo.
  // Estos rangos se aplican solamente a `next dev` y permiten probar la aplicación en la red local.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
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
