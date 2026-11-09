"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus, Trash2, Loader2, AlertCircle } from "lucide-react";
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

interface Major {
  id: string;
  name: string;
  code: string | null;
  sortOrder: number;
}

interface MasterDataResponse {
  success: boolean;
  data: {
    majors: Major[];
  };
}

export default function MajorsPage() {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [majorName, setMajorName] = React.useState("");
  const [majorCode, setMajorCode] = React.useState("");

  const { data, isLoading, error } = useQuery<MasterDataResponse>({
    queryKey: queryKeys.master.all,
    queryFn: async () => {
      const res = await fetch("/api/admin/master");
      if (!res.ok) throw new Error("Gagal mengambil data master.");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { type: "major"; name: string; code?: string }) => {
      const res = await fetch("/api/admin/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Gagal menambah jurusan.");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.master.all });
      toast.success("Jurusan Berhasil Ditambahkan");
      setMajorName("");
      setMajorCode("");
      setIsAddOpen(false);
    },
    onError: (err: Error) => {
      toast.error("Gagal Menyimpan", { description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/master?type=major&id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Gagal menghapus jurusan.");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.master.all });
      toast.success("Jurusan berhasil dihapus.");
    },
    onError: (err: Error) => {
      toast.error("Gagal Menghapus", { description: err.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!majorName.trim()) return;
    createMutation.mutate({
      type: "major",
      name: majorName.trim(),
      code: majorCode.trim() || undefined,
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
        <p>Gagal memuat master data jurusan.</p>
      </div>
    );
  }

  const { majors = [] } = data.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Data Jurusan / Peminatan
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Kelola daftar program peminatan atau konsentrasi keahlian untuk pemilihan.
          </p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 text-xs font-medium bg-primary hover:bg-primary-hover text-white">
              <Plus className="w-3.5 h-3.5" />
              Tambah Jurusan
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Tambah Jurusan Baru</DialogTitle>
                <DialogDescription>
                  Masukkan nama jurusan dan kode singkatan resmi.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Nama Jurusan</label>
                  <Input
                    placeholder="Contoh: Ilmu Pengetahuan Alam"
                    value={majorName}
                    onChange={(e) => setMajorName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Kode Singkat (Opsional)</label>
                  <Input
                    placeholder="Contoh: IPA, IPS, RPL"
                    value={majorCode}
                    onChange={(e) => setMajorCode(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-primary hover:bg-primary-hover text-white text-xs"
                >
                  {createMutation.isPending ? "Menyimpan..." : "Simpan Jurusan"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border shadow-xs bg-white">
        <CardHeader className="p-5 border-b border-border">
          <CardTitle className="text-base font-bold text-slate-800">
            Daftar Jurusan Terdaftar ({majors.length})
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Jurusan yang tersedia pada instansi penyelenggara pemilihan.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-slate-50/70 text-slate-600 font-semibold">
                  <th className="py-3 px-5">Nama Jurusan</th>
                  <th className="py-3 px-4">Kode</th>
                  <th className="py-3 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {majors.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400">
                      Belum ada data jurusan. Silakan tambahkan jurusan baru.
                    </td>
                  </tr>
                ) : (
                  majors.map((major) => (
                    <tr key={major.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-5 font-semibold text-slate-800">
                        {major.name}
                      </td>
                      <td className="py-3 px-4">
                        {major.code ? (
                          <Badge variant="outline" className="font-mono text-[11px]">
                            {major.code}
                          </Badge>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (confirm(`Yakin ingin menghapus jurusan '${major.name}'?`)) {
                              deleteMutation.mutate(major.id);
                            }
                          }}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
