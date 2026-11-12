import * as React from "react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { GroupParticipationDTO } from "@/types/votera";

export interface ParticipationGroupCardProps {
  groups: GroupParticipationDTO[];
  groupLabel?: string;
  className?: string;
}

function formatPercentage(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(safeValue);
}

export function ParticipationGroupCard({
  groups,
  groupLabel = "Rombel",
  className,
}: ParticipationGroupCardProps) {
  return (
    <section
      aria-labelledby="participation-group-heading"
      className={cn(
        "overflow-hidden rounded-[16px] border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[#F1F5F9] px-5 py-4 sm:px-6">
        <h3
          id="participation-group-heading"
          className="text-sm font-bold text-[#0F172A]"
        >
          Partisipasi per {groupLabel}
        </h3>
        <Link
          href="/admin/voters"
          className="text-xs font-semibold text-[#D93829] transition-colors hover:text-[#B8281B] hover:underline"
        >
          Kelola pemilih
        </Link>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title={`Belum ada data ${groupLabel.toLowerCase()}`}
          description={`Tambahkan data ${groupLabel.toLowerCase()} dan daftar pemilih untuk memantau progres partisipasi.`}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-5 sm:px-6">{groupLabel}</TableHead>
              <TableHead className="w-28 px-4 text-center">Memilih</TableHead>
              <TableHead className="px-5 sm:px-6">Progres</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => {
              const clampedPercentage = Math.min(
                100,
                Math.max(0, Number.isFinite(group.percentage) ? group.percentage : 0)
              );

              return (
                <TableRow key={group.groupId}>
                  <TableCell className="px-5 py-3.5 text-xs font-semibold text-[#0F172A] sm:px-6">
                    <div>{group.groupName}</div>
                    {(group.gradeName || group.majorName) && (
                      <div className="mt-0.5 text-[11px] font-normal text-[#64748B]">
                        {[group.gradeName, group.majorName]
                          .filter(Boolean)
                          .join(" • ")}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 text-center text-xs font-medium text-[#334155] tabular-nums">
                    {group.votedMembers} / {group.totalMembers}
                  </TableCell>
                  <TableCell className="px-5 py-3.5 sm:px-6">
                    <div className="flex items-center gap-3">
                      <Progress
                        value={clampedPercentage}
                        aria-label={`Partisipasi ${group.groupName}: ${formatPercentage(clampedPercentage)}%`}
                        className="h-2 max-w-[200px]"
                        indicatorClassName="bg-[#D93829]"
                      />
                      <span className="w-11 shrink-0 text-right text-xs font-semibold text-[#64748B] tabular-nums">
                        {formatPercentage(clampedPercentage)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
