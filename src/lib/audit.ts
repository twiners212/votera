import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export interface InsertAuditLogParams {
  electionId: string;
  actorType: "admin" | "voter" | "system";
  actorId?: string | null;
  actorName: string;
  actorIdentity: string;
  action: string;
  actionTitle: string;
  description: string;
  ipAddress?: string;
}

/**
 * Sanitasi deskripsi log untuk mencegah kebocoran informasi sensitif:
 * - Tidak boleh mencatat plaintext token
 * - Tidak boleh mencatat password
 * - Tidak boleh mencatat kandidat pilihan saat vote_cast
 */
function sanitizeDescription(action: string, description: string): string {
  if (action === "vote_cast") {
    return "Pemilih telah memberikan suara";
  }

  // Bersihkan pola token jika tidak sengaja tertulis (8 karakter kapital/angka)
  const sanitized = description
    .replace(/(?:token\s*[:=]\s*)([A-Z0-9]{8})/gi, "token: [REDACTED]")
    .replace(/(?:password\s*[:=]\s*)(\S+)/gi, "password: [REDACTED]");

  return sanitized;
}

export async function insertAuditLog(params: InsertAuditLogParams) {
  try {
    const cleanedDescription = sanitizeDescription(params.action, params.description);

    await db.insert(auditLogs).values({
      electionId: params.electionId,
      actorType: params.actorType,
      actorId: params.actorId || null,
      actorName: params.actorName,
      actorIdentity: params.actorIdentity,
      action: params.action,
      actionTitle: params.actionTitle,
      description: cleanedDescription,
      ipAddress: params.ipAddress || "::1",
    });
  } catch (error) {
    // Audit log insertion error tidak boleh merusak alur aplikasi kecuali di mode test/audit ketat
    console.error("Gagal mencatat audit log:", error);
  }
}
