import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // === STATIC EXPORT MODE ===
  // Required for embedding in Go binary via "out" folder
  output: "export",


  typescript: {
    ignoreBuildErrors: true,
  },

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
};

export default nextConfig;
