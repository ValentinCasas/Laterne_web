import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  typedRoutes: true,
  /** @summary Habilita seguimiento espacial únicamente para experiencias AR del mismo origen. */
  async headers() {
    return [
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
