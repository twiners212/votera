import * as React from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  resetLabel?: string;
  onReset?: () => void;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title = "Data tidak ditemukan",
  description = "Coba ubah kata kunci pencarian atau setel ulang filter yang aktif.",
  icon,
  resetLabel = "Reset filter",
  onReset,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className
      )}
    >
      <div className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-full bg-[#F1F5F9] text-[#64748B]">
        {icon ?? <Search className="h-5 w-5" aria-hidden="true" />}
      </div>
      <h3 className="text-sm font-bold text-[#0F172A]">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-[#64748B]">
          {description}
        </p>
      )}
      {onReset && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReset}
          className="mt-4"
        >
          {resetLabel}
        </Button>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
