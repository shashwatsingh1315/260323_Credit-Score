import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // @ts-ignore - Turbopack root for Next.js 16 experimental // eslint-disable-line @typescript-eslint/ban-ts-comment, @typescript-eslint/ban-ts-comment
  turbopack: {
    root: __dirname,
  },
  experimental: {
    authInterrupts: true,
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
};

export default nextConfig;
