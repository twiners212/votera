import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import ws from "ws";

try {
  if (typeof (process as unknown as { loadEnvFile?: (path: string) => void }).loadEnvFile === "function") {
    (process as unknown as { loadEnvFile: (path: string) => void }).loadEnvFile(".env.local");
  }
} catch {
  // Ignore if .env.local doesn't exist
}

neonConfig.webSocketConstructor = ws;

async function runMigration() {
  const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DIRECT_DATABASE_URL atau DATABASE_URL wajib disetel untuk menjalankan migrasi.");
  }

  console.log("Menjalankan migrasi database ke Neon PostgreSQL (Database: votera)...");
  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  try {
    // 1. Eksekusi migrasi skema Drizzle
    await migrate(db, { migrationsFolder: "./drizzle/migrations" });
    console.log("✓ Migrasi skema Drizzle selesai.");

    // 2. Pasang trigger proteksi immutability tabel audit_logs
    await pool.query(`
      CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Security Violation: Tabel audit_logs bersifat append-only dan tidak dapat diubah atau dihapus.';
      END;
      $$ LANGUAGE plpgsql;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'trg_protect_audit_logs'
        ) THEN
          CREATE TRIGGER trg_protect_audit_logs
          BEFORE UPDATE OR DELETE ON audit_logs
          FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
        END IF;
      END $$;
    `);
    console.log("✓ Trigger proteksi append-only audit_logs terpasang.");
  } catch (error) {
    console.error("Gagal menjalankan migrasi:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
