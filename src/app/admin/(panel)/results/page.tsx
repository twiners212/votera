import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { ResultsLiveView } from "@/components/admin/results-live-view";
import { db } from "@/db";
import { elections } from "@/db/schema";

export const metadata: Metadata = {
  title: "Hasil Pemilihan — Panel Panitia | Votera",
  description:
    "Pantau perolehan suara real-time dan unduh laporan resmi hasil pemilihan.",
};

export const dynamic = "force-dynamic";

async function resolveActiveElectionId(): Promise<string> {
  try {
    const [active] = await db
      .select({ id: elections.id })
      .from(elections)
      .where(eq(elections.isActive, true))
      .limit(1);

    return active?.id ?? "active";
  } catch {
    return "active";
  }
}

export default async function AdminResultsPage() {
  const electionId = await resolveActiveElectionId();

  return <ResultsLiveView electionId={electionId} />;
}
