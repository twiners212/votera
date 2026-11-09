"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  RotateCw,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  TrendingUp,
  Award,
  ChevronRight,
  Shield,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { generateOfficialBeritaAcaraPdf } from "@/lib/reports/export-pdf";
import { generateOfficialElectionExcel } from "@/lib/reports/export-excel";

interface CandidateResult {
  id: string;
  candidateNumber: number;
  name: string;
  classOrUnit: string;
  motto: string;
  photoUrl: string | null;
  themeColor: string;
  voteCount: number;
  percentage: number;
  isLeader: boolean;
  rank: number;
}

interface ResultsData {
  election: {
    id: string;
    slug: string;
    shortName: string;
    title: string;
    organizationName: string;
    status: string;
    startAt: string | null;
    endAt: string | null;
  };
  kpis: {
    totalVotes: number;
    totalVoters: number;
    votedCount: number;
    unvotedCount: number;
    turnoutPercentage: number;
  };
  leader: {
    candidateNumber: number;
    name: string;
    voteCount: number;
    percentage: number;
  } | null;
  candidates: CandidateResult[];
  classTurnout: Array<{
    id: string;
    name: string;
    total: number;
    voted: number;
    percentage: number;
  }>;
  generatedAt: string;
}

export default function AdminResultsPage() {
  const [autoRefresh, setAutoRefresh] = React.useState(true);
  const [countdown, setCountdown] = React.useState(30);
  const [isRefreshingAnim, setIsRefreshingAnim] = React.useState(false);

  const {
    data: response,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<{ success: boolean; data: ResultsData }>({
    queryKey: ["results", "live"],
    queryFn: async () => {
      const res = await fetch("/api/admin/results");
      if (!res.ok) {
        throw new Error("Gagal mengambil data hasil pemilihan");
      }
      return res.json();
    },
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const resultsData = response?.data;

  // Handle countdown interval
  React.useEffect(() => {
    if (!autoRefresh) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          refetch();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefresh, refetch]);

  // Handle manual refresh button click
  const handleManualRefresh = async () => {
    setIsRefreshingAnim(true);
    await refetch();
    setCountdown(30);
    setTimeout(() => {
      setIsRefreshingAnim(false);
    }, 600);
  };

  // Export handlers
  const handleExportPdf = () => {
    if (!resultsData) return;
    try {
      toast.info("Menyusun Berita Acara resmi PDF...");
      const pdf = generateOfficialBeritaAcaraPdf({
        election: resultsData.election,
        kpis: resultsData.kpis,
        candidates: resultsData.candidates,
        classTurnout: resultsData.classTurnout,
        committeeName: "Panitia Pemilihan OSIS 2026",
      });
      pdf.save(`Berita_Acara_${resultsData.election.slug}_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Berita Acara PDF berhasil diunduh");
    } catch (err: any) {
      toast.error(err.message || "Gagal mengunduh PDF");
    }
  };

  const handleExportExcel = () => {
    if (!resultsData) return;
    try {
      toast.info("Menyiapkan berkas Excel...");
      const bytes = generateOfficialElectionExcel({
        election: resultsData.election,
        kpis: resultsData.kpis,
        candidates: resultsData.candidates,
        classTurnout: resultsData.classTurnout,
      });
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Rekapitulasi_${resultsData.election.slug}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Berkas Excel berhasil diunduh");
    } catch (err: any) {
      toast.error(err.message || "Gagal mengunduh Excel");
    }
  };

  // Format tanggal jadwal
  const formatSchedule = (start: string | null, end: string | null) => {
    if (!start || !end) return "Jadwal belum ditentukan";
    const startDate = new Date(start);
    const endDate = new Date(end);

    const startStr = startDate.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const endStr = endDate.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return `Mulai ${startStr} · Selesai ${endStr}`;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 text-[#D6362C] animate-spin" />
        <p className="text-sm text-slate-500 font-medium">
          Memuat perolehan suara pemilihan...
        </p>
      </div>
    );
  }

  if (isError || !resultsData) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto" />
          <h3 className="text-base font-bold text-red-900">
            Gagal Memuat Hasil Pemilihan
          </h3>
          <p className="text-xs text-red-600">
            Terjadi kendala saat menghitung agregasi suara dari database.
          </p>
          <Button
            onClick={() => refetch()}
            size="sm"
            className="bg-[#D6362C] hover:bg-[#B0251E] text-white"
          >
            Coba Lagi
          </Button>
        </div>
      </div>
    );
  }

  const { election, kpis, leader, candidates, classTurnout } = resultsData;

  return (
    <div className="space-y-6">
      {/* 1. Top Header Subtitle & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Hasil Pemilihan
          </h1>
          <p className="text-sm text-slate-500 max-w-2xl">
            Perolehan suara tiap kandidat. Angka ini hanya bisa dilihat panitia
            dan tidak ditampilkan ke pemilih.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={handleManualRefresh}
            variant="outline"
            size="sm"
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs h-9 px-3 text-xs"
            disabled={isFetching}
          >
            <RotateCw
              className={cn(
                "w-3.5 h-3.5 mr-1.5 text-slate-500",
                (isRefreshingAnim || isFetching) && "animate-spin"
              )}
            />
            <span>Segarkan</span>
          </Button>

          <Button
            onClick={handleExportExcel}
            variant="outline"
            size="sm"
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs h-9 px-3 text-xs font-semibold"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            <span>Ekspor Excel</span>
          </Button>

          <Button
            onClick={handleExportPdf}
            size="sm"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[#D6362C] hover:bg-[#B0251E] text-white shadow-xs transition-colors h-9"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Berita Acara PDF</span>
          </Button>
        </div>
      </div>

      {/* 2. Election Status Card */}
      <section className="bg-white rounded-xl p-6 border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-slate-900">{election.title}</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {formatSchedule(election.startAt, election.endAt)}
            </span>
          </div>
          <div className="inline-flex items-center gap-1.5 text-xs text-[#D6362C] font-bold pt-1">
            <span className="w-2 h-2 rounded-full bg-[#D6362C] animate-pulse"></span>
            Hasil sementara
          </div>
        </div>
        <div>
          {election.status === "open" ? (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              Sedang berlangsung
            </span>
          ) : election.status === "closed" ? (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-slate-500"></span>
              Selesai
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Draft
            </span>
          )}
        </div>
      </section>

      {/* 3. KPI Metrics Grid (4 compact cards) */}
      <section
        aria-label="Ringkasan Partisipasi Suara"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {/* Card 1: Suara Masuk */}
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-xs space-y-2 flex flex-col justify-between">
          <span className="text-3xl font-extrabold text-slate-900 tracking-tight leading-none">
            {kpis.totalVotes}
          </span>
          <div className="text-xs font-medium text-slate-500">Suara masuk</div>
        </div>

        {/* Card 2: Total Pemilih (DPT) */}
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-xs space-y-2 flex flex-col justify-between">
          <span className="text-3xl font-extrabold text-slate-900 tracking-tight leading-none">
            {kpis.totalVoters}
          </span>
          <div className="text-xs font-medium text-slate-500">
            Total pemilih (DPT)
          </div>
        </div>

        {/* Card 3: Belum Memilih */}
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-xs space-y-2 flex flex-col justify-between">
          <span className="text-3xl font-extrabold text-slate-900 tracking-tight leading-none">
            {kpis.unvotedCount}
          </span>
          <div className="text-xs font-medium text-slate-500">
            Belum memilih
          </div>
        </div>

        {/* Card 4: Partisipasi */}
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight leading-none">
              {kpis.turnoutPercentage.toLocaleString("id-ID")}%
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.min(100, kpis.turnoutPercentage)}%` }}
              ></div>
            </div>
            <div className="text-xs font-medium text-slate-500">
              Partisipasi
            </div>
          </div>
        </div>
      </section>

      {/* 4. Vote Standings Section */}
      <section aria-label="Hasil Perolehan Suara" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">Perolehan suara</h3>
          {leader && leader.voteCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Unggul: No. {leader.candidateNumber} {leader.name}
            </span>
          ) : (
            <span className="text-xs text-slate-400 font-medium">
              Belum ada suara masuk
            </span>
          )}
        </div>

        {/* Candidate Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {candidates.map((cand) => {
            const isLeadingCard = cand.isLeader && cand.voteCount > 0;
            const initial = cand.name.charAt(0);

            return (
              <article
                key={cand.id}
                className={cn(
                  "bg-white rounded-xl p-5 border border-slate-100 shadow-xs space-y-5 transition-transform duration-200 hover:-translate-y-0.5 relative overflow-hidden flex flex-col justify-between",
                  isLeadingCard && "ring-1 ring-[#D6362C]/20 shadow-md"
                )}
              >
                {/* Leading candidate accent stripe */}
                {isLeadingCard && (
                  <div className="absolute top-0 inset-x-0 h-1 bg-[#D6362C]" />
                )}

                {/* Top Profile Info */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Rank Pill & Avatar */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          "w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold",
                          isLeadingCard
                            ? "bg-[#D6362C] text-white"
                            : "bg-slate-100 text-slate-500"
                        )}
                      >
                        {cand.rank}
                      </span>
                      {cand.photoUrl ? (
                        <img
                          src={cand.photoUrl}
                          alt={cand.name}
                          className="w-10 h-10 rounded-lg object-cover border border-slate-100"
                        />
                      ) : (
                        <div
                          className={cn(
                            "w-10 h-10 rounded-lg font-bold text-base flex items-center justify-center",
                            isLeadingCard
                              ? "bg-rose-50 text-[#D6362C]"
                              : "bg-slate-100 text-slate-600"
                          )}
                        >
                          {initial}
                        </div>
                      )}
                    </div>

                    {/* Name & Metadata */}
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 truncate">
                        {cand.name}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs">
                        <span
                          className={cn(
                            "font-bold",
                            isLeadingCard ? "text-[#D6362C]" : "text-slate-500"
                          )}
                        >
                          No. {cand.candidateNumber}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-500 truncate">
                          {cand.classOrUnit}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Votes & Percentage Output */}
                <div className="space-y-2 pt-2 border-t border-slate-50">
                  <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold text-slate-900">
                        {cand.voteCount}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        suara
                      </span>
                    </div>
                    <span
                      className={cn(
                        "text-base font-bold",
                        isLeadingCard ? "text-[#D6362C]" : "text-slate-500"
                      )}
                    >
                      {cand.percentage.toLocaleString("id-ID")}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500 ease-out",
                        isLeadingCard ? "bg-[#D6362C]" : "bg-slate-400"
                      )}
                      style={{ width: `${Math.min(100, cand.percentage)}%` }}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 5. Visual Vote Distribution & Class Turnout Bento */}
      <section id="laporan" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Graphic Visualization */}
        <div className="lg:col-span-6 bg-white rounded-xl p-6 border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Distribusi Suara Kandidat
            </h3>
            <Badge variant="outline" className="text-[11px] font-normal">
              Grafik Komparatif
            </Badge>
          </div>

          <div className="space-y-3 pt-2">
            {candidates.map((c) => (
              <div key={c.id} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-800">
                    #{c.candidateNumber} {c.name}
                  </span>
                  <span className="text-slate-500 font-medium">
                    {c.voteCount} suara ({c.percentage}%)
                  </span>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    className={cn(
                      "h-full transition-all duration-500",
                      c.candidateNumber === 1
                        ? "bg-[#D6362C]"
                        : c.candidateNumber === 2
                        ? "bg-emerald-600"
                        : c.candidateNumber === 3
                        ? "bg-sky-600"
                        : "bg-purple-600"
                    )}
                    style={{ width: `${Math.max(c.voteCount > 0 ? 3 : 0, c.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Partisipasi Per Kelas Summary */}
        <div className="lg:col-span-6 bg-white rounded-xl p-6 border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Partisipasi Berdasarkan Rombel
            </h3>
            <span className="text-xs text-slate-400">
              {classTurnout.length} rombel terdaftar
            </span>
          </div>

          <div className="max-h-[220px] overflow-y-auto divide-y divide-slate-100 pr-1">
            {classTurnout.map((ct) => (
              <div
                key={ct.id}
                className="py-2.5 flex items-center justify-between text-xs"
              >
                <span className="font-medium text-slate-800">{ct.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500">
                    {ct.voted} / {ct.total} pemilih
                  </span>
                  <span className="font-semibold text-slate-700 w-12 text-right">
                    {ct.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Bottom Automation Controls */}
      <section className="bg-white rounded-xl p-5 border border-slate-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="mt-1 rounded border-slate-300 text-[#D6362C] focus:ring-[#D6362C] h-4 w-4"
          />
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-slate-900 block">
              Segarkan otomatis tiap 30 detik
            </span>
            <span className="text-xs text-slate-500 block">
              Berguna untuk memantau perolehan suara secara langsung selama
              pemungutan suara berlangsung.
            </span>
          </div>
        </label>

        {autoRefresh && (
          <div className="shrink-0 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-[#D6362C]">
            <span className="w-2 h-2 rounded-full bg-[#D6362C] animate-ping"></span>
            <span className="font-mono">{countdown}s</span>
          </div>
        )}
      </section>
    </div>
  );
}
