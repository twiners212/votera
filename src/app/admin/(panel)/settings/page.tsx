"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  SlidersHorizontal,
  Save,
  Loader2,
  AlertCircle,
  Clock,
  Building2,
  Calendar,
  Layers,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { authClient } from "@/lib/auth/admin-client";

interface ElectionData {
  id: string;
  slug: string;
  title: string;
  shortName: string;
  organizationName: string;
  description: string;
  status: "draft" | "open" | "closed" | "archived";
  startAt: string | null;
  endAt: string | null;
}

interface SettingsData {
  idLabel: string;
  groupLabel: string;
  gradeLabel: string;
  majorLabel: string;
  isResultPublic: boolean;
  logoUrl: string | null;
  heroBannerUrl: string | null;
}

interface SettingsApiResponse {
  success: boolean;
  data: {
    election: ElectionData;
    settings: SettingsData;
  };
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const isSuperAdmin = session?.user?.role === "super_admin";

  const { data, isLoading, error } = useQuery<SettingsApiResponse>({
    queryKey: queryKeys.settings.all,
    queryFn: async () => {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) throw new Error("Gagal mengambil pengaturan pemilihan.");
      return res.json();
    },
  });

  // Local form state
  const [title, setTitle] = React.useState("");
  const [shortName, setShortName] = React.useState("");
  const [organizationName, setOrganizationName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [status, setStatus] = React.useState<"draft" | "open" | "closed" | "archived">("open");
  const [startAt, setStartAt] = React.useState("");
  const [endAt, setEndAt] = React.useState("");
  const [idLabel, setIdLabel] = React.useState("NIS");
  const [groupLabel, setGroupLabel] = React.useState("Rombel");
  const [gradeLabel, setGradeLabel] = React.useState("Tingkat");
  const [majorLabel, setMajorLabel] = React.useState("Jurusan");
  const [isResultPublic, setIsResultPublic] = React.useState(false);

  // Sync state when data is loaded
  React.useEffect(() => {
    if (data?.data) {
      const { election, settings } = data.data;
      setTitle(election.title || "");
      setShortName(election.shortName || "");
      setOrganizationName(election.organizationName || "");
      setDescription(election.description || "");
      setStatus(election.status || "open");

      // Format ISO string to datetime-local format YYYY-MM-DDTHH:mm
      if (election.startAt) {
        const d = new Date(election.startAt);
        setStartAt(d.toISOString().slice(0, 16));
      }
      if (election.endAt) {
        const d = new Date(election.endAt);
        setEndAt(d.toISOString().slice(0, 16));
      }

      if (settings) {
        setIdLabel(settings.idLabel || "NIS");
        setGroupLabel(settings.groupLabel || "Rombel");
        setGradeLabel(settings.gradeLabel || "Tingkat");
        setMajorLabel(settings.majorLabel || "Jurusan");
        setIsResultPublic(settings.isResultPublic || false);
      }
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Gagal menyimpan pengaturan.");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
      toast.success("Pengaturan Berhasil Disimpan", {
        description: "Perubahan telah dicatat di log audit sistem.",
      });
    },
    onError: (err: Error) => {
      toast.error("Gagal Menyimpan", { description: err.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      toast.error("Akses Ditolak", {
        description: "Hanya Super Admin yang diizinkan mengubah konfigurasi.",
      });
      return;
    }

    saveMutation.mutate({
      title,
      shortName,
      organizationName,
      description,
      status,
      startAt: startAt ? new Date(startAt).toISOString() : null,
      endAt: endAt ? new Date(endAt).toISOString() : null,
      idLabel,
      groupLabel,
      gradeLabel,
      majorLabel,
      isResultPublic,
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
        <p>Gagal memuat pengaturan pemilihan.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* Page Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-primary" />
            Pengaturan & Kustomisasi Pemilihan
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Konfigurasi identitas pemilihan, jadwal waktu server, status, dan label multi-instansi.
          </p>
        </div>

        <Button
          type="submit"
          disabled={saveMutation.isPending || !isSuperAdmin}
          className="gap-2 bg-primary hover:bg-primary-hover text-white shadow-xs"
        >
          {saveMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Simpan Perubahan
        </Button>
      </div>

      {!isSuperAdmin && (
        <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Mode Hanya-Baca: Peran Anda adalah <strong>Panitia</strong>. Hanya <strong>Super Admin</strong> yang dapat mengubah pengaturan pemilihan.
          </span>
        </div>
      )}

      {/* Section 1: Identitas Pemilihan & Instansi */}
      <Card className="border-border shadow-xs bg-white">
        <CardHeader className="p-5 border-b border-border">
          <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Identitas Pemilihan & Instansi Penyelenggara
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Digunakan di portal pemilih, surat suara digital, dan dokumen berita acara resmi.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Nama Lengkap Pemilihan
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!isSuperAdmin}
                placeholder="Contoh: Pemilihan Ketua OSIS 2026"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Nama Singkat / Event
              </label>
              <Input
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                disabled={!isSuperAdmin}
                placeholder="Contoh: PILKETOS 2026"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Nama Instansi / Organisasi / Komunitas
            </label>
            <Input
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              disabled={!isSuperAdmin}
              placeholder="Contoh: SMA Bojong Gede atau BEM Universitas X"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Deskripsi & Maklumat Pemilihan
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!isSuperAdmin}
              rows={3}
              className="w-full p-3 text-xs border rounded-md border-input bg-white text-slate-800 focus:ring-1 focus:ring-primary focus:outline-hidden"
              placeholder="Pesan panduan atau pengantar bagi seluruh pemilih..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Jadwal & Status Pemilihan */}
      <Card className="border-border shadow-xs bg-white">
        <CardHeader className="p-5 border-b border-border">
          <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Jadwal & Status Pemungutan Suara
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Waktu server mengunci sistem secara otomatis di luar jam yang ditentukan.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Status Pemilihan Saat Ini
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              disabled={!isSuperAdmin}
              className="w-full sm:w-64 h-10 px-3 text-xs border rounded-md bg-white border-input focus:ring-1 focus:ring-primary"
            >
              <option value="draft">Draft (Belum Dibuka)</option>
              <option value="open">Open (Pemungutan Suara Berlangsung)</option>
              <option value="closed">Closed (Pemungutan Suara Selesai)</option>
              <option value="archived">Archived (Diarsipkan)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Waktu Mulai Pemilihan
              </label>
              <Input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                disabled={!isSuperAdmin}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Waktu Selesai Pemilihan
              </label>
              <Input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                disabled={!isSuperAdmin}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Kustomisasi Multi-Instansi (Dynamic Labels) */}
      <Card className="border-border shadow-xs bg-white">
        <CardHeader className="p-5 border-b border-border">
          <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            Konfigurasi Multi-Instansi (Label Dinamis)
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Sesuaikan istilah data agar relevan dengan tipe instansi (Sekolah, Kampus, RT/RW, Perusahaan, atau Komunitas).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Label Identitas Pemilih
              </label>
              <Input
                value={idLabel}
                onChange={(e) => setIdLabel(e.target.value)}
                disabled={!isSuperAdmin}
                placeholder="NIS / NIM / NIK / ID Anggota"
              />
              <p className="text-[11px] text-muted-foreground">
                Akan muncul di input login: "Masukkan {idLabel} Kamu"
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Label Rombel / Kelompok
              </label>
              <Input
                value={groupLabel}
                onChange={(e) => setGroupLabel(e.target.value)}
                disabled={!isSuperAdmin}
                placeholder="Rombel / Kelas / RT / Divisi"
              />
              <p className="text-[11px] text-muted-foreground">
                Digunakan pada tabel DPT dan statistik per kelompok.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Label Tingkat
              </label>
              <Input
                value={gradeLabel}
                onChange={(e) => setGradeLabel(e.target.value)}
                disabled={!isSuperAdmin}
                placeholder="Tingkat / Angkatan / RW"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Label Jurusan
              </label>
              <Input
                value={majorLabel}
                onChange={(e) => setMajorLabel(e.target.value)}
                disabled={!isSuperAdmin}
                placeholder="Jurusan / Prodi / Departemen"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Kebijakan Transparansi Hasil */}
      <Card className="border-border shadow-xs bg-white">
        <CardHeader className="p-5 border-b border-border">
          <CardTitle className="text-base font-bold text-slate-800">
            Transparansi & Visibilitas Hasil
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Tentukan apakah penghitungan suara dapat dilihat secara langsung oleh publik atau hanya oleh panitia.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="publicResult"
              checked={isResultPublic}
              onCheckedChange={(checked) => setIsResultPublic(checked === true)}
              disabled={!isSuperAdmin}
            />
            <div className="space-y-1">
              <label
                htmlFor="publicResult"
                className="text-xs font-semibold text-slate-800 cursor-pointer select-none"
              >
                Buka Hasil Suara Secara Publik (Live Count)
              </label>
              <p className="text-xs text-slate-500">
                Jika diaktifkan, grafik hasil pemilihan dan perolehan suara dapat diakses oleh siapa saja di halaman publik tanpa harus login.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
