import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  env: {
    NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "",
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version ?? "0.1.1",
  },
};

export default nextConfig;
