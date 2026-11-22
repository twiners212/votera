import { cache } from "react";
import { unstable_cache } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { db, elections, electionSettings } from "@/db";

export interface ActiveBranding {
  shortName: string;
  logoUrl: string | null;
}

async function queryActiveElectionId(): Promise<string> {
  try {
    const [active] = await db
      .select({ id: elections.id })
      .from(elections)
      .where(eq(elections.isActive, true))
      .orderBy(desc(elections.createdAt))
      .limit(1);

    return active?.id ?? "active";
  } catch {
    return "active";
  }
}

const getCachedActiveElectionId = unstable_cache(
  async (): Promise<string> => queryActiveElectionId(),
  ["admin-active-election-id"],
  {
    revalidate: 15,
    tags: ["election-active", "election-settings", "elections"],
  }
);

export const resolveActiveElectionId = cache(async (): Promise<string> => {
  try {
    return await getCachedActiveElectionId();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("incrementalCache") ||
      message.includes("unstable_cache")
    ) {
      return queryActiveElectionId();
    }
    throw error;
  }
});

async function queryActiveBranding(): Promise<ActiveBranding> {
  try {
    const [activeElection] = await db
      .select({
        shortName: elections.shortName,
        logoUrl: electionSettings.logoUrl,
      })
      .from(elections)
      .leftJoin(electionSettings, eq(electionSettings.electionId, elections.id))
      .where(eq(elections.isActive, true))
      .orderBy(desc(elections.createdAt))
      .limit(1);

    return {
      shortName: activeElection?.shortName || "PILKETOS 2026",
      logoUrl: activeElection?.logoUrl ?? null,
    };
  } catch {
    return {
      shortName: "PILKETOS 2026",
      logoUrl: null,
    };
  }
}

const getCachedActiveBranding = unstable_cache(
  async (): Promise<ActiveBranding> => queryActiveBranding(),
  ["admin-active-branding"],
  {
    revalidate: 15,
    tags: ["election-active", "election-settings", "elections"],
  }
);

export const getActiveBranding = cache(async (): Promise<ActiveBranding> => {
  try {
    return await getCachedActiveBranding();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("incrementalCache") ||
      message.includes("unstable_cache")
    ) {
      return queryActiveBranding();
    }
    throw error;
  }
});
