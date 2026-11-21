import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, elections, electionSettings } from "@/db";
import { getAdminSession } from "@/lib/auth/admin-guard";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";

export const dynamic = "force-dynamic";

async function getActiveBranding() {
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

export default async function AdminPanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  const branding = await getActiveBranding();

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <AdminSidebar
        role={session.user.role}
        shortName={branding.shortName}
        logoUrl={branding.logoUrl}
      />
      <div className="flex min-h-screen flex-col lg:pl-64">
        <AdminTopbar
          adminName={session.user.name}
          role={session.user.role}
          shortName={branding.shortName}
          logoUrl={branding.logoUrl}
        />
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 sm:p-6 lg:p-7">
          {children}
        </main>
      </div>
    </div>
  );
}
