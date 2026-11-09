"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  Award,
  Users,
  BarChart2,
  Layers,
  BookOpen,
  SlidersHorizontal,
  Clock,
  ShieldCheck,
  LogOut,
  ExternalLink,
  Shield,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/admin-client";
import { toast } from "sonner";

interface AdminSidebarProps {
  onNavClick?: () => void;
  className?: string;
}

export function AdminSidebar({ onNavClick, className }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const isSuperAdmin = session?.user?.role === "super_admin";

  const navGroups = [
    {
      label: "Utama",
      items: [
        {
          name: "Dashboard",
          href: "/admin/dashboard",
          icon: LayoutGrid,
        },
      ],
    },
    {
      label: "Pemilihan",
      items: [
        {
          name: "Kandidat",
          href: "/admin/candidates",
          icon: Award,
        },
        {
          name: "Pemilih (DPT)",
          href: "/admin/voters",
          icon: Users,
        },
        {
          name: "Hasil & Laporan",
          href: "/admin/results",
          icon: BarChart2,
        },
      ],
    },
    {
      label: "Data Master",
      items: [
        {
          name: "Tingkat & Rombel",
          href: "/admin/classes",
          icon: Layers,
        },
        {
          name: "Jurusan",
          href: "/admin/majors",
          icon: BookOpen,
        },
      ],
    },
    {
      label: "Sistem",
      items: [
        {
          name: "Pengaturan",
          href: "/admin/settings",
          icon: SlidersHorizontal,
        },
        {
          name: "Log Aktivitas",
          href: "/admin/logs",
          icon: Clock,
        },
        ...(isSuperAdmin
          ? [
              {
                name: "Kelola Admin",
                href: "/admin/users",
                icon: ShieldCheck,
              },
            ]
          : []),
      ],
    },
  ];

  const handleSignOut = async () => {
    try {
      setIsLoggingOut(true);
      await authClient.signOut();
      toast.success("Berhasil Keluar", {
        description: "Sesi administrator telah diakhiri.",
      });
      window.location.href = "/admin/login";
    } catch {
      toast.error("Gagal Keluar", {
        description: "Terjadi kesalahan saat mengakhiri sesi.",
      });
      setIsLoggingOut(false);
    }
  };

  return (
    <aside
      className={cn(
        "w-[240px] flex-shrink-0 bg-white border-r border-[#E2E8F0] min-h-screen flex flex-col justify-between select-none",
        className
      )}
    >
      <div>
        {/* Brand & Emblem Logo Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-[#E2E8F0]">
          <Link
            href="/admin/dashboard"
            onClick={onNavClick}
            className="flex items-center gap-3 group"
          >
            <div className="w-8 h-8 rounded-full border border-amber-300 bg-amber-50 flex items-center justify-center shadow-xs transition-transform group-hover:scale-105">
              <Shield className="w-4 h-4 text-amber-600" />
            </div>
            <div className="leading-tight">
              <div className="font-extrabold text-[13px] tracking-tight text-slate-900">
                PILKETOS <span className="text-[#C8322B]">2026</span>
              </div>
              <div className="text-[11px] font-medium text-slate-400">SMA Bojong Gede</div>
            </div>
          </Link>
          <span className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-50 animate-pulse" title="Sistem Aktif" />
        </div>

        {/* Navigation Groups */}
        <nav className="px-3 py-4 space-y-5 text-[13px]">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="px-3 mb-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/admin/dashboard"
                      ? pathname === "/admin/dashboard"
                      : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavClick}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors",
                        isActive
                          ? "bg-[#FCE8E6] text-[#C8322B] font-semibold shadow-xs"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-4 h-4 shrink-0 transition-colors",
                          isActive ? "text-[#C8322B]" : "text-slate-500"
                        )}
                      />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom Area: User Info & Logout */}
      <div className="p-3 border-t border-[#E2E8F0] space-y-2">
        {/* Portal Link */}
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
        >
          <span className="flex items-center gap-2">
            <ExternalLink className="w-3.5 h-3.5" />
            Portal Pemilih
          </span>
          <span className="text-[10px] font-mono text-slate-400">Tab Baru ↗</span>
        </Link>

        {/* User Card */}
        <div className="px-3 py-2 rounded-lg bg-slate-50/70 border border-slate-100 flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <p className="text-xs font-semibold text-slate-800 truncate">
              {session?.user?.name || "Admin Votera"}
            </p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <span className="font-mono">@{session?.user?.username || "admin"}</span>
              <span>•</span>
              <span className="capitalize text-slate-600 font-medium">
                {session?.user?.role === "super_admin" ? "Super Admin" : "Panitia"}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isLoggingOut}
            title="Keluar"
            className="p-1.5 rounded-md text-slate-400 hover:text-[#C8322B] hover:bg-rose-50 transition-colors"
          >
            {isLoggingOut ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#C8322B]" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
