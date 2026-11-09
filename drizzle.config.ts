import { defineConfig } from "drizzle-kit";

try {
  if (typeof (process as unknown as { loadEnvFile?: (path: string) => void }).loadEnvFile === "function") {
    (process as unknown as { loadEnvFile: (path: string) => void }).loadEnvFile(".env.local");
  }
} catch {
  // Ignore if .env.local doesn't exist
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || "",
  },
  verbose: true,
  strict: true,
});
