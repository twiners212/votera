import { defineConfig } from "vitest/config";
import path from "node:path";

// Muat environment variables dari .env.local untuk pengujian integrasi database
if (typeof (process as unknown as { loadEnvFile?: (path?: string) => void }).loadEnvFile === "function") {
  try {
    (process as unknown as { loadEnvFile: (path?: string) => void }).loadEnvFile(".env.local");
  } catch {
    // Abaikan jika file tidak ada
  }
}

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: [".agents/**", "node_modules/**", ".next/**"],
    globals: true,
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    sequence: {
      concurrent: false,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
