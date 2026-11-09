"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Menu, Shield, Clock, ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { AdminSidebar } from "./admin-sidebar";
import { authClient } from "@/lib/auth/admin-client";

const PAGE_TITLES: Record<string, string> = {
  "/admin/dashboard": "Dashboard",
  "/admin/candidates": "Manajemen Kandidat",
  "/admin/voters": "Manajemen Pemilih (DPT)",
  "/admin/results": "Hasil Pemilihan & Berita Acara",
  "/admin/classes": "Tingkat Kelas & Rombel",
  "/admin/majors": "Data Jurusan",
  "/admin/settings": "Pengaturan Pemilihan",
  "/admin/logs": "Log Aktivitas Sistem",
  "/admin/users": "Kelola Administrator",
};

export function AdminTopbar() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const { data: session } = authClient.useSession();

  const title = PAGE_TITLES[pathname] || "Panel Administrator";
  const initials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "AD";

  const isSuperAdmin = session?.user?.role === "super_admin";

  return (
    <header className="h-16 bg-white border-b border-[#E2E8F0] px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-20">
      {/* Left: Mobile Drawer Trigger & Title */}
      <div className="flex items-center gap-3">
        {/* Mobile Sheet Trigger */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Buka navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[240px]">
            <AdminSidebar onNavClick={() => setOpen(false)} />
          </SheetContent>
        </Sheet>

        <div>
          <h1 className="text-[16px] sm:text-[17px] font-bold text-slate-800 tracking-tight">
            {title}
          </h1>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            PILKETOS 2026 • SMA Bojong Gede
          </p>
        </div>
      </div>

      {/* Right: Status Pill & Profile */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Live Election Status Pill */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] font-medium text-emerald-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Pemilihan Buka</span>
        </div>

        {/* User Profile Pill matching Stitch Screen 08 */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-[#FDECEB] text-[#C8322B] font-bold text-xs flex items-center justify-center border border-red-100 shadow-xs">
            {initials}
          </div>
          <div className="text-right leading-tight hidden sm:block">
            <div className="text-xs font-semibold text-slate-800">
              {session?.user?.name || "Administrator"}
            </div>
            <div className="text-[10px] text-slate-400">
              {isSuperAdmin ? "Super Admin" : "Panitia"}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
