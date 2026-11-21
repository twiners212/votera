import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth/admin-guard";
import { VotersManager } from "@/components/admin/voters-manager";

export const metadata: Metadata = {
  title: "Pemilih (DPT) — Panel Panitia Votera",
  description:
    "Kelola daftar pemilih tetap (DPT), impor CSV/XLSX, salin token, dan pantau status pemungutan suara.",
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

export default async function AdminVotersPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  const electionId = await resolveActiveElectionId();
  return <VotersManager electionId={electionId} role={session.user.role} />;
}
