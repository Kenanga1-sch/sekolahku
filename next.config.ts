import type { NextConfig } from "next";

// Detect environment for Adaptive Build Output
const isWindows = process.platform === "win32";
const skipStandalone = process.env.SKIP_STANDALONE === "true" || process.env.SKIP_STANDALONE === "1";

const useStandalone = !isWindows && !skipStandalone;

if (useStandalone) {
  console.log("\x1b[36m%s\x1b[0m", "[Next.config] ℹ️ Build Mode: STANDALONE (Linux/Server detected)");
} else {
  const reason = isWindows ? "Windows OS" : "SKIP_STANDALONE env";
  console.log("\x1b[33m%s\x1b[0m", `[Next.config] ℹ️ Build Mode: DEFAULT (${reason} detected)`);
}
  
  const nextConfig: NextConfig = {
    typescript: {
      ignoreBuildErrors: true,
    },
    // @ts-expect-error - eslint is a valid config but missing in NextConfig type for this version
    eslint: {
      ignoreDuringBuilds: true,
    },
    // Disable source maps in production for faster builds
  productionBrowserSourceMaps: false,
  
  // Disable strict mode to prevent double-mounting of camera in dev
  reactStrictMode: false,

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
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-popover",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-switch",
      "@radix-ui/react-avatar",
      "@radix-ui/react-scroll-area",
      "recharts",
      "date-fns",
      "framer-motion",
    ],
    // serverComponentsExternalPackages: ["better-sqlite3"], // Deprecated/Moved
  },
  serverExternalPackages: ["better-sqlite3"],

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
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
    ],
  },

  // Allow cross-origin requests from network IP
  // allowedDevOrigins: ['http://100.108.127.74:3001'],

  // Create standalone folder which copies only the necessary files for a production deployment
  output: useStandalone ? "standalone" : undefined,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=*', // Allow camera access for all paths
          },
        ],
      },
    ];
  },
};

export default nextConfig;
