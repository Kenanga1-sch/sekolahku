import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable source maps in production for faster builds
  productionBrowserSourceMaps: false,

  // Optimize for low-memory environments
  experimental: {
    // Reduce memory usage during build
    webpackMemoryOptimizations: true,
    // Optimize package imports
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-accordion",
      "recharts",
    ],
  },

  // Turbopack configuration
  turbopack: {
    // Set the correct root directory
    root: process.cwd(),
  },

  // Reduce build output size
  compress: true,

  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },

  // Allow cross-origin requests from network IP
  allowedDevOrigins: ['http://100.108.127.74:3001'],

  // Create standalone folder which copies only the necessary files for a production deployment
  output: "standalone",
};

export default nextConfig;
