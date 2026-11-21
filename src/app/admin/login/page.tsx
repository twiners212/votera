import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, elections, electionSettings } from "@/db";
import { getAdminSession } from "@/lib/auth/admin-guard";
import { AdminLoginForm } from "@/components/admin/admin-login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Masuk Panel Panitia — Votera",
  description:
    "Halaman masuk khusus Super Admin dan Panitia Pelaksana untuk mengelola pemilihan Votera.",
};

async function getActiveBranding() {
  try {
    const [activeElection] = await db
      .select({
        shortName: elections.shortName,
        organizationName: elections.organizationName,
        logoUrl: electionSettings.logoUrl,
      })
      .from(elections)
      .leftJoin(electionSettings, eq(electionSettings.electionId, elections.id))
      .where(eq(elections.isActive, true))
      .orderBy(desc(elections.createdAt))
      .limit(1);

    return {
      shortName: activeElection?.shortName || "PILKETOS 2026",
      organizationName: activeElection?.organizationName || "SMA Bojong Gede",
      logoUrl: activeElection?.logoUrl ?? null,
    };
  } catch {
    return {
      shortName: "PILKETOS 2026",
      organizationName: "SMA Bojong Gede",
      logoUrl: null,
    };
  }
}

export default async function AdminLoginPage() {
  const session = await getAdminSession();
  if (session) {
    redirect("/admin/dashboard");
  }

  const branding = await getActiveBranding();

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-[#F8FAFC] px-4 py-8 lg:p-8">
      <AdminLoginForm
        shortName={branding.shortName}
        organizationName={branding.organizationName}
        logoUrl={branding.logoUrl}
      />
    </main>
  );
}
