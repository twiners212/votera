import type { Metadata } from "next";
import { ResultsLiveView } from "@/components/admin/results-live-view";
import { resolveActiveElectionId } from "@/lib/admin/active-election";

export const metadata: Metadata = {
  title: "Hasil Pemilihan — Panel Panitia | Votera",
  description:
    "Pantau perolehan suara real-time dan unduh laporan resmi hasil pemilihan.",
};

export const dynamic = "force-dynamic";

export default async function AdminResultsPage() {
  const electionId = await resolveActiveElectionId();

  return <ResultsLiveView electionId={electionId} />;
}
