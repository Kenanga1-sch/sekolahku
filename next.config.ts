import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@/components/*"],
  experimental: {
    optimizePackageImports: false,
  },
  swcMinify: true,
  output: 'standalone',
};

export default nextConfig;
