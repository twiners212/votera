"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { BrandHeader } from "@/components/shared/brand-header";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ElectionStatus, VoterSessionDTO } from "@/types/votera";

export interface PublicNavbarProps {
  shortName?: string;
  organizationName?: string;
  logoUrl?: string | null;
  status?: ElectionStatus;
  statusLabel?: string;
  voter?: VoterSessionDTO | null;
  onLogout?: () => void | Promise<void>;
  maxWidthClassName?: string;
  className?: string;
}

export function PublicNavbar({
  shortName = "PILKETOS 2026",
  organizationName = "SMA Bojong Gede",
  logoUrl,
  status = "open",
  statusLabel,
  voter = null,
  onLogout,
  maxWidthClassName = "max-w-7xl",
  className,
}: PublicNavbarProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const resolvedStatusLabel =
    statusLabel ??
    (status === "open"
      ? voter
        ? "Pemungutan suara dibuka"
        : "Dibuka"
      : undefined);

  const voterInitial = voter?.name?.trim().charAt(0).toUpperCase() || "P";

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      if (onLogout) {
        await onLogout();
      } else {
        await fetch("/api/voter/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-30 w-full border-b border-[#E2E8F0] bg-white/95 backdrop-blur-sm",
        className
      )}
    >
      <div
        className={cn(
          "mx-auto flex h-16 items-center justify-between gap-3 px-4 sm:px-6",
          maxWidthClassName
        )}
      >
        <BrandHeader
          shortName={shortName}
          organizationName={organizationName}
          logoUrl={logoUrl}
          href="/"
          size="md"
        />

        <div className="flex items-center gap-2.5 sm:gap-4">
          <StatusPill
            status={status}
            label={resolvedStatusLabel}
            bordered
            className={voter ? "hidden sm:inline-flex" : "inline-flex"}
          />

          {voter && (
            <>
              <div className="flex items-center gap-2.5">
                <div
                  aria-label={`Profil ${voter.name}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#FECACA] bg-[#FFF0EE] text-xs font-extrabold text-[#D93829]"
                >
                  {voterInitial}
                </div>
                <div className="hidden text-left leading-tight md:block">
                  <div className="text-xs font-bold text-[#0F172A]">
                    {voter.name}
                  </div>
                  <div className="mt-0.5 text-[11px] font-medium text-[#64748B]">
                    {voter.groupName}
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="h-9 gap-1.5 border-[#E2E8F0] px-3 text-xs font-semibold text-[#334155]"
              >
                {isLoggingOut ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LogOut className="h-3.5 w-3.5 text-[#64748B]" />
                )}
                <span>Keluar</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
