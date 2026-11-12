import * as React from "react";
import Link from "next/link";
import { StatusPill } from "@/components/shared/status-pill";
import { cn } from "@/lib/utils";
import type { AuditLogDTO } from "@/types/votera";

export interface RecentActivityCardProps {
  activities: AuditLogDTO[];
  className?: string;
}

function formatActivityTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function RecentActivityCard({
  activities,
  className,
}: RecentActivityCardProps) {
  const latestActivities = activities.slice(0, 5);

  return (
    <section
      aria-labelledby="recent-activity-heading"
      className={cn(
        "rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6",
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3
          id="recent-activity-heading"
          className="text-sm font-bold text-[#0F172A]"
        >
          Aktivitas terbaru
        </h3>
        <Link
          href="/admin/logs"
          className="text-xs font-semibold text-[#D93829] transition-colors hover:text-[#B8281B] hover:underline"
        >
          Semua log
        </Link>
      </div>

      {latestActivities.length === 0 ? (
        <p className="py-4 text-center text-xs text-[#64748B]">
          Belum ada aktivitas tercatat.
        </p>
      ) : (
        <ul className="divide-y divide-[#F1F5F9]">
          {latestActivities.map((item) => (
            <li key={item.id} className="py-3 first:pt-0 last:pb-0">
              <div className="text-xs font-semibold leading-snug text-[#0F172A]">
                {item.description || item.actionTitle}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#64748B]">
                <StatusPill
                  status={item.actorType}
                  showDot={false}
                  size="sm"
                  className="px-2 py-0 text-[10px]"
                />
                <code className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#475569]">
                  {item.action}
                </code>
                <span aria-hidden="true" className="text-[#CBD5E1]">
                  •
                </span>
                <time
                  dateTime={item.createdAt}
                  className="text-[#94A3B8] tabular-nums"
                >
                  {formatActivityTime(item.createdAt)}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
