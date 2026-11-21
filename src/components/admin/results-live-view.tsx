"use client";

import * as React from "react";
import {
  AlertCircle,
  Clock,
  FileSpreadsheet,
  FileText,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { CandidateLiveResultCard } from "@/components/admin/candidate-live-result-card";
import { KpiStatCard } from "@/components/admin/kpi-stat-card";
import { ResultsComparisonChart } from "@/components/admin/results-comparison-chart";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useElectionResults } from "@/hooks/use-election-results";
import { exportResultsWorkbookFile } from "@/lib/reports/export-excel";
import { exportBeritaAcaraPdfFile } from "@/lib/reports/export-pdf";
import { cn, formatDateWIB, formatPercentage } from "@/lib/utils";
import type { AuditLogDTO, ElectionStatus } from "@/types/votera";

const ELECTION_STATUS_LABELS: Record<ElectionStatus, string> = {
  open: "Sedang berlangsung",
  draft: "Belum dibuka",
  closed: "Ditutup",
  archived: "Diarsipkan",
};

function ResultsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Memuat hasil pemilihan">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-2">
          <div className="h-7 w-48 animate-pulse rounded-lg bg-[#E2E8F0]" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-[#E2E8F0]" />
        </div>
        <div className="flex gap-2.5">
          <div className="h-10 w-28 animate-pulse rounded-[10px] bg-[#E2E8F0]" />
          <div className="h-10 w-32 animate-pulse rounded-[10px] bg-[#E2E8F0]" />
          <div className="h-10 w-36 animate-pulse rounded-[10px] bg-[#E2E8F0]" />
        </div>
      </div>

      <div className="h-28 w-full animate-pulse rounded-[16px] border border-[#E2E8F0] bg-white" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((idx) => (
          <div
            key={idx}
            className="h-24 animate-pulse rounded-[16px] border border-[#E2E8F0] bg-white"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4].map((idx) => (
          <div
            key={idx}
            className="h-44 animate-pulse rounded-[16px] border border-[#E2E8F0] bg-white"
          />
        ))}
      </div>
    </div>
  );
}

export interface ResultsLiveViewProps {
  electionId?: string;
}

