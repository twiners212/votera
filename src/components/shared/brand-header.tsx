import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface BrandHeaderProps {
  shortName?: string;
  organizationName?: string;
  logoUrl?: string | null;
  href?: string;
  variant?: "light" | "onDark";
  size?: "sm" | "md";
  className?: string;
}

function splitHighlightedSuffix(shortName: string): {
  prefix: string;
  highlight: string | null;
} {
  const trimmed = shortName.trim();
  const match = trimmed.match(/^(.*?)(\s+\d{4})$/);
  if (!match) {
    return { prefix: trimmed, highlight: null };
  }
  return {
    prefix: match[1],
    highlight: match[2].trim(),
  };
}

export function BrandHeader({
  shortName = "PILKETOS 2026",
  organizationName = "SMA Bojong Gede",
  logoUrl,
  href,
  variant = "light",
  size = "md",
  className,
}: BrandHeaderProps) {
  const resolvedLogo = logoUrl || "/images/logo-default.png";
  const { prefix, highlight } = splitHighlightedSuffix(shortName);

  const isSmall = size === "sm";
  const isDark = variant === "onDark";

  const content = (
    <div
      className={cn(
        "flex items-center gap-3 min-w-0 max-w-full overflow-hidden",
        className
      )}
      title={`${shortName} — ${organizationName}`}
    >
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-full border shadow-sm",
          isSmall ? "h-9 w-9" : "h-10 w-10",
          isDark
            ? "border-amber-300/80 bg-white/95"
            : "border-[#E2E8F0] bg-white"
        )}
      >
        <Image
          src={resolvedLogo}
          alt={`Logo ${organizationName}`}
          fill
          sizes={isSmall ? "36px" : "40px"}
          className="object-cover"
          unoptimized
        />
      </div>
      <div className="min-w-0 flex-1 overflow-hidden leading-tight">
        <div
          title={shortName}
          className={cn(
            "truncate font-extrabold tracking-tight",
            isSmall ? "text-[13px]" : "text-sm sm:text-[15px]",
            isDark ? "text-white" : "text-[#0F172A]"
          )}
        >
          {prefix}
          {highlight && (
            <>
              {" "}
              <span className={isDark ? "text-[#FDE047]" : "text-[#D93829]"}>
                {highlight}
              </span>
            </>
          )}
        </div>
        <div
          title={organizationName}
          className={cn(
            "truncate font-medium",
            isSmall ? "text-[11px]" : "text-xs",
            isDark ? "text-rose-100/90" : "text-[#64748B]"
          )}
        >
          {organizationName}
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="flex w-full min-w-0 max-w-full items-center overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]/30"
      >
        {content}
      </Link>
    );
  }

  return content;
}
