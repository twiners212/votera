"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import {
  AdminSidebarContent,
  ADMIN_NAV_GROUPS,
} from "@/components/admin/admin-sidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { AdminRole } from "@/types/votera";

const ROUTE_TITLES: Record<string, string> = ADMIN_NAV_GROUPS.flatMap(
  (group) => group.items
).reduce<Record<string, string>>((acc, item) => {
  acc[item.href] = item.label;
  return acc;
}, {});

function resolvePageTitle(pathname: string, fallback?: string): string {
  if (fallback) return fallback;
  const matched = Object.entries(ROUTE_TITLES).find(
    ([href]) => pathname === href || pathname.startsWith(`${href}/`)
  );
  return matched ? matched[1] : "Panel Panitia";
}

export interface AdminTopbarProps {
  title?: string;
  adminName?: string;
  role?: AdminRole;
  shortName?: string;
  logoUrl?: string | null;
  onLogout?: () => void | Promise<void>;
  className?: string;
}

export function AdminTopbar({
  title,
  adminName = "Super Admin",
  role = "super_admin",
  shortName = "PILKETOS 2026",
  logoUrl,
  onLogout,
  className,
}: AdminTopbarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const pageTitle = resolvePageTitle(pathname, title);
  const roleLabel = role === "super_admin" ? "Super Admin" : "Panitia";
  const initial = adminName.trim().charAt(0).toUpperCase() || "A";

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#E2E8F0] bg-white px-4 sm:px-7",
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Buka menu navigasi"
              className="h-9 w-9 shrink-0 border-[#E2E8F0] lg:hidden"
            >
              <Menu className="h-4 w-4 text-[#0F172A]" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Menu Panel Panitia</SheetTitle>
              <SheetDescription>
                Navigasi utama manajemen pemilihan Votera.
              </SheetDescription>
            </SheetHeader>
            <AdminSidebarContent
              shortName={shortName}
              logoUrl={logoUrl}
              role={role}
              onNavigate={() => setMobileOpen(false)}
              onLogout={onLogout}
            />
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2 min-w-0">
          <nav
            aria-label="Breadcrumb"
            className="hidden items-center gap-1.5 text-xs text-[#94A3B8] sm:flex"
          >
            <span className="font-medium text-[#64748B]">Admin</span>
            <span aria-hidden="true" className="text-[#CBD5E1]">
              /
            </span>
          </nav>
          <h2 className="truncate text-base font-bold tracking-tight text-[#0F172A] sm:text-[17px]">
            {pageTitle}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#FECACA] bg-[#FFF0EE] text-xs font-bold text-[#D93829]"
        >
          {initial}
        </div>
        <div className="hidden text-right leading-tight sm:block">
          <div className="text-xs font-semibold text-[#0F172A]">
            {adminName}
          </div>
          <div className="mt-0.5">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
                role === "super_admin"
                  ? "border border-[#FECACA] bg-[#FFF0EE] text-[#D93829]"
                  : "border border-[#E2E8F0] bg-[#F1F5F9] text-[#475569]"
              )}
            >
              {roleLabel}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