export function ResultsLiveView({
  electionId = "active",
}: ResultsLiveViewProps) {
  const [economyMode, setEconomyMode] = React.useState(false);
  const intervalMs: 8_000 | 30_000 = economyMode ? 30_000 : 8_000;
  const intervalSeconds = economyMode ? 30 : 8;

  const [countdown, setCountdown] = React.useState<number>(intervalSeconds);
  const [isExportingExcel, setIsExportingExcel] = React.useState(false);
  const [isExportingPdf, setIsExportingPdf] = React.useState(false);

  const {
    data,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
    dataUpdatedAt,
  } = useElectionResults(electionId, {
    autoRefresh: true,
    intervalMs,
  });

  React.useEffect(() => {
    setCountdown(intervalSeconds);
  }, [intervalSeconds, dataUpdatedAt]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? intervalSeconds : prev - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [intervalSeconds]);

  const handleManualRefresh = async () => {
    setCountdown(intervalSeconds);
    await refetch();
  };

  const handleExportExcel = async () => {
    if (!data || isExportingExcel) return;
    setIsExportingExcel(true);
    try {
      let auditLogs: AuditLogDTO[] | undefined;
      try {
        const query =
          electionId && electionId !== "active"
            ? `?limit=100&electionId=${encodeURIComponent(electionId)}`
            : "?limit=100";
        const res = await fetch(`/api/admin/logs${query}`);
        const json = await res.json().catch(() => null);
        if (json?.success && Array.isArray(json.data?.logs)) {
          auditLogs = json.data.logs;
        }
      } catch {
        // Fallback gracefully without logs if network issue occurs
      }
      exportResultsWorkbookFile(data, auditLogs);
      toast.success("File Excel hasil pemilihan berhasil diunduh.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal mengekspor file Excel."
      );
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    if (!data || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      exportBeritaAcaraPdfFile(data);
      toast.success("Berita Acara PDF berhasil diunduh.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal membuat Berita Acara PDF."
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (isLoading) {
    return <ResultsSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="rounded-[16px] border border-[#FECACA] bg-white p-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#FEE2E2] text-[#DC2626]">
          <AlertCircle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="text-base font-bold text-[#0F172A]">
          Gagal memuat hasil pemilihan
        </h2>
        <p className="mx-auto mt-1 max-w-md text-xs text-[#64748B]">
          {error?.message ??
            "Terjadi kesalahan saat mengambil data perolehan suara dari server."}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleManualRefresh()}
          className="mt-4"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          <span>Coba lagi</span>
        </Button>
      </div>
    );
  }

  const { election, summary, leadingCandidate, candidates, lastUpdatedAt } = data;

  const sortedCandidates = [...candidates].sort(
    (a, b) => a.rank - b.rank || a.candidateNumber - b.candidateNumber
  );

  const scheduleText =
    election.startAt && election.endAt
      ? `Mulai ${formatDateWIB(election.startAt)} · Selesai ${formatDateWIB(election.endAt)}`
      : election.startAt
        ? `Mulai ${formatDateWIB(election.startAt)}`
        : "Jadwal pemilihan belum diatur";

  const turnoutDecimals = Number.isInteger(summary.turnoutPercentage) ? 0 : 1;

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-[#0F172A] sm:text-2xl">
            Hasil Pemilihan
          </h1>
          <p className="max-w-2xl text-sm text-[#64748B]">
            Perolehan suara tiap kandidat. Angka ini hanya bisa dilihat panitia
            dan tidak ditampilkan ke pemilih.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-[44px] sm:h-10 sm:min-h-0"
            onClick={() => void handleManualRefresh()}
            disabled={isFetching}
          >
            <RefreshCw
              className={cn("h-4 w-4 text-[#64748B]", isFetching && "animate-spin")}
              aria-hidden="true"
            />
            <span>Segarkan</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-[44px] sm:h-10 sm:min-h-0"
            onClick={() => void handleExportExcel()}
            disabled={isExportingExcel}
          >
            <FileSpreadsheet className="h-4 w-4 text-[#15803D]" aria-hidden="true" />
            <span>{isExportingExcel ? "Mengekspor..." : "Ekspor Excel"}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-[44px] sm:h-10 sm:min-h-0"
            onClick={() => void handleExportPdf()}
            disabled={isExportingPdf}
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            <span>{isExportingPdf ? "Menyusun..." : "Berita Acara PDF"}</span>
          </Button>
        </div>
      </div>

      {/* Election Info Banner */}
      <section
        aria-label="Informasi Pemilihan Aktif"
        className="flex flex-col justify-between gap-4 rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6 md:flex-row md:items-center"
      >
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-[#0F172A]">
              {election.title}
            </h2>
            <span className="text-xs font-medium text-[#64748B]">
              &middot; {election.organizationName}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] tabular-nums">
            <Clock className="h-3.5 w-3.5 text-[#94A3B8]" aria-hidden="true" />
            <span>{scheduleText}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#DC2626]">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-[#D93829] animate-pulse"
              />
              Hasil sementara
            </span>
            <span className="text-[11px] text-[#94A3B8] tabular-nums">
              Diperbarui {formatDateWIB(lastUpdatedAt, { withSeconds: true })} WIB
            </span>
          </div>
        </div>

        <div className="shrink-0">
          <StatusPill
            status={election.status}
            label={ELECTION_STATUS_LABELS[election.status]}
          />
        </div>
      </section>

      {/* 4 Compact KPI Stat Cards */}
      <section
        aria-label="Ringkasan Partisipasi Suara"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <KpiStatCard
          variant="compact"
          label="Suara masuk"
          value={summary.votesCast.toLocaleString("id-ID")}
        />
        <KpiStatCard
          variant="compact"
          label="Total pemilih (DPT)"
          value={summary.totalVoters.toLocaleString("id-ID")}
        />
        <KpiStatCard
          variant="compact"
          label="Belum memilih"
          value={summary.notVoted.toLocaleString("id-ID")}
        />
        <KpiStatCard
          variant="compact"
          label="Partisipasi"
          value={formatPercentage(summary.turnoutPercentage, turnoutDecimals)}
          progressValue={summary.turnoutPercentage}
          progressIndicatorClassName="bg-[#16A34A]"
        />
      </section>

      {/* Perolehan Suara Section */}
      <section aria-label="Perolehan suara" className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-bold tracking-tight text-[#0F172A]">
            Perolehan suara
          </h3>

          {leadingCandidate && summary.votesCast > 0 ? (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-semibold text-[#15803D]">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-[#16A34A]"
              />
              <span className="tabular-nums">
                {leadingCandidate.isTie
                  ? `Imbang: No. ${leadingCandidate.candidateNumber} ${leadingCandidate.name}`
                  : `Unggul: No. ${leadingCandidate.candidateNumber} ${leadingCandidate.name}`}
              </span>
            </span>
          ) : (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#F1F5F9] px-3 py-1 text-xs font-semibold text-[#64748B]">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-[#94A3B8]"
              />
              <span>Belum ada suara masuk</span>
            </span>
          )}
        </div>

        {sortedCandidates.length === 0 ? (
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white">
            <EmptyState
              title="Belum ada kandidat aktif"
              description="Tambahkan kandidat di menu Kandidat agar perolehan suara dapat dipantau."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {sortedCandidates.map((candidate) => (
              <CandidateLiveResultCard
                key={candidate.id}
                candidate={candidate}
                isTie={Boolean(leadingCandidate?.isTie)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Recharts Comparison Chart */}
      <ResultsComparisonChart
        candidates={sortedCandidates}
        totalVotes={summary.votesCast}
      />

      {/* Auto-Refresh 30s Economy Mode Control */}
      <section
        aria-label="Pengaturan Pembaruan Otomatis"
        className="flex flex-col justify-between gap-4 rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center"
      >
        <label
          htmlFor="auto-refresh-30s"
          className="flex cursor-pointer select-none items-start gap-3"
        >
          <Checkbox
            id="auto-refresh-30s"
            checked={economyMode}
            onCheckedChange={(checked) => setEconomyMode(checked === true)}
            className="mt-0.5"
          />
          <div className="space-y-0.5">
            <span className="block text-sm font-semibold text-[#0F172A]">
              Segarkan otomatis tiap 30 detik
            </span>
            <span className="block text-xs text-[#64748B]">
              Aktifkan mode hemat untuk pemantauan tiap 30 detik. Jika tidak
              dicentang, perolehan suara diperbarui otomatis tiap 8 detik.
            </span>
          </div>
        </label>

        <div className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-[#FECACA] bg-[#FFF5F3] px-3 py-1 text-xs font-semibold text-[#D93829]">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full bg-[#D93829] animate-pulse"
          />
          <span>{economyMode ? "Mode hemat 30d" : "Live 8d"}</span>
          <span className="font-mono font-semibold tabular-nums">{countdown}s</span>
        </div>
      </section>
    </div>
  );
}
