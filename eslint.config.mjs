import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "go-backend/cmd/api/dist/**",
    "go-backend/data/**",
    "backups/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "uploads/**",
    "public/uploads/**",
    // Library pihak-ketiga (minified) yang di-vendor — bukan kode kita.
    "public/docstation/vendor/**",
    "public/**/*.min.js",
    "scratch/**",
    "*.log",
    "*.txt",
    "*.json",
  ]),
  {
    plugins: { react: reactPlugin, "react-hooks": reactHooksPlugin },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "prefer-const": "warn",
      "no-var": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      // Turunkan ke warning: refactor bertahap, jangan blokir CI.
      "react/no-unescaped-entities": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  // Pagar kesehatan kode: sinyal ukuran/kompleksitas agar file tak membengkak
  // jadi monolit. Sementara "warn" (bukan "error") supaya refactor bertahap
  // tidak memblokir CI — sama pola dengan no-explicit-any di atas.
  // Ambang bisa diperketat setelah file-file besar dipecah.
  // File test dikecualikan: panjangnya wajar & bukan kode produksi.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    ignores: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "**/__tests__/**",
      "**/*.stories.tsx",
    ],
    rules: {
      "max-lines": ["warn", { max: 800, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["warn", { max: 300, skipBlankLines: true, skipComments: true }],
      complexity: ["warn", 25],
      "max-depth": ["warn", 6],
    },
  },
]);

export default eslintConfig;
