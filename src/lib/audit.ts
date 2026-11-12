import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export type AuditActorType = "admin" | "voter" | "system";

export type AuditDbExecutor = Pick<typeof db, "insert">;

export interface InsertAuditLogParams {
  electionId: string;
  actorType: AuditActorType;
  actorId?: string | null;
  actorName: string;
  actorIdentity: string;
  action: string;
  actionTitle: string;
  description: string;
  ipAddress?: string;
  tx?: AuditDbExecutor;
}

const SENSITIVE_KEY_VALUE_PATTERN =
  /\b([a-zA-Z0-9_]*(?:token|password|secret|candidate_?id)[a-zA-Z0-9_]*)(\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;]+)/gi;

export function sanitizeDescription(action: string, description: string): string {
  if (action.trim().toLowerCase() === "vote_cast") {
    return "Pemilih telah memberikan suara";
  }

  return description.replace(
    SENSITIVE_KEY_VALUE_PATTERN,
    (_match, key: string, separator: string) => `${key}${separator}[REDACTED]`
  );
}

export async function insertAuditLog(params: InsertAuditLogParams): Promise<void> {
  const executor = params.tx ?? db;
  const safeDescription = sanitizeDescription(params.action, params.description);

  await executor.insert(auditLogs).values({
    electionId: params.electionId,
    actorType: params.actorType,
    actorId: params.actorId ?? null,
    actorName: params.actorName,
    actorIdentity: params.actorIdentity,
    action: params.action,
    actionTitle: params.actionTitle,
    description: safeDescription,
    ipAddress: params.ipAddress?.trim() || "::1",
  });
}
