import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // === STATIC EXPORT MODE ===
  // Required for embedding in Go binary via "out" folder
  ...(isProd ? { output: "export" as const } : {}),

  // No source maps in production
  productionBrowserSourceMaps: false,
  reactStrictMode: true,

  // Optimize package imports
  experimental: {
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
  },

  // Images must be unoptimized in static export (no server to resize)
  images: {
    unoptimized: true,
  },

  // Reduce build output size
  compress: true,

  // Configure rewrites in development mode to proxy /api and /uploads requests to Go backend
  ...(!isProd
    ? {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: "http://localhost:8181/api/:path*",
            },
            {
              source: "/uploads/:path*",
              destination: "http://localhost:8181/uploads/:path*",
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;
