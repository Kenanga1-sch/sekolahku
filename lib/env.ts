import { z } from "zod";

/**
 * Environment variable validation schema
 * Validates required environment variables at build time
 */
const envSchema = z.object({
  // PocketBase
  NEXT_PUBLIC_POCKETBASE_URL: z.string().url().default("http://127.0.0.1:8090"),
  
  // App
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().default("Website Sekolah Terpadu"),
  
  // Map defaults
  NEXT_PUBLIC_DEFAULT_LAT: z.string().default("-6.200000"),
  NEXT_PUBLIC_DEFAULT_LNG: z.string().default("106.816666"),
  NEXT_PUBLIC_DEFAULT_ZOOM: z.string().default("13"),
  
  // Optional: Node environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

/**
 * Parsed and validated environment variables
 */
export const env = envSchema.parse({
  NEXT_PUBLIC_POCKETBASE_URL: process.env.NEXT_PUBLIC_POCKETBASE_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_DEFAULT_LAT: process.env.NEXT_PUBLIC_DEFAULT_LAT,
  NEXT_PUBLIC_DEFAULT_LNG: process.env.NEXT_PUBLIC_DEFAULT_LNG,
  NEXT_PUBLIC_DEFAULT_ZOOM: process.env.NEXT_PUBLIC_DEFAULT_ZOOM,
  NODE_ENV: process.env.NODE_ENV,
});

/**
 * Type-safe environment variable access
 */
export type Env = z.infer<typeof envSchema>;
