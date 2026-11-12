import * as React from "react";
import { Check, Clock } from "lucide-react";
import { StatusPill } from "@/components/shared/status-pill";
import { cn } from "@/lib/utils";
import type { ElectionReadinessDTO } from "@/types/votera";

export interface ElectionReadinessCardProps {
  readiness: ElectionReadinessDTO;
  activeCandidates?: number;
  totalVoters?: number;
  organizationName?: string;
  className?: string;
}

interface ReadinessCheckItem {
  key: keyof ElectionReadinessDTO["checks"];
  label: string;
  passed: boolean;
}

export function ElectionReadinessCard({
  readiness,
  activeCandidates,
  totalVoters,
  organizationName,
  className,
}: ElectionReadinessCardProps) {
  const { checks } = readiness;

  const items: ReadinessCheckItem[] = [
    {
      key: "hasMinTwoActiveCandidates",
      passed: checks.hasMinTwoActiveCandidates,
      label:
        typeof activeCandidates === "number"
          ? `Minimal 2 kandidat aktif (sekarang ${activeCandidates})`
          : "Minimal 2 kandidat aktif",
    },
    {
      key: "hasVotersRegistered",
      passed: checks.hasVotersRegistered,
      label:
        typeof totalVoters === "number"
          ? `Daftar pemilih (DPT) sudah terisi (${totalVoters} pemilih)`
          : "Daftar pemilih (DPT) sudah terisi",
    },
    {
      key: "hasScheduleConfigured",
      passed: checks.hasScheduleConfigured,
      label: "Jadwal pemungutan suara sudah diatur",
    },
    {
      key: "hasOrganizationName",
      passed: checks.hasOrganizationName,
      label: organizationName
        ? `Nama instansi sudah diisi (${organizationName})`
        : "Nama instansi/sekolah sudah diisi",
    },
  ];

  return (
    <section
      aria-labelledby="election-readiness-heading"
      className={cn(
        "rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6",
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3
          id="election-readiness-heading"
          className="text-sm font-bold text-[#0F172A]"
        >
          Kesiapan pemilihan
        </h3>
        <StatusPill
          status={readiness.isReady ? "ready" : "not_ready"}
          label={readiness.isReady ? "Siap" : "Belum Siap"}
          showDot={false}
          size="sm"
          bordered
        />
      </div>

      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-center justify-between gap-3 text-xs"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  item.passed
                    ? "bg-[#DCFCE7] text-[#15803D]"
                    : "bg-[#FEF3C7] text-[#B45309]"
                )}
              >
                {item.passed ? (
                  <Check className="h-3 w-3 stroke-[2.5]" />
                ) : (
                  <Clock className="h-3 w-3" />
                )}
              </span>
              <span
                className={cn(
                  "leading-snug tabular-nums",
                  item.passed ? "text-[#334155]" : "text-[#64748B]"
                )}
              >
                {item.label}
              </span>
            </div>

            <StatusPill
              status={item.passed ? "ready" : "not_ready"}
              label={item.passed ? "Siap" : "Belum Siap"}
              showDot={false}
              size="sm"
              className="shrink-0 px-2 py-0.5 text-[10px]"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
