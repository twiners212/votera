"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  Check,
  RefreshCw,
  User,
  Users,
} from "lucide-react";
import { ElectionReadinessCard } from "@/components/admin/election-readiness-card";
import { KpiStatCard } from "@/components/admin/kpi-stat-card";
import { ParticipationGroupCard } from "@/components/admin/participation-group-card";
import { RecentActivityCard } from "@/components/admin/recent-activity-card";
import { ScheduleQuickDialog } from "@/components/admin/schedule-quick-dialog";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { isElectionScheduleExpired } from "@/lib/admin/election-state";
import type { ElectionStatus } from "@/types/votera";

const ELECTION_STATUS_LABELS: Record<ElectionStatus, string> = {
  open: "Pemungutan suara dibuka",
  draft: "Pemungutan suara belum dibuka",
  closed: "Pemungutan suara ditutup",
  archived: "Pemilihan diarsipkan",
};

function formatInteger(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("id-ID").format(safe);
}

function formatPercentage(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(safe);
}

function formatScheduleDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatScheduleRange(
  startAt: string | null,
  endAt: string | null
): string {
  if (!startAt || !endAt) {
    return "Jadwal pemungutan suara belum diatur";
  }
  return `${formatScheduleDateTime(startAt)} – ${formatScheduleDateTime(endAt)}`;
}

function DashboardSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Memuat statistik dashboard"
      className="space-y-6 animate-pulse"
    >
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-lg bg-[#E2E8F0]" />
          <div className="h-4 w-72 rounded-md bg-[#E2E8F0]" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-9 w-28 rounded-[10px] bg-[#E2E8F0]" />
          <div className="h-9 w-28 rounded-[10px] bg-[#E2E8F0]" />
        </div>
      </div>

      <div className="h-20 rounded-[16px] border border-[#E2E8F0] bg-white p-5" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-36 rounded-[16px] border border-[#E2E8F0] bg-white p-5"
          >
            <div className="mb-3 h-9 w-9 rounded-full bg-[#F1F5F9]" />
            <div className="h-7 w-16 rounded-md bg-[#E2E8F0]" />
            <div className="mt-2 h-3.5 w-28 rounded bg-[#F1F5F9]" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)]">
        <div className="h-80 rounded-[16px] border border-[#E2E8F0] bg-white p-6" />
        <div className="space-y-6">
          <div className="h-48 rounded-[16px] border border-[#E2E8F0] bg-white p-6" />
          <div className="h-36 rounded-[16px] border border-[#E2E8F0] bg-white p-6" />
        </div>
      </div>
    </div>
  );
}

export interface DashboardOverviewProps {
  electionId?: string;
  adminName?: string;
}

export function DashboardOverview({
  electionId = "active",
  adminName = "Super Admin",
}: DashboardOverviewProps) {
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const { data, isLoading, isError, error, refetch, isFetching } =
    useDashboardStats(electionId);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[16px] border border-[#FECACA] bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#FEE2E2] text-[#DC2626]">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="text-base font-bold text-[#0F172A]">
          Gagal memuat data dashboard
        </h2>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-[#64748B]">
          {error?.message ??
            "Statistik pemilihan belum tersedia. Periksa koneksi atau coba muat ulang."}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"}
              aria-hidden="true"
            />
            Muat ulang
          </Button>
          <Button asChild size="sm">
            <Link href="/">Lihat beranda</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { election, summary, groupParticipation, readiness, recentActivities } =
    data;
  const groupLabel = election.settings.groupLabel || "Kelas";
  const isScheduleExpired = isElectionScheduleExpired({
    status: election.status,
    startAt: election.startAt,
    endAt: election.endAt,
  });

  return (
    <div className="space-y-6">
      {/* Banner Peringatan: Jadwal Telah Berakhir Saat Status Masih Open */}
      {isScheduleExpired && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-[14px] border border-amber-300 bg-amber-50/90 p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-amber-950 sm:text-sm">
                Jadwal Pemilihan Telah Berakhir &mdash; Bilik Suara Otomatis Terkunci
              </p>
              <p className="text-xs leading-relaxed text-amber-800">
                Waktu selesai pemilihan (
                <span className="font-semibold tabular-nums">
                  {election.endAt ? formatScheduleDateTime(election.endAt) : "-"}
                </span>
                ) telah terlewati. Pemilih tidak dapat lagi login atau mengirim suara. Silakan buka Pengaturan untuk meresmikan status menjadi <strong>Closed (Ditutup)</strong>.
              </p>
            </div>
          </div>
          <Link
            href="/admin/settings"
            className="shrink-0 self-start sm:self-center"
          >
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-[8px] bg-amber-600 px-3 text-xs font-semibold text-white shadow-xs hover:bg-amber-700"
            >
              Buka Pengaturan
            </Button>
          </Link>
        </div>
      )}

      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">
            Halo, {adminName}
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Ringkasan pemilihan{" "}
            <span className="font-medium text-[#334155]">{election.title}</span>{" "}
            secara langsung.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            asChild
            variant="outline"
            className="h-9 border-[#FECACA] px-4 text-xs text-[#D93829] hover:bg-[#FFF0EE] hover:text-[#B8281B]"
          >
            <Link href="/">Lihat beranda</Link>
          </Button>
          <Button
            type="button"
            onClick={() => setScheduleOpen(true)}
            className="h-9 px-4 text-xs"
          >
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            Atur jadwal
          </Button>
        </div>
      </section>

      <section
        aria-label="Status pemungutan suara"
        className="flex flex-col justify-between gap-3 rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center"
      >
        <div>
          <div className="text-sm font-semibold text-[#0F172A]">
            Status pemungutan suara
          </div>
          <div className="mt-0.5 text-xs text-[#64748B] tabular-nums">
            {formatScheduleRange(election.startAt, election.endAt)}
          </div>
        </div>
        <div>
          <StatusPill
            status={election.status}
            label={ELECTION_STATUS_LABELS[election.status]}
            bordered
          />
        </div>
      </section>

      <section
        aria-label="Statistik utama pemilihan"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <KpiStatCard
          variant="icon"
          icon={<User className="h-4 w-4" aria-hidden="true" />}
          iconColor="red"
          value={formatInteger(summary.activeCandidates)}
          label="Kandidat aktif"
        />
        <KpiStatCard
          variant="icon"
          icon={<Users className="h-4 w-4" aria-hidden="true" />}
          iconColor="blue"
          value={formatInteger(summary.totalVoters)}
          label="Total pemilih DPT"
        />
        <KpiStatCard
          variant="icon"
          icon={<Check className="h-4 w-4" aria-hidden="true" />}
          iconColor="green"
          value={formatInteger(summary.votesCast)}
          label="Sudah memilih"
          subtext={`${formatInteger(summary.notVoted)} belum memilih`}
        />
        <KpiStatCard
          variant="icon"
          icon={<BarChart3 className="h-4 w-4" aria-hidden="true" />}
          iconColor="amber"
          value={`${formatPercentage(summary.turnoutPercentage)}%`}
          label="% Partisipasi"
          progressValue={summary.turnoutPercentage}
          progressIndicatorClassName="bg-[#16A34A]"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)]">
        <ParticipationGroupCard
          groups={groupParticipation}
          groupLabel={groupLabel}
        />

        <div className="space-y-6">
          <ElectionReadinessCard
            readiness={readiness}
            activeCandidates={summary.activeCandidates}
            totalVoters={summary.totalVoters}
            organizationName={election.organizationName}
          />
          <RecentActivityCard activities={recentActivities} />
        </div>
      </section>

      <ScheduleQuickDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        election={election}
      />
    </div>
  );
}
