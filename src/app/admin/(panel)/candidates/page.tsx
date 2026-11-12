import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { CandidatesManager } from "@/components/admin/candidates-manager";

export const metadata: Metadata = {
  title: "Manajemen Kandidat — Votera",
};

export const dynamic = "force-dynamic";

async function resolveActiveElectionId(): Promise<string> {
  try {
    const { db, elections } = await import("@/db");
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

export default async function AdminCandidatesPage() {
  const electionId = await resolveActiveElectionId();

  return <CandidatesManager electionId={electionId} />;
}
