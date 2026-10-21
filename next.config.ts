import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Backend tujuan `next dev`. Default staging (3001), BUKAN produksi (8181):
// dev server memutasi data, jadi jangan pernah menunjuk ke DB produksi.
const devBackend =
  process.env.DEV_BACKEND_ORIGIN ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  // === STATIC EXPORT MODE ===
  // Required for embedding in Go binary via "out" folder
  ...(isProd ? { output: "export" as const } : {}),

  // No source maps in production
  productionBrowserSourceMaps: false,
  reactStrictMode: true,

  // ESM packages yang perlu ditranspile oleh Next bundler
  transpilePackages: ["@react-pdf/renderer"],

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
      "motion",
    ],
  },

  // Images must be unoptimized in static export (no server to resize)
  images: {
    unoptimized: true,
  },

  // Reduce build output size
  compress: true,

  // Rewrites hanya aktif saat dev: /api dan /uploads diproksikan ke staging
  ...(!isProd
    ? {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: `${devBackend}/api/:path*`,
            },
            {
              source: "/uploads/:path*",
              destination: `${devBackend}/uploads/:path*`,
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;
