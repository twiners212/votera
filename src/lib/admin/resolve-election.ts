import { desc, eq } from "drizzle-orm";
import { db, elections } from "@/db";

export type ElectionRecord = typeof elections.$inferSelect;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveTargetElection(
  electionRef?: string | null
): Promise<ElectionRecord | null> {
  const trimmed = electionRef?.trim();

  // If a specific UUID is requested, resolve directly
  if (trimmed && trimmed !== "active") {
    if (!UUID_REGEX.test(trimmed)) {
      return null;
    }

    const [found] = await db
      .select()
      .from(elections)
      .where(eq(elections.id, trimmed))
      .limit(1);

    return found ?? null;
  }

  // If "active" or omitted, find active election first
  const [active] = await db
    .select()
    .from(elections)
    .where(eq(elections.isActive, true))
    .orderBy(desc(elections.createdAt))
    .limit(1);

  if (active) {
    return active;
  }

  // Fallback to the latest election in database
  const [latest] = await db
    .select()
    .from(elections)
    .orderBy(desc(elections.createdAt))
    .limit(1);

  return latest ?? null;
}

export async function resolveTargetElectionId(
  electionRef?: string | null
): Promise<string | null> {
  const election = await resolveTargetElection(electionRef);
  return election?.id ?? null;
}
