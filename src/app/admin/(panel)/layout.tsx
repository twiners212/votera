import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin-guard";
import { getActiveBranding } from "@/lib/admin/active-election";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";

export const dynamic = "force-dynamic";

export default async function AdminPanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [session, branding] = await Promise.all([
    getAdminSession(),
    getActiveBranding(),
  ]);

  if (!session) {
    redirect("/admin/login");
  }

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
