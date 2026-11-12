"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { cn, formatPercentage } from "@/lib/utils";
import type { CandidateResultDTO, CandidateTheme } from "@/types/votera";

const THEME_BAR_COLORS: Record<CandidateTheme, string> = {
  red: "#D93829",
  green: "#2F6F5E",
  blue: "#2E6F9E",
  amber: "#B45309",
};

interface ChartDatum {
  label: string;
  shortName: string;
  fullName: string;
  classOrUnit: string;
  votes: number;
  percentage: number;
  fill: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: ChartDatum }>;
}

function ResultsChartTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="rounded-[12px] border border-[#E2E8F0] bg-white px-3.5 py-2.5 shadow-md">
      <div className="text-xs font-bold text-[#D93829] tabular-nums">
        {item.label}
      </div>
      <div className="mt-0.5 text-sm font-bold text-[#0F172A]">
        {item.fullName}
      </div>
      <div className="text-[11px] font-medium text-[#64748B]">
        {item.classOrUnit}
      </div>
      <div className="mt-2 flex items-center gap-3 border-t border-[#F1F5F9] pt-1.5 text-xs">
        <span className="font-bold text-[#0F172A] tabular-nums">
          {item.votes.toLocaleString("id-ID")} suara
        </span>
        <span className="font-semibold text-[#64748B] tabular-nums">
          ({formatPercentage(item.percentage, 1)})
        </span>
      </div>
    </div>
  );
}

export interface ResultsComparisonChartProps {
  candidates: CandidateResultDTO[];
  totalVotes: number;
  className?: string;
}

export function ResultsComparisonChart({
  candidates,
  totalVotes,
  className,
}: ResultsComparisonChartProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const chartData: ChartDatum[] = React.useMemo(() => {
    const ordered = [...candidates].sort(
      (a, b) => a.candidateNumber - b.candidateNumber
    );
    return ordered.map((c) => {
      const isLeader = c.rank === 1 && c.voteCount > 0;
      const fill = isLeader
        ? "#D93829"
        : c.voteCount > 0
          ? THEME_BAR_COLORS[c.themeColor] ?? "#64748B"
          : "#CBD5E1";

      return {
        label: `No. ${c.candidateNumber}`,
        shortName: `No. ${c.candidateNumber} · ${c.name.split(" ")[0] ?? c.name}`,
        fullName: c.name,
        classOrUnit: c.classOrUnit,
        votes: c.voteCount,
        percentage: c.percentage,
        fill,
      };
    });
  }, [candidates]);

  return (
    <section
      aria-label="Grafik Perbandingan Perolehan Suara"
      className={cn(
        "rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6",
        className
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-[#0F172A]">
            Perbandingan Perolehan Suara
          </h3>
          <p className="mt-0.5 text-xs text-[#64748B]">
            Distribusi suara masuk per kandidat berdasarkan nomor urut.
          </p>
        </div>

        <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1 text-xs font-semibold text-[#475569] tabular-nums">
          <BarChart3 className="h-3.5 w-3.5 text-[#D93829]" aria-hidden="true" />
          <span>Total {totalVotes.toLocaleString("id-ID")} suara</span>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="mt-4 flex h-[220px] items-center justify-center rounded-[12px] border border-dashed border-[#E2E8F0] bg-[#F8FAFC] text-xs font-medium text-[#64748B]">
          Belum ada data kandidat untuk ditampilkan.
        </div>
      ) : (
        <div className="mt-5 h-[260px] w-full">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 16, left: -12, bottom: 4 }}
                barCategoryGap="24%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#F1F5F9"
                />
                <XAxis
                  dataKey="shortName"
                  tickLine={false}
                  axisLine={{ stroke: "#E2E8F0" }}
                  tick={{ fill: "#475569", fontSize: 12, fontWeight: 600 }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748B", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "#F8FAFC" }}
                  content={<ResultsChartTooltip />}
                />
                <Bar dataKey="votes" radius={[8, 8, 0, 0]} maxBarSize={64}>
                  {chartData.map((entry) => (
                    <Cell key={entry.label} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full animate-pulse rounded-[12px] bg-[#F8FAFC]" />
          )}
        </div>
      )}
    </section>
  );
}
