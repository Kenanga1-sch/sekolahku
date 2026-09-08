import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    // .agents/ adalah tooling pihak ketiga (skill agent), bukan kode aplikasi.
    // Tanpa exclude ini, `vitest run` ikut menjalankan test mereka dan selalu
    // merah — sehingga kegagalan sungguhan di kode aplikasi jadi tak terlihat.
    exclude: [
      "node_modules",
      ".next",
      "e2e",
      "**/tests/*.test.ts",
      ".agents/**",
      "agent/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        ".next/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/types/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
