"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  UserPlus,
  Upload,
  Download,
  Search,
  CheckCircle2,
  Clock,
  Percent,
  Copy,
  RotateCcw,
  Trash2,
  Edit,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  Check,
  X,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { authClient } from "@/lib/auth/admin-client";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface Voter {
  id: string;
  voterIdentity: string;
  name: string;
  groupId: string;
  groupName: string;
  voterStatus: "not_voted" | "logged_in" | "voted";
  hasVoted: boolean;
  votedAt: string | null;
  token: string | null;
  isLocked: boolean;
  createdAt: string;
}

interface VoterGroup {
  id: string;
  name: string;
}

interface VotersApiResponse {
  success: boolean;
  data: Voter[];
  stats: {
    total: number;
    voted: number;
    notVoted: number;
    turnoutPercent: number;
  };
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

export default function VotersManagementPage() {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const isSuperAdmin = session?.user?.role === "super_admin";

  // Filter states
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [groupFilter, setGroupFilter] = React.useState("all");
  const [page, setPage] = React.useState(1);

  // Dialog states
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [isImportOpen, setIsImportOpen] = React.useState(false);
  const [resetVoter, setResetVoter] = React.useState<Voter | null>(null);

  // Add single voter form state
  const [addNis, setAddNis] = React.useState("");
  const [addName, setAddName] = React.useState("");
  const [addGroupId, setAddGroupId] = React.useState("");

  // Import state
  const [importedRows, setImportedRows] = React.useState<
    Array<{ voterIdentity: string; name: string; groupName: string }>
  >([]);
  const [importFileName, setImportFileName] = React.useState<string | null>(null);

  // Fetch Voters
  const { data, isLoading, error } = useQuery<VotersApiResponse>({
    queryKey: queryKeys.voters.list("active", {
      search,
      status: statusFilter,
      groupId: groupFilter,
      page,
    }),
    queryFn: async () => {
      const params = new URLSearchParams({
        search,
        status: statusFilter,
        groupId: groupFilter,
        page: page.toString(),
        limit: "25",
      });
      const res = await fetch(`/api/admin/voters?${params}`);
      if (!res.ok) throw new Error("Gagal memuat data pemilih.");
      return res.json();
    },
  });

  // Fetch Groups for dropdown
  const { data: masterData } = useQuery({
    queryKey: queryKeys.master.all,
    queryFn: async () => {
      const res = await fetch("/api/admin/master");
      if (!res.ok) return { data: { voterGroups: [] } };
      return res.json();
    },
  });

  const voterGroups: VoterGroup[] = masterData?.data?.voterGroups || [];

  // Mutation Add Single Voter
  const addMutation = useMutation({
    mutationFn: async (payload: { voterIdentity: string; name: string; groupId: string }) => {
      const res = await fetch("/api/admin/voters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Gagal menambah pemilih.");
      return json;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.voters.all });
      toast.success("Pemilih Berhasil Ditambahkan", {
        description: `Token: ${res.data.token}`,
      });
      setAddNis("");
      setAddName("");
      setAddGroupId("");
      setIsAddOpen(false);
    },
    onError: (err: Error) => {
      toast.error("Gagal Menyimpan", { description: err.message });
    },
  });

  // Mutation Reset Token
  const resetMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/voters/${id}/reset-token`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Gagal mereset token.");
      return json;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.voters.all });
      toast.success("Token Berhasil Direset", {
        description: `Token Baru: ${res.token}`,
      });
      setResetVoter(null);
    },
    onError: (err: Error) => {
      toast.error("Gagal Reset Token", { description: err.message });
    },
  });

  // Mutation Delete Voter
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/voters/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Gagal menghapus pemilih.");
      return json;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.voters.all });
      toast.success("Pemilih Dihapus", { description: res.message });
    },
    onError: (err: Error) => {
      toast.error("Gagal Menghapus", { description: err.message });
    },
  });

  // Mutation Bulk Import
  const importMutation = useMutation({
    mutationFn: async (rows: Array<{ voterIdentity: string; name: string; groupName: string }>) => {
      const res = await fetch("/api/admin/voters/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voters: rows }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Gagal mengimpor DPT.");
      return json;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.voters.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.master.all });
      toast.success("Impor DPT Berhasil", { description: res.message });
      setImportedRows([]);
      setImportFileName(null);
      setIsImportOpen(false);
    },
    onError: (err: Error) => {
      toast.error("Gagal Mengimpor DPT", { description: err.message });
    },
  });

  const copyToken = (token: string, name: string) => {
    navigator.clipboard.writeText(token);
    toast.success("Token Disalin ke Clipboard", {
      description: `Token milik ${name}: ${token}`,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const isCsv = file.name.endsWith(".csv");

    if (isCsv) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const parsed = (results.data as any[]).map((row) => ({
            voterIdentity: String(row.NIS || row.nis || row.Identitas || row.nik || "").trim(),
            name: String(row.Nama || row.nama || row.Name || "").trim(),
            groupName: String(row.Rombel || row.rombel || row.Kelas || row.kelas || "Umum").trim(),
          })).filter((r) => r.voterIdentity && r.name);

          setImportedRows(parsed);
          toast.info(`Terbaca ${parsed.length} baris pemilih dari CSV.`);
        },
      });
    } else {
      // XLSX / XLS
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        const parsed = data.map((row) => ({
          voterIdentity: String(row.NIS || row.nis || row.Identitas || row.nik || "").trim(),
          name: String(row.Nama || row.nama || row.Name || "").trim(),
          groupName: String(row.Rombel || row.rombel || row.Kelas || row.kelas || "Umum").trim(),
        })).filter((r) => r.voterIdentity && r.name);

        setImportedRows(parsed);
        toast.info(`Terbaca ${parsed.length} baris pemilih dari Excel.`);
      };
      reader.readAsBinaryString(file);
    }
  };

  const downloadSampleCsv = () => {
    const csvContent =
      "NIS,Nama,Rombel\n2324001,Aditya Pratama,X-A\n2324002,Budi Santoso,X-B\n2324003,Citra Lestari,XI-IPA-1\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "template-dpt-votera.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const votersList = data?.data || [];
  const stats = data?.stats || { total: 0, voted: 0, notVoted: 0, turnoutPercent: 0 };
  const pagination = data?.pagination || { page: 1, totalPages: 1, totalItems: 0 };

  return (
    <div className="space-y-6">
      {/* Top Header & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Manajemen Pemilih (DPT)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Total {stats.total} pemilih terdaftar. Pantau status partisipasi dan kelola token akses digital.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Import DPT Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportOpen(true)}
            className="gap-1.5 text-xs font-medium"
          >
            <Upload className="w-3.5 h-3.5 text-slate-600" />
            Impor DPT
          </Button>

          {/* Add Voter Button */}
          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="gap-1.5 text-xs font-medium bg-primary hover:bg-primary-hover text-white shadow-xs"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Tambah Pemilih
          </Button>
        </div>
      </div>

      {/* 4 Compact KPI Metric Cards (Matching Stitch Screen 04) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total DPT */}
        <Card className="border-border shadow-xs bg-white p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Total Pemilih</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
              {stats.total}
            </span>
            <span className="text-xs text-slate-400 font-normal">Siswa DPT</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">Tercakup di rombongan belajar</div>
        </Card>

        {/* Sudah Memilih */}
        <Card className="border-border shadow-xs bg-white p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Sudah Memilih</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600 font-mono tracking-tight">
              {stats.voted}
            </span>
            <span className="text-xs text-slate-400 font-normal">Surat suara masuk</span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-600 flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Terverifikasi sistem audit
          </div>
        </Card>

        {/* Belum Memilih */}
        <Card className="border-border shadow-xs bg-white p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Belum Memilih</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-800 font-mono tracking-tight">
              {stats.notVoted}
            </span>
            <span className="text-xs text-slate-400 font-normal">Siswa antre</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">Menunggu sesi bilik suara</div>
        </Card>

        {/* Partisipasi */}
        <Card className="border-border shadow-xs bg-white p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Partisipasi</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-primary">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
              {stats.turnoutPercent}%
            </span>
            <span className="text-xs text-slate-400 font-normal">Tingkat kehadiran</span>
          </div>
          <div className="mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-primary h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min(100, stats.turnoutPercent)}%` }}
            />
          </div>
        </Card>
      </div>

      {/* Filter & Search Bar (Matching Stitch Screen 04) */}
      <Card className="border-border shadow-xs bg-white p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          {/* Search Input */}
          <div className="lg:col-span-5 space-y-1">
            <label className="text-xs font-semibold text-slate-600">Cari Pemilih</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Cari berdasarkan nama atau NIS..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 h-10 text-xs bg-slate-50/50"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="lg:col-span-3 space-y-1">
            <label className="text-xs font-semibold text-slate-600">Status Memilih</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 px-3 text-xs border rounded-md bg-white border-input"
            >
              <option value="all">Semua Status</option>
              <option value="voted">Sudah Memilih</option>
              <option value="not_voted">Belum Memilih</option>
              <option value="locked">Terkunci (Lockout)</option>
            </select>
          </div>

          {/* Rombel Filter */}
          <div className="lg:col-span-4 space-y-1">
            <label className="text-xs font-semibold text-slate-600">Rombel / Kelompok</label>
            <select
              value={groupFilter}
              onChange={(e) => {
                setGroupFilter(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 px-3 text-xs border rounded-md bg-white border-input"
            >
              <option value="all">Semua Rombel</option>
              {voterGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Voters Table Card */}
      <Card className="border-border shadow-xs bg-white overflow-hidden">
        <div className="p-4 px-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-800 text-sm">Daftar Pemilih Terdaftar</h3>
            <Badge variant="outline" className="text-[10px] font-mono">
              Total {pagination.totalItems} DPT
            </Badge>
          </div>
          <div className="text-xs text-slate-400">
            Halaman {pagination.page} dari {Math.max(1, pagination.totalPages)}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-slate-50/70 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-6">NIS</th>
                <th className="py-3.5 px-6">Nama Pemilih</th>
                <th className="py-3.5 px-6">Rombel</th>
                <th className="py-3.5 px-6">Token Akses</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary mb-2" />
                    Memuat data DPT...
                  </td>
                </tr>
              ) : votersList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Tidak ditemukan data pemilih yang sesuai dengan pencarian atau filter.
                  </td>
                </tr>
              ) : (
                votersList.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* NIS */}
                    <td className="py-3.5 px-6 font-mono font-medium text-slate-600">
                      {v.voterIdentity}
                    </td>

                    {/* Nama */}
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-sm">{v.name}</span>
                        {v.hasVoted && (
                          <span title="Hak pilih telah digunakan">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Rombel */}
                    <td className="py-3.5 px-6 text-slate-600 font-medium">
                      {v.groupName}
                    </td>

                    {/* Token */}
                    <td className="py-3.5 px-6">
                      {v.hasVoted ? (
                        <span className="font-mono text-[11px] text-slate-400 italic">
                          [Sudah Digunakan]
                        </span>
                      ) : v.token ? (
                        <div className="flex items-center gap-2">
                          <code className="px-2 py-0.5 rounded-md bg-slate-100 font-mono text-xs font-bold text-slate-800 tracking-wider border border-slate-200">
                            {v.token}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyToken(v.token!, v.name)}
                            className="text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
                          >
                            Salin
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-6">
                      {v.hasVoted ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Sudah memilih
                          </span>
                          {v.votedAt && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              {new Date(v.votedAt).toLocaleString("id-ID", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </div>
                          )}
                        </div>
                      ) : v.isLocked ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          Terkunci (15 Menit)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          Belum memilih
                        </span>
                      )}
                    </td>

                    {/* Aksi */}
                    <td className="py-3.5 px-6 text-right">
                      <div className="inline-flex items-center gap-1">
                        {!v.hasVoted && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setResetVoter(v)}
                            className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            title="Reset token pemilih"
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Reset token
                          </Button>
                        )}
                        {!v.hasVoted && isSuperAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (confirm(`Hapus pemilih '${v.name}' (NIS: ${v.voterIdentity})?`)) {
                                deleteMutation.mutate(v.id);
                              }
                            }}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                            title="Hapus pemilih"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="text-xs"
            >
              Sebelumnya
            </Button>
            <span className="text-xs text-slate-500">
              Halaman {page} dari {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(page + 1)}
              className="text-xs"
            >
              Selanjutnya
            </Button>
          </div>
        )}
      </Card>

      {/* Add Single Voter Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!addNis.trim() || !addName.trim() || !addGroupId) return;
              addMutation.mutate({
                voterIdentity: addNis.trim(),
                name: addName.trim(),
                groupId: addGroupId,
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>Tambah Pemilih Manual</DialogTitle>
              <DialogDescription>
                Daftarkan pemilih baru ke DPT. Token akses 8-karakter unik akan dibuatkan secara otomatis.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Nomor Identitas (NIS)</label>
                <Input
                  placeholder="Contoh: 2324099"
                  value={addNis}
                  onChange={(e) => setAddNis(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Nama Lengkap</label>
                <Input
                  placeholder="Contoh: Muhammad Farhan"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Rombel / Kelas</label>
                <select
                  value={addGroupId}
                  onChange={(e) => setAddGroupId(e.target.value)}
                  className="w-full h-10 px-3 border rounded-md bg-white border-input text-xs"
                  required
                >
                  <option value="">-- Pilih Rombel --</option>
                  {voterGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={addMutation.isPending}
                className="bg-primary hover:bg-primary-hover text-white text-xs"
              >
                {addMutation.isPending ? "Mendaftarkan..." : "Daftarkan Pemilih"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Token Confirmation Dialog */}
      <Dialog open={!!resetVoter} onOpenChange={(open) => !open && setResetVoter(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Token Akses Pemilih?</DialogTitle>
            <DialogDescription>
              Apakah kamu yakin ingin mereset token milik <strong>{resetVoter?.name}</strong> (NIS: {resetVoter?.voterIdentity})?
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 text-xs text-slate-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
            Token lama akan segera dihanguskan dan seluruh sesi aktif pemilih ini akan diputus. Token baru akan dicatat pada log audit sistem.
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setResetVoter(null)}
              className="text-xs"
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={resetMutation.isPending}
              onClick={() => resetVoter && resetMutation.mutate(resetVoter.id)}
              className="bg-primary hover:bg-primary-hover text-white text-xs"
            >
              {resetMutation.isPending ? "Mereset..." : "Ya, Reset Token"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import DPT Dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Impor Data Pemilih (DPT) Massal
            </DialogTitle>
            <DialogDescription>
              Unggah file spreadsheet format CSV atau Excel (.xlsx). Sistem akan memvalidasi duplikasi NIS dan membuat rombel secara otomatis jika belum ada.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4 text-xs">
            {/* Download Template Banner */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800">Format Kolom: NIS, Nama, Rombel</p>
                <p className="text-[11px] text-slate-500">
                  Gunakan template resmi untuk mencegah kesalahan pembacaan data.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadSampleCsv}
                className="gap-1.5 text-xs font-medium"
              >
                <FileDown className="w-3.5 h-3.5" />
                Unduh Template
              </Button>
            </div>

            {/* Upload Drag & Drop Area */}
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <input
                type="file"
                id="dpt-file-input"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                className="hidden"
                onChange={handleFileUpload}
              />
              <label htmlFor="dpt-file-input" className="cursor-pointer block">
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <span className="font-semibold text-slate-800 block">
                  {importFileName ? importFileName : "Klik untuk memilih file CSV atau Excel"}
                </span>
                <span className="text-[11px] text-slate-400 block mt-1">
                  Mendukung file .csv, .xlsx, .xls
                </span>
              </label>
            </div>

            {/* Preview Table */}
            {importedRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">
                    Pratinjau Data ({importedRows.length} Baris Terbaca)
                  </span>
                  <span className="text-[11px] text-emerald-600 font-medium">Siap Diimpor ✓</span>
                </div>
                <div className="border border-border rounded-lg max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-600 sticky top-0">
                      <tr>
                        <th className="py-2 px-3">NIS</th>
                        <th className="py-2 px-3">Nama</th>
                        <th className="py-2 px-3">Rombel</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {importedRows.slice(0, 10).map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-1.5 px-3 font-mono text-slate-700">
                            {r.voterIdentity}
                          </td>
                          <td className="py-1.5 px-3 font-medium text-slate-900">{r.name}</td>
                          <td className="py-1.5 px-3 text-slate-600">{r.groupName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importedRows.length > 10 && (
                  <p className="text-[11px] text-slate-400 text-center">
                    ...dan {importedRows.length - 10} baris pemilih lainnya.
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsImportOpen(false)}
              className="text-xs"
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={importedRows.length === 0 || importMutation.isPending}
              onClick={() => importMutation.mutate(importedRows)}
              className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5"
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Mengimpor ke DPT...
                </>
              ) : (
                `Impor ${importedRows.length} Pemilih`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
