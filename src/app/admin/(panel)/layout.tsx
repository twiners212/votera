import * as React from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";

export default function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-[#FAF9F7] text-slate-800 antialiased">
      {/* Desktop Fixed Left Sidebar (240px) */}
      <AdminSidebar className="hidden lg:flex fixed top-0 left-0 bottom-0 z-30" />

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-[240px] flex flex-col min-h-screen">
        <AdminTopbar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
