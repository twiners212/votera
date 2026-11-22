import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin-guard";
import { resolveActiveElectionId } from "@/lib/admin/active-election";
import { CandidatesManager } from "@/components/admin/candidates-manager";

export const metadata: Metadata = {
  title: "Manajemen Kandidat — Votera",
};

export const dynamic = "force-dynamic";

export default async function AdminCandidatesPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  const electionId = await resolveActiveElectionId();

  return <CandidatesManager electionId={electionId} role={session.user.role} />;
}
