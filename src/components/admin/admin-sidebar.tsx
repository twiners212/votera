"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Clock,
  Layers,
  LayoutGrid,
  Loader2,
  LogOut,
  ShieldCheck,
  SlidersHorizontal,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { BrandHeader } from "@/components/shared/brand-header";
import { cn } from "@/lib/utils";
import type { AdminRole } from "@/types/votera";

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  superAdminOnly?: boolean;
}

export interface AdminNavGroup {
  title: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    title: "UTAMA",
    items: [
      {
        label: "Dashboard",
        href: "/admin/dashboard",
        icon: LayoutGrid,
      },
    ],
  },
  {
    title: "PEMILIHAN",
    items: [
      {
        label: "Kandidat",
        href: "/admin/candidates",
        icon: User,
      },
      {
        label: "Pemilih (DPT)",
        href: "/admin/voters",
        icon: Users,
      },
      {
        label: "Hasil & Laporan",
        href: "/admin/results",
        icon: BarChart3,
      },
    ],
  },
  {
    title: "DATA MASTER",
    items: [
      {
        label: "Tingkat Kelas",
        href: "/admin/classes",
        icon: Layers,
        superAdminOnly: true,
      },
      {
        label: "Jurusan",
        href: "/admin/majors",
        icon: BookOpen,
        superAdminOnly: true,
      },
    ],
  },
  {
    title: "SISTEM",
    items: [
      {
        label: "Pengaturan",
        href: "/admin/settings",
        icon: SlidersHorizontal,
        superAdminOnly: true,
      },
      {
        label: "Log Aktivitas",
        href: "/admin/logs",
        icon: Clock,
      },
      {
        label: "Kelola Admin",
        href: "/admin/users",
        icon: ShieldCheck,
        superAdminOnly: true,
      },
    ],
  },
];

export interface AdminSidebarProps {
  shortName?: string;
  logoUrl?: string | null;
  role?: AdminRole;
  onNavigate?: () => void;
  onLogout?: () => void | Promise<void>;
  className?: string;
}

export function AdminSidebarContent({
  shortName = "PILKETOS 2026",
  logoUrl,
  role = "super_admin",
  onNavigate,
  onLogout,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const visibleGroups = React.useMemo(
    () =>
      ADMIN_NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => !item.superAdminOnly || role === "super_admin"
        ),
      })).filter((group) => group.items.length > 0),
    [role]
  );

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      if (onLogout) {
        await onLogout();
      } else {
        await fetch("/api/auth/sign-out", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }).catch(() => undefined);
        router.push("/admin/login");
        router.refresh();
      }
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="flex h-full flex-col justify-between bg-white">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-16 shrink-0 items-center border-b border-[#E2E8F0] px-5">
          <BrandHeader
            shortName={shortName}
            organizationName="Panel Panitia"
            logoUrl={logoUrl}
            href="/admin/dashboard"
            size="sm"
          />
        </div>

        <nav
          aria-label="Navigasi Panel Panitia"
          className="flex-1 space-y-5 overflow-y-auto px-3 py-4 text-[13px]"
        >
          {visibleGroups.map((group) => (
            <div key={group.title}>
              <div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.06em] text-[#94A3B8]">
                {group.title}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex h-10 items-center gap-2.5 rounded-[10px] px-3 transition-colors",
                        isActive
                          ? "bg-[#FFF0EE] font-semibold text-[#D93829]"
                          : "font-medium text-[#334155] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isActive ? "text-[#D93829]" : "text-[#64748B]"
                        )}
                        aria-hidden="true"
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="shrink-0 border-t border-[#E2E8F0] p-3">
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex h-10 w-full items-center gap-2.5 rounded-[10px] px-3 text-[13px] font-medium text-[#334155] transition-colors hover:bg-[#FEF2F2] hover:text-[#D93829] disabled:opacity-50"
        >
          {isLoggingOut ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4 shrink-0 text-[#64748B]" />
          )}
          <span>Keluar</span>
        </button>
      </div>
    </div>
  );
}

export function AdminSidebar({
  shortName,
  logoUrl,
  role = "super_admin",
  onLogout,
  className,
}: AdminSidebarProps) {
  return (
    <aside
      className={cn(
        "hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-60 lg:flex-col border-r border-[#E2E8F0] bg-white",
        className
      )}
    >
      <AdminSidebarContent
        shortName={shortName}
        logoUrl={logoUrl}
        role={role}
        onLogout={onLogout}
      />
    </aside>
  );
}
