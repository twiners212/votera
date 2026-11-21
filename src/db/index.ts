import { neon, Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleServerless } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

// Diperlukan untuk lingkungan Node.js saat memakai WebSocket Pool
neonConfig.webSocketConstructor = ws;

try {
  if (
    typeof (process as unknown as { loadEnvFile?: (path: string) => void })
      .loadEnvFile === "function"
  ) {
    (process as unknown as { loadEnvFile: (path: string) => void }).loadEnvFile(
      ".env.local"
    );
  }
} catch {
  // Ignore if .env.local doesn't exist
}

const connectionString =
  process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL;

if (
  !connectionString &&
  process.env.NEXT_PHASE !== "phase-production-build" &&
  process.env.NODE_ENV !== "test" &&
  !process.env.VITEST
) {
  throw new Error(
    "DATABASE_URL (Pooled) wajib diisi di environment variables."
  );
}

const resolvedUrl =
  connectionString ||
  "postgresql://placeholder:placeholder@localhost:5432/votera";

// 1. Driver HTTP: Cepat untuk query SELECT & operasi non-transaksional
const sqlHttp = neon(resolvedUrl);
export const db = drizzleHttp(sqlHttp, { schema });

// 2. Driver Serverless (WebSocket Pool): Wajib untuk transaksi interaktif (submit suara & batch import)
const pool = new Pool({
  connectionString: resolvedUrl,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 10000,
  max: 10,
});
export const dbPool = drizzleServerless(pool, { schema });

export type Database = typeof db;
export type DatabasePool = typeof dbPool;

export * from "./schema";
