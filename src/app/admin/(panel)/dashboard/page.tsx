"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  User,
  Users,
  Check,
  BarChart,
  Calendar,
  ExternalLink,
  SlidersHorizontal,
  Loader2,
  AlertCircle,
  Clock,
  ArrowRight,
} from "lucide-react";
import { authClient } from "@/lib/auth/admin-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DashboardData {
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
    candidateCount: number;
    totalVoters: number;
    votedCount: number;
    unvotedCount: number;
    turnoutPercentage: number;
  };
  classParticipation: Array<{
    id: string;
    name: string;
    total: number;
    voted: number;
    percentage: number;
  }>;
  readiness: {
    isReady: boolean;
    hasMinCandidates: boolean;
    candidateCount: number;
    hasVoters: boolean;
    totalVoters: number;
    hasSchedule: boolean;
    hasOrganization: boolean;
    organizationName: string;
  };
  recentActivities: Array<{
    id: string;
    actorType: "admin" | "voter" | "system";
    actorName: string;
    actorIdentity: string;
    action: string;
    actionTitle: string;
    description: string;
    createdAt: string;
  }>;
}

export default function AdminDashboardPage() {
  const { data: session } = authClient.useSession();

  const {
    data: response,
    isLoading,
    isError,
    refetch,
  } = useQuery<{ success: boolean; data: DashboardData }>({
    queryKey: ["admin", "dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/admin/dashboard");
      if (!res.ok) {
        throw new Error("Gagal mengambil data dashboard");
      }
      return res.json();
    },
    refetchInterval: 30000, // Polling setiap 30 detik untuk dashboard monitoring
  });

  const dashboardData = response?.data;

  // Format tanggal jadwal
  const formatSchedule = (start: string | null, end: string | null) => {
    if (!start || !end) return "Jadwal belum ditentukan";
    const startDate = new Date(start);
    const endDate = new Date(end);

    const startStr = startDate.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const endStr = endDate.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return `${startStr} – ${endStr}`;
  };

  // Format tanggal aktivitas singkat
  const formatShortTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const adminName = session?.user?.name || "Admin";

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 text-[#C8322B] animate-spin" />
        <p className="text-sm text-slate-500 font-medium">
          Memuat ringkasan dashboard...
        </p>
      </div>
    );
  }

  if (isError || !dashboardData) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto" />
          <h3 className="text-base font-bold text-red-900">
            Gagal Memuat Dashboard
          </h3>
          <p className="text-xs text-red-600">
            Terjadi kendala saat menghubungkan ke database pemilihan.
          </p>
          <Button
            onClick={() => refetch()}
            size="sm"
            className="bg-[#C8322B] hover:bg-[#B02A24] text-white"
          >
            Coba Lagi
          </Button>
        </div>
      </div>
    );
  }

  const { election, kpis, classParticipation, readiness, recentActivities } =
    dashboardData;

  const isElectionOpen = election.status === "open";

  return (
    <div className="space-y-6">
      {/* 1. Greeting & Top Actions */}
      <section
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
        data-purpose="greeting-actions"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Halo, {adminName}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Ringkasan pemilihan {election.title} secara langsung.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-white border border-rose-200 text-[#C8322B] hover:bg-rose-50 transition-colors shadow-2xs"
          >
            <span>Lihat beranda</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <Link
            href="/admin/settings"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#C8322B] hover:bg-[#B02A24] text-white transition-colors shadow-xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Atur jadwal</span>
          </Link>
        </div>
      </section>

      {/* 2. Status Pemungutan Suara Banner */}
      <section
        className="bg-white rounded-xl p-5 border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
        data-purpose="voting-status-card"
      >
        <div>
          <div className="text-sm font-semibold text-slate-800">
            Status pemungutan suara
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {formatSchedule(election.startAt, election.endAt)}
          </div>
        </div>
        <div>
          {isElectionOpen ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Pemungutan suara dibuka
            </span>
          ) : election.status === "closed" ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
              Pemungutan suara ditutup
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              Draft persiapan
            </span>
          )}
        </div>
      </section>

      {/* 3. 4 Metric Stat Cards */}
      <section
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        data-purpose="metrics-grid"
      >
        {/* Metric 1: Kandidat Aktif */}
        <article className="bg-white rounded-xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-7 h-7 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mb-4">
              <User className="w-4 h-4" />
            </div>
            <div className="text-[28px] font-extrabold text-slate-900 leading-none mb-1.5">
              {kpis.candidateCount}
            </div>
            <div className="text-xs font-medium text-slate-500">
              Kandidat aktif
            </div>
          </div>
        </article>

        {/* Metric 2: Total Pemilih (DPT) */}
        <article className="bg-white rounded-xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-7 h-7 rounded-full bg-sky-50 text-sky-500 flex items-center justify-center mb-4">
              <Users className="w-4 h-4" />
            </div>
            <div className="text-[28px] font-extrabold text-slate-900 leading-none mb-1.5">
              {kpis.totalVoters}
            </div>
            <div className="text-xs font-medium text-slate-500">
              Total pemilih (DPT)
            </div>
          </div>
        </article>

        {/* Metric 3: Sudah Memilih */}
        <article className="bg-white rounded-xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-4">
              <Check className="w-4 h-4" />
            </div>
            <div className="text-[28px] font-extrabold text-slate-900 leading-none mb-1.5">
              {kpis.votedCount}
            </div>
            <div className="text-xs font-medium text-slate-500">
              Sudah memilih
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {kpis.unvotedCount} belum memilih
            </div>
          </div>
        </article>

        {/* Metric 4: Partisipasi */}
        <article className="bg-white rounded-xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-7 h-7 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mb-4">
              <BarChart className="w-4 h-4" />
            </div>
            <div className="text-[28px] font-extrabold text-slate-900 leading-none mb-1.5">
              {kpis.turnoutPercentage.toLocaleString("id-ID")}%
            </div>
            <div className="text-xs font-medium text-slate-500">
              Partisipasi
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-4 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, kpis.turnoutPercentage)}%` }}
            ></div>
          </div>
        </article>
      </section>

      {/* 4. Bento Grid (Partisipasi & Right Column) */}
      <section
        className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        data-purpose="bento-details-grid"
      >
        {/* Left Column: Partisipasi Per Kelas (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden flex flex-col">
          {/* Card Header */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-slate-50">
            <h3 className="text-sm font-bold text-slate-900">
              Partisipasi per kelas
            </h3>
            <Link
              href="/admin/voters"
              className="text-xs font-semibold text-[#C8322B] hover:underline"
            >
              Kelola pemilih
            </Link>
          </div>
          {/* Table Content */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-6 font-semibold">Kelas</th>
                  <th className="py-2.5 px-6 font-semibold text-center w-28">
                    Memilih
                  </th>
                  <th className="py-2.5 px-6 font-semibold">Progres</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-600">
                {classParticipation.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-8 text-center text-slate-400 text-xs"
                    >
                      Belum ada data rombel / kelas yang terdaftar.
                    </td>
                  </tr>
                ) : (
                  classParticipation.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="py-3 px-6 font-medium text-slate-800">
                        {row.name}
                      </td>
                      <td className="py-3 px-6 text-center text-slate-700">
                        {row.voted} / {row.total}
                      </td>
                      <td className="py-3 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-full max-w-[200px] bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-[#C8322B] h-2 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, row.percentage)}%` }}
                            ></div>
                          </div>
                          <span className="text-[11px] text-slate-400 font-medium w-9 text-right">
                            {row.percentage}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Kesiapan Pemilihan & Aktivitas Terbaru (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Card 1: Kesiapan Pemilihan */}
          <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                Kesiapan pemilihan
              </h3>
              {readiness.isReady ? (
                <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
                  Siap
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-100">
                  Belum siap
                </span>
              )}
            </div>
            {/* Checklist Items */}
            <ul className="space-y-3.5 text-xs text-slate-600">
              <li className="flex items-center gap-3">
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                    readiness.hasMinCandidates
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-amber-50 text-amber-600"
                  }`}
                >
                  <Check className="w-3 h-3 stroke-[2.5]" />
                </div>
                <span>
                  Minimal 2 kandidat aktif (sekarang {readiness.candidateCount})
                </span>
              </li>
              <li className="flex items-center gap-3">
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                    readiness.hasVoters
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-amber-50 text-amber-600"
                  }`}
                >
                  <Check className="w-3 h-3 stroke-[2.5]" />
                </div>
                <span>
                  Daftar pemilih (DPT) sudah terisi ({readiness.totalVoters} pemilih)
                </span>
              </li>
              <li className="flex items-center gap-3">
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                    readiness.hasSchedule
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-amber-50 text-amber-600"
                  }`}
                >
                  <Check className="w-3 h-3 stroke-[2.5]" />
                </div>
                <span>Jadwal pemungutan suara sudah diatur</span>
              </li>
              <li className="flex items-center gap-3">
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                    readiness.hasOrganization
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-amber-50 text-amber-600"
                  }`}
                >
                  <Check className="w-3 h-3 stroke-[2.5]" />
                </div>
                <span>Nama instansi sudah diisi</span>
              </li>
            </ul>
          </div>

          {/* Card 2: Aktivitas Terbaru */}
          <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                Aktivitas terbaru
              </h3>
              <Link
                href="/admin/logs"
                className="text-xs font-semibold text-[#C8322B] hover:underline"
              >
                Semua log
              </Link>
            </div>
            {/* Event Items */}
            <div className="divide-y divide-slate-100">
              {recentActivities.length === 0 ? (
                <p className="text-xs text-slate-400 py-3">
                  Belum ada catatan aktivitas tercatat.
                </p>
              ) : (
                recentActivities.map((act) => (
                  <div key={act.id} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="text-xs font-semibold text-slate-800 line-clamp-1">
                      {act.actionTitle}: {act.actorIdentity}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                      <span className="text-[#C8322B] font-medium capitalize">
                        {act.actorType}
                      </span>
                      <span>•</span>
                      <span>{formatShortTime(act.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
