import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // @ts-ignore - Turbopack root for Next.js 16 experimental
  turbopack: {
    root: __dirname,
  },
  experimental: {
    authInterrupts: true,
  },
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 180,
    },
  },
};

export default nextConfig;
