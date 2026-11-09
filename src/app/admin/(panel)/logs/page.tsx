"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Shield,
  Filter,
  Search,
  Lock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  TrendingUp,
  Database,
  Users,
  UserCheck,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { generateOfficialElectionExcel } from "@/lib/reports/export-excel";
import { generateOfficialBeritaAcaraPdf } from "@/lib/reports/export-pdf";

interface AuditLogItem {
  id: string;
  actorType: "admin" | "voter" | "system";
  actorId: string | null;
  actorName: string;
  actorIdentity: string;
  action: string;
  actionTitle: string;
  description: string;
  ipAddress: string;
  createdAt: string;
}

interface LogsApiResponse {
  success: boolean;
  data: {
    logs: AuditLogItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    kpis: {
      totalLogs: number;
      adminLogs: number;
      adminPercent: string;
      voterSuccessLogs: number;
      failedLoginLogs: number;
    };
  };
}

export default function AdminLogsPage() {
  const [search, setSearch] = React.useState("");
  const [actorType, setActorType] = React.useState("all");
  const [action, setAction] = React.useState("all");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [page, setPage] = React.useState(1);
  const limit = 20;

  // Active query filters
  const [activeFilters, setActiveFilters] = React.useState({
    search: "",
    actorType: "all",
    action: "all",
    dateFrom: "",
    dateTo: "",
  });

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    search: activeFilters.search,
    actorType: activeFilters.actorType,
    action: activeFilters.action,
    dateFrom: activeFilters.dateFrom,
    dateTo: activeFilters.dateTo,
  });

  const { data: response, isLoading, refetch } = useQuery<LogsApiResponse>({
    queryKey: ["logs", "list", queryParams.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/admin/logs?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Gagal mengambil log aktivitas");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const logsData = response?.data;
  const logs = logsData?.logs || [];
  const pagination = logsData?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 };
  const kpis = logsData?.kpis || {
    totalLogs: 0,
    adminLogs: 0,
    adminPercent: "0%",
    voterSuccessLogs: 0,
    failedLoginLogs: 0,
  };

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActiveFilters({
      search,
      actorType,
      action,
      dateFrom,
      dateTo,
    });
  };

  const handleResetFilter = () => {
    setSearch("");
    setActorType("all");
    setAction("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
    setActiveFilters({
      search: "",
      actorType: "all",
      action: "all",
      dateFrom: "",
      dateTo: "",
    });
  };

  // Export Excel handler
  const handleExportExcel = async () => {
    try {
      toast.info("Menyiapkan berkas Excel...");
      // Fetch full results and election info for combined report
      const res = await fetch("/api/admin/results");
      const resultsJson = await res.json();

      if (!resultsJson.success) {
        throw new Error("Gagal memuat data pemilihan untuk ekspor");
      }

      const excelBytes = generateOfficialElectionExcel({
        election: resultsJson.data.election,
        kpis: resultsJson.data.kpis,
        candidates: resultsJson.data.candidates,
        classTurnout: resultsJson.data.classTurnout,
        auditLogs: logs.map((l) => ({
          createdAt: l.createdAt,
          actorType: l.actorType,
          actorName: l.actorName,
          actorIdentity: l.actorIdentity,
          actionTitle: l.actionTitle,
          description: l.description,
          ipAddress: l.ipAddress,
        })),
      });

      const blob = new Blob([excelBytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Votera_Rekapitulasi_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Berkas Excel berhasil diunduh");
    } catch (err: any) {
      toast.error(err.message || "Gagal mengunduh Excel");
    }
  };

  // Export PDF Berita Acara handler
  const handleExportPdf = async () => {
    try {
      toast.info("Menyusun Berita Acara resmi PDF...");
      const res = await fetch("/api/admin/results");
      const resultsJson = await res.json();

      if (!resultsJson.success) {
        throw new Error("Gagal memuat data pemilihan untuk ekspor");
      }

      const pdfDoc = generateOfficialBeritaAcaraPdf({
        election: resultsJson.data.election,
        kpis: resultsJson.data.kpis,
        candidates: resultsJson.data.candidates,
        classTurnout: resultsJson.data.classTurnout,
        committeeName: "Panitia Pemilihan OSIS 2026",
      });

      pdfDoc.save(`Berita_Acara_Pemilihan_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Berita Acara PDF berhasil diunduh");
    } catch (err: any) {
      toast.error(err.message || "Gagal mengunduh PDF");
    }
  };

  // Format date helper
  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    const dateStr = d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const timeStr = d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    return { dateStr, timeStr: `${timeStr} WIB` };
  };

  return (
    <div className="space-y-6">
      {/* 1. Top Intro Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-[#C8322B] text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C8322B] animate-pulse"></span>
              Audit Trail Aktif
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Integritas Hash SHA-256 Terverifikasi
            </span>
          </div>
          <p className="text-sm text-slate-500 max-w-4xl">
            Riwayat aktivitas panitia, pemilih, dan sistem. Data ini hanya untuk
            dibaca dan tidak bisa diubah dari panel guna menjaga validitas
            transparansi pemilu.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={handleExportExcel}
            variant="outline"
            size="sm"
            className="h-9 px-3 text-xs font-semibold bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" />
            <span>Ekspor Excel</span>
          </Button>

          <Button
            onClick={handleExportPdf}
            size="sm"
            className="h-9 px-3 text-xs font-semibold bg-[#D6362C] hover:bg-[#B0251E] text-white shadow-xs"
          >
            <FileText className="w-4 h-4 mr-1.5" />
            <span>Berita Acara PDF</span>
          </Button>
        </div>
      </div>

      {/* 2. KPI Metrics Bar (4 cards matching Stitch) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Catatan */}
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Catatan
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight leading-none">
              {kpis.totalLogs}
            </span>
            <span className="text-xs text-emerald-600 font-medium flex items-center gap-0.5">
              <TrendingUp className="w-3.5 h-3.5" /> Aktif
            </span>
          </div>
          <div className="mt-1.5 text-xs text-slate-400">
            Total entri tersimpan di ledger
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#D6362C] to-[#B0251E]" />
        </div>

        {/* Metric 2: Aktivitas Panitia */}
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Aktivitas Panitia
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-[#C8322B]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight leading-none">
              {kpis.adminLogs}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {kpis.adminPercent} porsi
            </span>
          </div>
          <div className="mt-1.5 text-xs text-slate-400">
            Tindakan operasional staf
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#C8322B]" />
        </div>

        {/* Metric 3: Login Pemilih Berhasil */}
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Aktivitas Pemilih
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight leading-none">
              {kpis.voterSuccessLogs}
            </span>
            <span className="text-xs text-emerald-600 font-medium">
              Sesi Sah
            </span>
          </div>
          <div className="mt-1.5 text-xs text-slate-400">
            Otentikasi token siswa sah
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500" />
        </div>

        {/* Metric 4: Login Gagal */}
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Percobaan Gagal
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight leading-none">
              {kpis.failedLoginLogs}
            </span>
            <span className="text-xs text-amber-600 font-medium">
              {kpis.failedLoginLogs > 0 ? "Perlu Pantau" : "Aman"}
            </span>
          </div>
          <div className="mt-1.5 text-xs text-slate-400">
            Percobaan token invalid/salah
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-500" />
        </div>
      </div>

      {/* 3. Filter Control Card */}
      <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-xs">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-bold text-slate-800">
              Filter Audit Log
            </span>
          </div>
          <button
            onClick={handleResetFilter}
            type="button"
            className="text-xs text-slate-400 hover:text-[#C8322B] transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filter</span>
          </button>
        </div>

        <form
          onSubmit={handleApplyFilter}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
        >
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Cari
            </label>
            <div className="relative">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Keterangan, nama, identitas, atau IP"
                className="h-10 text-xs pr-8 bg-slate-50 focus:bg-white"
              />
              <Search className="w-4 h-4 absolute right-2.5 top-3 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Pelaku */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Pelaku
            </label>
            <select
              value={actorType}
              onChange={(e) => setActorType(e.target.value)}
              className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:bg-white"
            >
              <option value="all">Semua</option>
              <option value="admin">Panitia</option>
              <option value="voter">Pemilih</option>
              <option value="system">Sistem</option>
            </select>
          </div>

          {/* Aksi */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Aksi
            </label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:bg-white"
            >
              <option value="all">Semua</option>
              <option value="admin_login">Admin Login</option>
              <option value="voter_login">Voter Login</option>
              <option value="vote_cast">Vote Cast</option>
              <option value="voter_logout">Voter Logout</option>
            </select>
          </div>

          {/* Dari Tanggal */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Dari tanggal
            </label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-10 text-xs bg-slate-50 focus:bg-white"
            />
          </div>

          {/* Sampai Tanggal + Submit Button */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Sampai tanggal
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-10 text-xs bg-slate-50 focus:bg-white"
              />
            </div>
            <Button
              type="submit"
              className="h-10 px-4 bg-[#D6362C] hover:bg-[#B0251E] text-white text-xs font-semibold self-end shadow-xs"
            >
              Cari
            </Button>
          </div>
        </form>
      </div>

      {/* 4. Read-Only Audit Table Card */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden flex flex-col">
        {/* Table Header Toolbar */}
        <div className="p-5 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-5 bg-[#D6362C] rounded-full" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Catatan aktivitas
              </h3>
              <p className="text-xs text-slate-400">
                Ledger mutlak (Append-Only) terindeks waktu
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-full bg-slate-100 text-xs text-slate-600 font-medium">
              Menampilkan{" "}
              <span className="font-bold text-slate-900">{logs.length}</span>{" "}
              dari {pagination.total}
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500 px-2.5 py-1 rounded-md bg-slate-100 font-medium">
              <Lock className="w-3.5 h-3.5" /> Read-Only
            </span>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-400 border-b border-slate-100 uppercase text-[10px] tracking-wider font-semibold">
                <th className="py-3 px-6">WAKTU</th>
                <th className="py-3 px-6">PELAKU</th>
                <th className="py-3 px-6">AKSI</th>
                <th className="py-3 px-6">KETERANGAN</th>
                <th className="py-3 px-6 text-right">IP ADDRESS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#C8322B] mb-2" />
                    <span>Memuat catatan aktivitas ledger...</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-12 text-center text-slate-400 text-xs"
                  >
                    Tidak ada catatan aktivitas yang sesuai dengan kriteria
                    pencarian.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const { dateStr, timeStr } = formatDateTime(log.createdAt);

                  const isVoteCast = log.action === "vote_cast";
                  const isAdminAction = log.actorType === "admin";
                  const isVoter = log.actorType === "voter";

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      {/* Waktu */}
                      <td className="py-3.5 px-6 whitespace-nowrap align-top">
                        <div className="flex flex-col font-mono text-[11px]">
                          <span className="font-semibold text-slate-900">
                            {dateStr}
                          </span>
                          <span className="text-slate-400">{timeStr}</span>
                        </div>
                      </td>

                      {/* Pelaku */}
                      <td className="py-3.5 px-6 align-top">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">
                              {log.actorName}
                            </span>
                            <span
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                                isAdminAction
                                  ? "bg-rose-50 text-[#C8322B]"
                                  : isVoter
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-700"
                              )}
                            >
                              {isAdminAction
                                ? "Panitia"
                                : isVoter
                                ? "Pemilih"
                                : "Sistem"}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-slate-400">
                            {log.actorIdentity}
                          </span>
                        </div>
                      </td>

                      {/* Aksi */}
                      <td className="py-3.5 px-6 align-top">
                        <div className="flex flex-col">
                          <span
                            className={cn(
                              "font-semibold",
                              isVoteCast
                                ? "text-emerald-700"
                                : isAdminAction
                                ? "text-slate-900"
                                : "text-slate-700"
                            )}
                          >
                            {log.actionTitle}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400">
                            {log.action}
                          </span>
                        </div>
                      </td>

                      {/* Keterangan */}
                      <td className="py-3.5 px-6 align-top">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "w-2 h-2 rounded-full shrink-0",
                              isVoteCast
                                ? "bg-emerald-600"
                                : isAdminAction
                                ? "bg-[#D6362C]"
                                : "bg-slate-400"
                            )}
                          />
                          <span
                            className={cn(
                              "text-xs font-medium",
                              isVoteCast ? "text-slate-900" : "text-slate-600"
                            )}
                          >
                            {log.description}
                          </span>
                        </div>
                      </td>

                      {/* IP Address */}
                      <td className="py-3.5 px-6 whitespace-nowrap align-top text-right">
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[11px]">
                          {log.ipAddress}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination */}
        <div className="p-4 px-6 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              Semua data terenkripsi dan ditandatangani secara kriptografis
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs"
            >
              Sebelumnya
            </Button>
            <span className="px-3 py-1 text-xs font-bold bg-rose-50 text-[#C8322B] rounded-md">
              {page} / {pagination.totalPages || 1}
            </span>
            <Button
              onClick={() =>
                setPage((p) => Math.min(pagination.totalPages, p + 1))
              }
              disabled={page >= pagination.totalPages}
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs"
            >
              Berikutnya
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
