"use client";

import * as React from "react";
import Image from "next/image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  Plus,
  Trash2,
  Edit,
  Loader2,
  AlertCircle,
  Upload,
  CheckCircle2,
  X,
  Eye,
  Check,
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

interface Candidate {
  id: string;
  candidateNumber: number;
  name: string;
  classOrUnit: string;
  motto: string;
  vision: string;
  missions: string[];
  programs: string[];
  supporters: string[];
  photoUrl: string | null;
  themeColor: "red" | "green" | "blue" | "amber";
  isActive: boolean;
}

export default function CandidatesManagementPage() {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const isSuperAdmin = session?.user?.role === "super_admin";

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingCandidate, setEditingCandidate] = React.useState<Candidate | null>(null);

  // Form states
  const [candidateNumber, setCandidateNumber] = React.useState<number>(1);
  const [name, setName] = React.useState("");
  const [classOrUnit, setClassOrUnit] = React.useState("");
  const [motto, setMotto] = React.useState("");
  const [vision, setVision] = React.useState("");
  const [missions, setMissions] = React.useState<string[]>([""]);
  const [programs, setPrograms] = React.useState<string[]>([""]);
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(null);
  const [themeColor, setThemeColor] = React.useState<"red" | "green" | "blue" | "amber">("red");
  const [isActive, setIsActive] = React.useState(true);
  const [isUploading, setIsUploading] = React.useState(false);

  const { data, isLoading, error } = useQuery<{ success: boolean; data: Candidate[] }>({
    queryKey: queryKeys.candidates.all,
    queryFn: async () => {
      const res = await fetch("/api/admin/candidates");
      if (!res.ok) throw new Error("Gagal mengambil data kandidat.");
      return res.json();
    },
  });

  const candidates = data?.data || [];
  const activeCandidates = candidates.filter((c) => c.isActive);

  // Reset form
  const resetForm = () => {
    setEditingCandidate(null);
    setCandidateNumber(candidates.length + 1);
    setName("");
    setClassOrUnit("");
    setMotto("");
    setVision("");
    setMissions([""]);
    setPrograms([""]);
    setPhotoUrl(null);
    setThemeColor("red");
    setIsActive(true);
  };

  const openAddModal = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditModal = (c: Candidate) => {
    setEditingCandidate(c);
    setCandidateNumber(c.candidateNumber);
    setName(c.name);
    setClassOrUnit(c.classOrUnit);
    setMotto(c.motto);
    setVision(c.vision);
    setMissions(c.missions && c.missions.length > 0 ? c.missions : [""]);
    setPrograms(c.programs && c.programs.length > 0 ? c.programs : [""]);
    setPhotoUrl(c.photoUrl);
    setThemeColor(c.themeColor);
    setIsActive(c.isActive);
    setIsDialogOpen(true);
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Gagal mengunggah foto.");
      }

      setPhotoUrl(json.url);
      toast.success("Foto kandidat berhasil diunggah.");
    } catch (err: unknown) {
      toast.error("Upload Gagal", {
        description: err instanceof Error ? err.message : "Terjadi kesalahan upload.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Mutation save candidate
  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const isEdit = !!editingCandidate;
      const url = isEdit
        ? `/api/admin/candidates/${editingCandidate.id}`
        : "/api/admin/candidates";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Gagal menyimpan kandidat.");
      return json;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.candidates.all });
      toast.success("Kandidat Disimpan", { description: res.message });
      setIsDialogOpen(false);
    },
    onError: (err: Error) => {
      toast.error("Gagal Menyimpan", { description: err.message });
    },
  });

  // Mutation delete candidate
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/candidates/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Gagal menghapus kandidat.");
      return json;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.candidates.all });
      toast.success("Kandidat Dihapus", { description: res.message });
    },
    onError: (err: Error) => {
      toast.error("Gagal Menghapus", { description: err.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMissions = missions.map((m) => m.trim()).filter(Boolean);
    const cleanPrograms = programs.map((p) => p.trim()).filter(Boolean);

    if (cleanMissions.length === 0) {
      toast.error("Validasi Gagal", { description: "Minimal sertakan 1 misi kandidat." });
      return;
    }
    if (cleanPrograms.length === 0) {
      toast.error("Validasi Gagal", { description: "Minimal sertakan 1 program kerja unggulan." });
      return;
    }

    saveMutation.mutate({
      candidateNumber,
      name: name.trim(),
      classOrUnit: classOrUnit.trim(),
      motto: motto.trim(),
      vision: vision.trim(),
      missions: cleanMissions,
      programs: cleanPrograms,
      photoUrl,
      themeColor,
      isActive,
    });
  };

  const getThemeColorClass = (color: string) => {
    switch (color) {
      case "red":
        return "bg-rose-50 text-red-600 border-red-200";
      case "green":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "blue":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "amber":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
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
        <p>Gagal memuat daftar kandidat.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Title & CTA */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            Manajemen Kandidat
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {candidates.length} kandidat terdaftar, {activeCandidates.length} aktif. Hanya kandidat aktif yang tampil di surat suara.
          </p>
        </div>

        {isSuperAdmin && (
          <Button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white font-medium text-xs shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Tambah Kandidat
          </Button>
        )}
      </div>

      {/* Candidates Table Card */}
      <Card className="border-border shadow-xs bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-slate-50/70 text-slate-600 font-semibold">
                <th className="py-3.5 px-6">Kandidat</th>
                <th className="py-3.5 px-6">Kelas / Asal</th>
                <th className="py-3.5 px-6">Kelengkapan</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    Belum ada kandidat terdaftar. Klik "Tambah Kandidat" untuk mulai mendaftarkan paslon.
                  </td>
                </tr>
              ) : (
                candidates.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Kandidat Col */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3.5">
                        <span
                          className={`inline-flex items-center justify-center font-mono font-bold px-2 py-1 rounded-md text-xs border ${getThemeColorClass(
                            c.themeColor
                          )}`}
                        >
                          #{c.candidateNumber}
                        </span>
                        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-slate-100 border border-slate-200 relative">
                          {c.photoUrl ? (
                            <img
                              src={c.photoUrl}
                              alt={c.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-xs">
                              {c.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 max-w-xs">
                          <div className="font-bold text-slate-900 truncate">{c.name}</div>
                          <div className="text-[11px] text-slate-500 truncate italic">
                            "{c.motto}"
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Kelas Col */}
                    <td className="py-4 px-6 text-slate-700 font-medium">{c.classOrUnit}</td>

                    {/* Kelengkapan Col */}
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-1">
                        {c.photoUrl && (
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                            Foto ✓
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                          {c.missions?.length || 0} Misi
                        </Badge>
                        <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                          {c.programs?.length || 0} Program
                        </Badge>
                      </div>
                    </td>

                    {/* Status Col */}
                    <td className="py-4 px-6">
                      {c.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          Nonaktif
                        </span>
                      )}
                    </td>

                    {/* Aksi Col */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isSuperAdmin && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(c)}
                              className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
                              title="Edit kandidat"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={deleteMutation.isPending}
                              onClick={() => {
                                if (
                                  confirm(
                                    `Yakin ingin menghapus kandidat #${c.candidateNumber} (${c.name})?`
                                  )
                                ) {
                                  deleteMutation.mutate(c.id);
                                }
                              }}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                              title="Hapus kandidat"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add / Edit Dialog Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingCandidate
                  ? `Edit Kandidat #${editingCandidate.candidateNumber}`
                  : "Tambah Kandidat Baru"}
              </DialogTitle>
              <DialogDescription>
                Lengkapi profil calon pemimpin. Informasi ini akan ditampilkan di bilik suara digital dan laman profil.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4 text-xs">
              {/* Photo & Number Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                {/* Photo Upload Area */}
                <div className="sm:col-span-1 space-y-2">
                  <label className="font-semibold text-slate-700 block">Foto Kandidat</label>
                  <div className="w-full aspect-[4/5] rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-3 relative overflow-hidden group">
                    {photoUrl ? (
                      <>
                        <img
                          src={photoUrl}
                          alt="Preview"
                          className="w-full h-full object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => setPhotoUrl(null)}
                          className="absolute top-2 right-2 p-1 rounded-full bg-red-600 text-white shadow-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <label className="flex flex-col items-center justify-center cursor-pointer w-full h-full text-center">
                        <Upload className="w-6 h-6 text-slate-400 mb-1" />
                        <span className="text-[11px] font-medium text-slate-600">
                          {isUploading ? "Mengunggah..." : "Pilih Foto"}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">Maks. 2 MB (PNG/JPG)</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={handleUploadPhoto}
                          disabled={isUploading}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Number, Name, Class */}
                <div className="sm:col-span-2 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Nomor Urut</label>
                      <Input
                        type="number"
                        min={1}
                        max={99}
                        value={candidateNumber}
                        onChange={(e) => setCandidateNumber(parseInt(e.target.value) || 1)}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Warna Tema</label>
                      <select
                        value={themeColor}
                        onChange={(e) => setThemeColor(e.target.value as any)}
                        className="w-full h-10 px-3 border rounded-md bg-white border-input"
                      >
                        <option value="red">Civic Red (#1)</option>
                        <option value="green">Forest Green (#2)</option>
                        <option value="blue">Deep Blue (#3)</option>
                        <option value="amber">Warm Amber (#4)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Nama Lengkap Kandidat</label>
                    <Input
                      placeholder="Contoh: Raka Aditya Pratama"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Kelas / Unit Asal</label>
                    <Input
                      placeholder="Contoh: XI IPA 1"
                      value={classOrUnit}
                      onChange={(e) => setClassOrUnit(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Motto */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Motto / Slogan</label>
                <Input
                  placeholder="Contoh: Bersama Bergerak, Bersama Bersinar"
                  value={motto}
                  onChange={(e) => setMotto(e.target.value)}
                  required
                />
              </div>

              {/* Visi */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Visi</label>
                <textarea
                  rows={2}
                  value={vision}
                  onChange={(e) => setVision(e.target.value)}
                  className="w-full p-2.5 border rounded-md border-input bg-white text-slate-800 focus:ring-1 focus:ring-primary focus:outline-hidden"
                  placeholder="Visi kepemimpinan calon..."
                  required
                />
              </div>

              {/* Misi List */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700">Poin Misi</label>
                  <button
                    type="button"
                    onClick={() => setMissions([...missions, ""])}
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    + Tambah Misi
                  </button>
                </div>
                {missions.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-slate-400 font-mono text-[11px]">{idx + 1}.</span>
                    <Input
                      value={m}
                      onChange={(e) => {
                        const copy = [...missions];
                        copy[idx] = e.target.value;
                        setMissions(copy);
                      }}
                      placeholder={`Poin misi #${idx + 1}`}
                      required={idx === 0}
                    />
                    {missions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setMissions(missions.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-red-600 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Program Kerja List */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700">Program Kerja Unggulan</label>
                  <button
                    type="button"
                    onClick={() => setPrograms([...programs, ""])}
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    + Tambah Program
                  </button>
                </div>
                {programs.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-slate-400 font-mono text-[11px]">{idx + 1}.</span>
                    <Input
                      value={p}
                      onChange={(e) => {
                        const copy = [...programs];
                        copy[idx] = e.target.value;
                        setPrograms(copy);
                      }}
                      placeholder={`Nama program kerja #${idx + 1}`}
                      required={idx === 0}
                    />
                    {programs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setPrograms(programs.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-red-600 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Status Aktif */}
              <div className="pt-2 border-t border-border flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="font-semibold text-slate-800">Status Aktif di Surat Suara</span>
                  <p className="text-[11px] text-slate-500">
                    Kandidat nonaktif tidak akan muncul pada bilik suara pemilihan.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-primary rounded-sm border-input"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending || isUploading}
                className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5"
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Kandidat"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
