"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Layers,
  Plus,
  Trash2,
  Users,
  GraduationCap,
  Loader2,
  AlertCircle,
  School,
  CheckCircle2,
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";

interface GradeLevel {
  id: string;
  name: string;
  sortOrder: number;
}

interface Major {
  id: string;
  name: string;
  code: string | null;
}

interface VoterGroup {
  id: string;
  name: string;
  gradeLevelId: string | null;
  majorId: string | null;
  sortOrder: number;
  voterCount: number;
}

interface MasterDataResponse {
  success: boolean;
  data: {
    gradeLevels: GradeLevel[];
    majors: Major[];
    voterGroups: VoterGroup[];
  };
}

export default function ClassesAndGroupsPage() {
  const queryClient = useQueryClient();

  // State dialogs
  const [isAddGradeOpen, setIsAddGradeOpen] = React.useState(false);
  const [isAddGroupOpen, setIsAddGroupOpen] = React.useState(false);

  // Form states
  const [gradeName, setGradeName] = React.useState("");
  const [groupName, setGroupName] = React.useState("");
  const [selectedGradeId, setSelectedGradeId] = React.useState<string>("");
  const [selectedMajorId, setSelectedMajorId] = React.useState<string>("");

  // Query master data
  const { data, isLoading, error } = useQuery<MasterDataResponse>({
    queryKey: queryKeys.master.all,
    queryFn: async () => {
      const res = await fetch("/api/admin/master");
      if (!res.ok) throw new Error("Gagal mengambil data master.");
      return res.json();
    },
  });

  // Mutation create master item
  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch("/api/admin/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Gagal menambah data.");
      return json;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.master.all });
      toast.success(
        variables.type === "grade" ? "Tingkat Kelas Ditambahkan" : "Rombel Ditambahkan"
      );
      setGradeName("");
      setGroupName("");
      setIsAddGradeOpen(false);
      setIsAddGroupOpen(false);
    },
    onError: (err: Error) => {
      toast.error("Gagal Menyimpan", { description: err.message });
    },
  });

  // Mutation delete master item
  const deleteMutation = useMutation({
    mutationFn: async (params: { type: string; id: string }) => {
      const res = await fetch(`/api/admin/master?type=${params.type}&id=${params.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Gagal menghapus data.");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.master.all });
      toast.success("Data berhasil dihapus.");
    },
    onError: (err: Error) => {
      toast.error("Gagal Menghapus", { description: err.message });
    },
  });

  const handleCreateGrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradeName.trim()) return;
    createMutation.mutate({
      type: "grade",
      name: gradeName.trim(),
    });
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    createMutation.mutate({
      type: "group",
      name: groupName.trim(),
      gradeLevelId: selectedGradeId || null,
      majorId: selectedMajorId || null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="p-6 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
        <p>Gagal memuat master data tingkat kelas dan rombel.</p>
      </div>
    );
  }

  const { gradeLevels = [], majors = [], voterGroups = [] } = data.data;
  const totalVotersInGroups = voterGroups.reduce((acc, g) => acc + (g.voterCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header & Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <School className="w-5 h-5 text-primary" />
            Tingkat Kelas & Rombel Pemilih
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Kelola pengelompokan pemilih DPT berdasarkan tingkat angkatan dan rombongan belajar.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Add Grade Dialog */}
          <Dialog open={isAddGradeOpen} onOpenChange={setIsAddGradeOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs font-medium">
                <Plus className="w-3.5 h-3.5" />
                Tambah Tingkat
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <form onSubmit={handleCreateGrade}>
                <DialogHeader>
                  <DialogTitle>Tambah Tingkat Kelas</DialogTitle>
                  <DialogDescription>
                    Masukkan nama tingkat atau tingkatan pemilihan (contoh: Kelas X, Kelas XI).
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Nama Tingkat</label>
                    <Input
                      placeholder="Contoh: Kelas X"
                      value={gradeName}
                      onChange={(e) => setGradeName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="bg-primary hover:bg-primary-hover text-white text-xs"
                  >
                    {createMutation.isPending ? "Menyimpan..." : "Simpan Tingkat"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Add Group Dialog */}
          <Dialog open={isAddGroupOpen} onOpenChange={setIsAddGroupOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 text-xs font-medium bg-primary hover:bg-primary-hover text-white">
                <Plus className="w-3.5 h-3.5" />
                Tambah Rombel
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <form onSubmit={handleCreateGroup}>
                <DialogHeader>
                  <DialogTitle>Tambah Rombongan Belajar (Rombel)</DialogTitle>
                  <DialogDescription>
                    Tambahkan kelompok pemilih yang akan digunakan saat pengelompokan DPT.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Nama Rombel</label>
                    <Input
                      placeholder="Contoh: X-A atau XI-IPA-1"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Tingkat (Opsional)</label>
                      <select
                        value={selectedGradeId}
                        onChange={(e) => setSelectedGradeId(e.target.value)}
                        className="w-full h-10 px-3 text-xs border rounded-md bg-white border-input focus:ring-1 focus:ring-primary"
                      >
                        <option value="">-- Pilih Tingkat --</option>
                        {gradeLevels.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Jurusan (Opsional)</label>
                      <select
                        value={selectedMajorId}
                        onChange={(e) => setSelectedMajorId(e.target.value)}
                        className="w-full h-10 px-3 text-xs border rounded-md bg-white border-input focus:ring-1 focus:ring-primary"
                      >
                        <option value="">-- Pilih Jurusan --</option>
                        {majors.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.code ? `(${m.code})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="bg-primary hover:bg-primary-hover text-white text-xs"
                  >
                    {createMutation.isPending ? "Menyimpan..." : "Simpan Rombel"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border shadow-xs bg-white">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-medium text-slate-500">
              Total Tingkat Terdaftar
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-slate-800 font-mono">
              {gradeLevels.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border shadow-xs bg-white">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-medium text-slate-500">
              Total Rombongan Belajar
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-slate-800 font-mono">
              {voterGroups.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border shadow-xs bg-white">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-medium text-slate-500">
              Total Pemilih Terpetakan
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-slate-800 font-mono">
              {totalVotersInGroups}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Rombel Table */}
      <Card className="border-border shadow-xs bg-white">
        <CardHeader className="p-5 border-b border-border">
          <CardTitle className="text-base font-bold text-slate-800">
            Daftar Rombel / Kelompok Pemilih
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Daftar kelompok pemilih yang digunakan saat validasi DPT dan statistik partisipasi.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-slate-50/70 text-slate-600 font-semibold">
                  <th className="py-3 px-5">Nama Rombel</th>
                  <th className="py-3 px-4">Tingkat</th>
                  <th className="py-3 px-4">Jurusan</th>
                  <th className="py-3 px-4 text-center">Jumlah DPT</th>
                  <th className="py-3 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {voterGroups.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Belum ada rombel terdaftar. Silakan tambah rombel baru.
                    </td>
                  </tr>
                ) : (
                  voterGroups.map((group) => {
                    const grade = gradeLevels.find((g) => g.id === group.gradeLevelId);
                    const major = majors.find((m) => m.id === group.majorId);

                    return (
                      <tr key={group.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-5 font-semibold text-slate-800">
                          {group.name}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {grade ? (
                            <Badge variant="outline" className="text-[11px] font-normal">
                              {grade.name}
                            </Badge>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {major ? (
                            <Badge variant="outline" className="text-[11px] font-normal">
                              {major.name}
                            </Badge>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-medium text-slate-700">
                          {group.voterCount} Pemilih
                        </td>
                        <td className="py-3 px-5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={deleteMutation.isPending || group.voterCount > 0}
                            title={
                              group.voterCount > 0
                                ? "Rombel tidak dapat dihapus karena masih memuat pemilih"
                                : "Hapus rombel"
                            }
                            onClick={() => {
                              if (confirm(`Yakin ingin menghapus rombel '${group.name}'?`)) {
                                deleteMutation.mutate({ type: "group", id: group.id });
                              }
                            }}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
