import * as React from "react";
import { cn } from "@/lib/utils";
import type { ElectionStatus, VoterStatus } from "@/types/votera";

export type StatusPillVariant =
  | ElectionStatus
  | VoterStatus
  | "active"
  | "inactive"
  | "ready"
  | "not_ready"
  | "admin"
  | "voter"
  | "system";

type PillTone = "success" | "warning" | "danger" | "neutral" | "brand";

const STATUS_META: Record<
  StatusPillVariant,
  { label: string; tone: PillTone; defaultPulse?: boolean }
> = {
  open: { label: "Dibuka", tone: "success", defaultPulse: true },
  draft: { label: "Belum dibuka", tone: "warning" },
  closed: { label: "Ditutup", tone: "danger" },
  archived: { label: "Diarsipkan", tone: "neutral" },
  not_voted: { label: "Belum memilih", tone: "neutral" },
  logged_in: { label: "Sudah login", tone: "warning" },
  voted: { label: "Sudah memilih", tone: "success" },
  active: { label: "Aktif", tone: "success" },
  inactive: { label: "Nonaktif", tone: "neutral" },
  ready: { label: "Siap", tone: "success" },
  not_ready: { label: "Belum siap", tone: "warning" },
  admin: { label: "Panitia", tone: "brand" },
  voter: { label: "Pemilih", tone: "success" },
  system: { label: "Sistem", tone: "neutral" },
};

const TONE_CLASSES: Record<
  PillTone,
  { container: string; bordered: string; dot: string }
> = {
  success: {
    container: "bg-[#DCFCE7] text-[#15803D]",
    bordered: "border border-[#A7F3D0]",
    dot: "bg-[#16A34A]",
  },
  warning: {
    container: "bg-[#FEF3C7] text-[#B45309]",
    bordered: "border border-[#FDE68A]",
    dot: "bg-[#D97706]",
  },
  danger: {
    container: "bg-[#FEE2E2] text-[#DC2626]",
    bordered: "border border-[#FECACA]",
    dot: "bg-[#DC2626]",
  },
  neutral: {
    container: "bg-[#F1F5F9] text-[#64748B]",
    bordered: "border border-[#E2E8F0]",
    dot: "bg-[#94A3B8]",
  },
  brand: {
    container: "bg-[#FFF0EE] text-[#D93829]",
    bordered: "border border-[#FECACA]",
    dot: "bg-[#D93829]",
  },
};

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusPillVariant;
  label?: string;
  showDot?: boolean;
  pulse?: boolean;
  bordered?: boolean;
  size?: "sm" | "md";
}

export function StatusPill({
  status,
  label,
  showDot = true,
  pulse,
  bordered = false,
  size = "md",
  className,
  ...props
}: StatusPillProps) {
  const meta = STATUS_META[status];
  const tone = TONE_CLASSES[meta.tone];
  const shouldPulse = pulse ?? Boolean(meta.defaultPulse);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap",
        size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
        tone.container,
        bordered && tone.bordered,
        className
      )}
      {...props}
    >
      {showDot && (
        <span
          aria-hidden="true"
          className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0",
            tone.dot,
            shouldPulse && "animate-pulse"
          )}
        />
      )}
      <span>{label ?? meta.label}</span>
    </span>
  );
}
