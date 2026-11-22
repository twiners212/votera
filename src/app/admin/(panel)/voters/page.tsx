import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin-guard";
import { resolveActiveElectionId } from "@/lib/admin/active-election";
import { VotersManager } from "@/components/admin/voters-manager";

export const metadata: Metadata = {
  title: "Pemilih (DPT) — Panel Panitia Votera",
  description:
    "Kelola daftar pemilih tetap (DPT), impor CSV/XLSX, salin token, dan pantau status pemungutan suara.",
};

export const dynamic = "force-dynamic";

export default async function AdminVotersPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  const electionId = await resolveActiveElectionId();
  return <VotersManager electionId={electionId} role={session.user.role} />;
}
