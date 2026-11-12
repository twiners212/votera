import * as React from "react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CurvedRedFooterProps {
  shortName?: string;
  organizationName?: string;
  title?: string;
  year?: number;
  className?: string;
}

export function CurvedRedFooter({
  shortName = "PILKETOS 2026",
  organizationName = "SMA Bojong Gede",
  title = "Sistem Pemilihan Ketua OSIS",
  year = 2026,
  className,
}: CurvedRedFooterProps) {
  return (
    <footer className={cn("relative z-20 w-full mt-auto", className)}>
      <div className="w-full overflow-hidden leading-none">
        <svg
          aria-hidden="true"
          className="relative block h-10 w-full text-[#D93829] md:h-14"
          fill="currentColor"
          preserveAspectRatio="none"
          viewBox="0 0 1440 80"
        >
          <path d="M0,32L80,37.3C160,43,320,53,480,48C640,43,800,21,960,16C1120,11,1280,21,1360,26.7L1440,32L1440,80L1360,80C1280,80,1120,80,960,80C800,80,640,80,480,80C320,80,160,80,80,80L0,80Z" />
        </svg>
      </div>

      <div className="bg-[#D93829] px-5 pb-8 pt-2 text-white sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/25 bg-white/15 text-white">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-white">
                {shortName}
              </div>
              <div className="text-[11px] font-medium leading-none text-white/85">
                {organizationName}
              </div>
            </div>
          </div>

          <div className="text-center md:text-right">
            <p className="text-xs text-white/95">
              &copy; {year} {organizationName} &mdash; {title}
            </p>
            <p className="mt-0.5 text-[11px] text-white/75">
              Prinsip Luber &amp; Jurdil &middot; Satu Orang, Satu Suara
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
