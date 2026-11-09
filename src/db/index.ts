import { neon, Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleServerless } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

// Konfigurasi WebSocket constructor untuk lingkungan Node.js
neonConfig.webSocketConstructor = ws;

const connectionString =
  process.env.DATABASE_URL ||
  process.env.DIRECT_DATABASE_URL ||
  "postgres://localhost:5432/dummy";

// 1. Driver HTTP: Sangat cepat untuk query SELECT dan operasi non-transaksional
const sqlHttp = neon(connectionString);
export const db = drizzleHttp(sqlHttp, { schema });

// 2. Driver Serverless (WebSocket Pool): Wajib untuk transaksi interaktif (submit suara & impor DPT)
const pool = new Pool({ connectionString });
export const dbPool = drizzleServerless(pool, { schema });

export type Database = typeof db;
export type DatabasePool = typeof dbPool;
export * from "./schema";
