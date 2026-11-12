import * as React from "react";
import { Progress } from "@/components/ui/progress";
import { cn, formatPercentage } from "@/lib/utils";
import type { CandidateResultDTO } from "@/types/votera";

export interface CandidateLiveResultCardProps {
  candidate: CandidateResultDTO;
  isTie?: boolean;
  className?: string;
}

export function CandidateLiveResultCard({
  candidate,
  isTie = false,
  className,
}: CandidateLiveResultCardProps) {
  const isLeader = candidate.rank === 1 && candidate.voteCount > 0;
  const initial = candidate.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <article
      className={cn(
        "relative flex flex-col justify-between overflow-hidden rounded-[16px] bg-white p-5 transition-all",
        isLeader
          ? "border-[1.5px] border-[#D93829] shadow-[0_4px_12px_-2px_rgba(217,56,41,0.12)]"
          : "border border-[#E2E8F0] shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        className
      )}
    >
      {isLeader && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 bg-[#D93829]"
        />
      )}

      <div className="flex items-start justify-between gap-3 pt-0.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex shrink-0 items-center gap-2">
            <span
              aria-label={`Peringkat ${candidate.rank}`}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                isLeader
                  ? "bg-[#D93829] text-white"
                  : "bg-[#F1F5F9] text-[#64748B]"
              )}
            >
              {candidate.rank}
            </span>
            <div
              aria-hidden="true"
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-[10px] text-base font-bold",
                isLeader
                  ? "bg-[#FFF0EE] text-[#D93829]"
                  : "bg-[#F1F5F9] text-[#475569]"
              )}
            >
              {initial}
            </div>
          </div>

          <div className="min-w-0">
            <h4 className="truncate text-[15px] font-bold text-[#0F172A]">
              {candidate.name}
            </h4>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs">
              <span
                className={cn(
                  "font-bold tabular-nums",
                  isLeader ? "text-[#D93829]" : "text-[#64748B]"
                )}
              >
                No. {candidate.candidateNumber}
              </span>
              <span aria-hidden="true" className="text-[#CBD5E1]">
                &middot;
              </span>
              <span className="truncate font-medium text-[#64748B]">
                {candidate.classOrUnit}
              </span>
            </div>
          </div>
        </div>

        {isLeader && (
          <span className="shrink-0 rounded-full bg-[#FFF0EE] px-2.5 py-0.5 text-[11px] font-bold text-[#D93829]">
            {isTie ? "Imbang" : "Unggul"}
          </span>
        )}
      </div>

      <div className="mt-5 space-y-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[28px] font-extrabold leading-none tracking-tight text-[#0F172A] tabular-nums">
              {candidate.voteCount.toLocaleString("id-ID")}
            </span>
            <span className="text-xs font-medium text-[#64748B]">suara</span>
          </div>
          <span
            className={cn(
              "text-lg font-bold tabular-nums",
              isLeader ? "text-[#D93829]" : "text-[#475569]"
            )}
          >
            {formatPercentage(candidate.percentage, 1)}
          </span>
        </div>

        <Progress
          value={candidate.percentage}
          aria-label={`Perolehan suara ${candidate.name}: ${formatPercentage(candidate.percentage, 1)}`}
          className={cn("h-2", isLeader ? "bg-[#FFF0EE]" : "bg-[#F1F5F9]")}
          indicatorClassName={
            isLeader
              ? "bg-[#D93829] transition-all duration-500 ease-out"
              : "bg-[#94A3B8] transition-all duration-500 ease-out"
          }
        />
      </div>
    </article>
  );
}
