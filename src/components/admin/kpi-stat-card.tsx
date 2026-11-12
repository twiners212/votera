import * as React from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type KpiIconColor = "red" | "blue" | "green" | "amber";

const ICON_COLOR_CLASSES: Record<KpiIconColor, string> = {
  red: "bg-[#FFF0EE] text-[#D93829]",
  blue: "bg-[#EFF6FF] text-[#2563EB]",
  green: "bg-[#DCFCE7] text-[#15803D]",
  amber: "bg-[#FEF3C7] text-[#B45309]",
};

export interface KpiStatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  variant?: "icon" | "compact";
  icon?: React.ReactNode;
  iconColor?: KpiIconColor;
  progressValue?: number;
  progressIndicatorClassName?: string;
  valueClassName?: string;
  className?: string;
}

export function KpiStatCard({
  label,
  value,
  subtext,
  variant = "compact",
  icon,
  iconColor = "red",
  progressValue,
  progressIndicatorClassName = "bg-[#16A34A]",
  valueClassName,
  className,
}: KpiStatCardProps) {
  const isIconVariant = variant === "icon";

  return (
    <div
      className={cn(
        "rounded-[16px] border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        isIconVariant ? "p-5" : "px-5 py-4",
        className
      )}
    >
      {isIconVariant && icon && (
        <div
          className={cn(
            "mb-3 flex h-9 w-9 items-center justify-center rounded-full",
            ICON_COLOR_CLASSES[iconColor]
          )}
        >
          {icon}
        </div>
      )}

      <div
        className={cn(
          "font-extrabold leading-tight tracking-tight text-[#0F172A] tabular-nums",
          isIconVariant ? "text-[28px]" : "text-[26px]",
          valueClassName
        )}
      >
        {value}
      </div>

      <div className="mt-1 text-xs font-medium text-[#64748B]">{label}</div>

      {subtext && (
        <div className="mt-0.5 text-[11px] font-medium text-[#94A3B8] tabular-nums">
          {subtext}
        </div>
      )}

      {typeof progressValue === "number" && (
        <Progress
          value={progressValue}
          className="mt-3 h-1.5"
          indicatorClassName={progressIndicatorClassName}
        />
      )}
    </div>
  );
}
