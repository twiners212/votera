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
import { cn, formatDateWIB, formatPercentage } from "@/lib/utils";
import type { ElectionResultsDTO, ElectionStatus } from "@/types/votera";

const ELECTION_STATUS_LABELS: Record<ElectionStatus, string> = {
  open: "Sedang berlangsung",
  draft: "Belum dibuka",
  closed: "Ditutup",
  archived: "Diarsipkan",
};

function sanitizeFilename(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "pemilihan"
  );
}

async function exportResultsToExcel(data: ElectionResultsDTO): Promise<void> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  const leadingText =
    data.leadingCandidate && data.summary.votesCast > 0
      ? data.leadingCandidate.isTie
        ? `Imbang: No. ${data.leadingCandidate.candidateNumber} ${data.leadingCandidate.name}`
        : `No. ${data.leadingCandidate.candidateNumber} ${data.leadingCandidate.name}`
      : "Belum ada suara masuk";

  const summaryRows: Array<Array<string | number>> = [
    ["REKAPITULASI HASIL PEMILIHAN", ""],
    ["Judul Pemilihan", data.election.title],
    ["Instansi", data.election.organizationName],
    ["Status", ELECTION_STATUS_LABELS[data.election.status]],
    [
      "Jadwal Mulai",
      data.election.startAt ? formatDateWIB(data.election.startAt) : "-",
    ],
    [
      "Jadwal Selesai",
      data.election.endAt ? formatDateWIB(data.election.endAt) : "-",
    ],
    ["Total Pemilih (DPT)", data.summary.totalVoters],
    ["Suara Masuk", data.summary.votesCast],
    ["Belum Memilih", data.summary.notVoted],
    ["Partisipasi (%)", Number(data.summary.turnoutPercentage.toFixed(1))],
    ["Kandidat Unggul", leadingText],
    ["Diperbarui Pada", formatDateWIB(data.lastUpdatedAt, { withSeconds: true })],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet["!cols"] = [{ wch: 24 }, { wch: 44 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Ringkasan");

  const sortedCandidates = [...data.candidates].sort(
    (a, b) => a.rank - b.rank || a.candidateNumber - b.candidateNumber
  );

  const candidateRows = sortedCandidates.map((c) => ({
    Peringkat: c.rank,
    "No. Urut": c.candidateNumber,
    "Nama Kandidat": c.name,
    "Kelas / Unit": c.classOrUnit,
    "Perolehan Suara": c.voteCount,
    "Persentase (%)": Number(c.percentage.toFixed(1)),
  }));

  const candidateSheet = XLSX.utils.json_to_sheet(candidateRows);
  candidateSheet["!cols"] = [
    { wch: 12 },
    { wch: 10 },
    { wch: 28 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(workbook, candidateSheet, "Hasil Kandidat");

  const groupRows = data.groupParticipation.map((g) => ({
    "Rombel / Kelas": g.groupName,
    Tingkat: g.gradeName ?? "-",
    Jurusan: g.majorName ?? "-",
    "Total Pemilih": g.totalMembers,
    "Sudah Memilih": g.votedMembers,
    "Partisipasi (%)": Number(g.percentage.toFixed(1)),
  }));

  const groupSheet = XLSX.utils.json_to_sheet(
    groupRows.length > 0
      ? groupRows
      : [
          {
            "Rombel / Kelas": "-",
            Tingkat: "-",
            Jurusan: "-",
            "Total Pemilih": 0,
            "Sudah Memilih": 0,
            "Partisipasi (%)": 0,
          },
        ]
  );
  groupSheet["!cols"] = [
    { wch: 22 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(workbook, groupSheet, "Partisipasi Rombel");

  const slug = sanitizeFilename(data.election.shortName || data.election.title);
  XLSX.writeFile(workbook, `hasil-pemilihan-${slug}.xlsx`);
}

async function exportBeritaAcaraPdf(data: ElectionResultsDTO): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(217, 56, 41);
  doc.text(data.election.organizationName.toUpperCase(), pageWidth / 2, 18, {
    align: "center",
  });

  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("BERITA ACARA REKAPITULASI HASIL PEMILIHAN", pageWidth / 2, 25, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(data.election.title, pageWidth / 2, 31, { align: "center" });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 35, pageWidth - 14, 35);

  const startLabel = data.election.startAt
    ? formatDateWIB(data.election.startAt)
    : "-";
  const endLabel = data.election.endAt
    ? formatDateWIB(data.election.endAt)
    : "-";
  const printedAt = formatDateWIB(new Date(), { withSeconds: true });

  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Status Pemilihan : ${ELECTION_STATUS_LABELS[data.election.status]}`, 14, 42);
  doc.text(`Periode Jadwal   : ${startLabel} s.d. ${endLabel}`, 14, 47);
  doc.text(`Waktu Cetak      : ${printedAt} WIB`, 14, 52);

  autoTable(doc, {
    startY: 58,
    head: [["Total Pemilih (DPT)", "Suara Masuk", "Belum Memilih", "Partisipasi"]],
    body: [
      [
        data.summary.totalVoters.toLocaleString("id-ID"),
        data.summary.votesCast.toLocaleString("id-ID"),
        data.summary.notVoted.toLocaleString("id-ID"),
        formatPercentage(data.summary.turnoutPercentage, 1),
      ],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      fontSize: 9,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    bodyStyles: {
      fontSize: 10,
      fontStyle: "bold",
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    margin: { left: 14, right: 14 },
  });

  const afterSummaryY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 76;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text("A. Perolehan Suara Kandidat", 14, afterSummaryY + 10);

  const sortedCandidates = [...data.candidates].sort(
    (a, b) => a.rank - b.rank || a.candidateNumber - b.candidateNumber
  );

  autoTable(doc, {
    startY: afterSummaryY + 14,
    head: [["Peringkat", "No. Urut", "Nama Kandidat", "Kelas / Unit", "Suara", "Persentase"]],
    body: sortedCandidates.map((c) => [
      String(c.rank),
      `No. ${c.candidateNumber}`,
      c.name,
      c.classOrUnit,
      c.voteCount.toLocaleString("id-ID"),
      formatPercentage(c.percentage, 1),
    ]),
    theme: "striped",
    headStyles: {
      fillColor: [217, 56, 41],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 20 },
      1: { halign: "center", cellWidth: 20 },
      4: { halign: "right", cellWidth: 22 },
      5: { halign: "right", cellWidth: 24 },
    },
    margin: { left: 14, right: 14 },
  });

  let currentY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? afterSummaryY + 45;

  if (data.groupParticipation.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("B. Partisipasi per Kelas / Rombel", 14, currentY + 10);

    autoTable(doc, {
      startY: currentY + 14,
      head: [["Rombel / Kelas", "Tingkat", "Jurusan", "Pemilih", "Memilih", "Partisipasi"]],
      body: data.groupParticipation.map((g) => [
        g.groupName,
        g.gradeName ?? "-",
        g.majorName ?? "-",
        g.totalMembers.toLocaleString("id-ID"),
        g.votedMembers.toLocaleString("id-ID"),
        formatPercentage(g.percentage, 1),
      ]),
      theme: "striped",
      headStyles: {
        fillColor: [51, 65, 85],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [15, 23, 42],
      },
      columnStyles: {
        3: { halign: "right", cellWidth: 20 },
        4: { halign: "right", cellWidth: 20 },
        5: { halign: "right", cellWidth: 24 },
      },
      margin: { left: 14, right: 14 },
    });

    currentY =
      (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY ?? currentY + 40;
  }

  const pageHeight = doc.internal.pageSize.getHeight();
  let signY = currentY + 14;
  if (signY + 34 > pageHeight - 14) {
    doc.addPage();
    signY = 24;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  doc.text("Mengetahui,", 14, signY);
  doc.text("Ketua Panitia Pemilihan", 14, signY + 6);
  doc.text("Saksi Pemungutan Suara", pageWidth - 65, signY + 6);

  doc.line(14, signY + 26, 68, signY + 26);
  doc.line(pageWidth - 65, signY + 26, pageWidth - 14, signY + 26);

  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("( ........................................ )", 14, signY + 31);
  doc.text("( ........................................ )", pageWidth - 65, signY + 31);

  const slug = sanitizeFilename(data.election.shortName || data.election.title);
  doc.save(`berita-acara-${slug}.pdf`);
}

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

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
      await exportResultsToExcel(data);
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
      await exportBeritaAcaraPdf(data);
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
            onClick={() => void handleExportExcel()}
            disabled={isExportingExcel}
          >
            <FileSpreadsheet className="h-4 w-4 text-[#15803D]" aria-hidden="true" />
            <span>{isExportingExcel ? "Mengekspor..." : "Ekspor Excel"}</span>
          </Button>

          <Button
            type="button"
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
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
          <span className="font-mono tabular-nums">{countdown}s</span>
        </div>
      </section>
    </div>
  );
}
