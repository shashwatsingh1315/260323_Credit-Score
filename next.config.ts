import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // @ts-ignore - Turbopack root for Next.js 16 experimental
  turbopack: {
    root: "./",
  },
};

export default nextConfig;
