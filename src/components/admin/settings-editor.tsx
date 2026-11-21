"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Globe,
  Info,
  Loader2,
  Save,
  ShieldAlert,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUploadCropperField } from "@/components/admin/image-upload-cropper-field";
import { ElectionResetDialog } from "@/components/admin/election-reset-dialog";
import {
  useElectionSettings,
  useUpdateElectionSettings,
} from "@/hooks/use-settings";
import { cn } from "@/lib/utils";
import type { AdminRole, ElectionStatus } from "@/types/votera";

export interface SettingsEditorProps {
  electionId?: string;
  role?: AdminRole;
}

function toLocalDatetimeInput(isoString?: string | null): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return "";
  }
}

export function SettingsEditor({
  electionId = "active",
  role = "committee",
}: SettingsEditorProps) {
  const isSuperAdmin = role === "super_admin";

  const { data, isLoading, isError, error, refetch, isFetching } =
    useElectionSettings(electionId);
  const updateMutation = useUpdateElectionSettings(electionId);

  // Form states
  const [shortName, setShortName] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [organizationName, setOrganizationName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [status, setStatus] = React.useState<ElectionStatus>("draft");
  const [startAt, setStartAt] = React.useState("");
  const [endAt, setEndAt] = React.useState("");
  const [idLabel, setIdLabel] = React.useState("NIS");
  const [groupLabel, setGroupLabel] = React.useState("Rombel");
  const [gradeLabel, setGradeLabel] = React.useState("Tingkat");
  const [majorLabel, setMajorLabel] = React.useState("Jurusan");
  const [isResultPublic, setIsResultPublic] = React.useState(false);
  const [logoUrl, setLogoUrl] = React.useState("");
  const [heroBannerUrl, setHeroBannerUrl] = React.useState("");
  const [isScheduleConfirmOpen, setIsScheduleConfirmOpen] = React.useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = React.useState(false);

  const isElectionActive =
    data?.election?.status === "open" ||
    (data?.election?.status as string) === "active" ||
    status === "open" ||
    (status as string) === "active";

  // Sync form with fetched data
  React.useEffect(() => {
    if (data) {
      setShortName(data.election.shortName || "");
      setTitle(data.election.title || "");
      setOrganizationName(data.election.organizationName || "");
      setDescription(data.election.description || "");
      setStatus(data.election.status || "draft");
      setStartAt(toLocalDatetimeInput(data.election.startAt));
      setEndAt(toLocalDatetimeInput(data.election.endAt));

      setIdLabel(data.settings.idLabel || "NIS");
      setGroupLabel(data.settings.groupLabel || "Rombel");
      setGradeLabel(data.settings.gradeLabel || "Tingkat");
      setMajorLabel(data.settings.majorLabel || "Jurusan");
      setIsResultPublic(Boolean(data.settings.isResultPublic));
      setLogoUrl(data.settings.logoUrl || "");
      setHeroBannerUrl(data.settings.heroBannerUrl || "");
    }
  }, [data]);

  // If not super admin, render 403 screen
  if (!isSuperAdmin) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FEE2E2] text-[#DC2626]">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-[#0F172A] sm:text-2xl">
          Akses Terbatas: Khusus Super Admin
        </h1>
        <p className="mt-2 max-w-md text-sm text-[#475569]">
          Pengaturan pemilihan hanya dapat dikonfigurasi oleh akun dengan peran{" "}
          <strong className="text-[#0F172A]">Super Admin</strong>. Akun Panitia
          hanya memiliki akses operasional pemungutan suara.
        </p>
        <Link href="/admin/dashboard" className="mt-6">
          <Button
            type="button"
            className="h-10 rounded-[10px] bg-[#D93829] px-5 text-xs font-semibold text-white hover:bg-[#B8281B]"
          >
            Kembali ke Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const executeSave = async () => {
    try {
      await updateMutation.mutateAsync({
        shortName: shortName.trim(),
        title: title.trim(),
        organizationName: organizationName.trim(),
        description: description.trim() || null,
        status,
        startAt: startAt ? new Date(startAt).toISOString() : null,
        endAt: endAt ? new Date(endAt).toISOString() : null,
        idLabel: idLabel.trim() || "NIS",
        groupLabel: groupLabel.trim() || "Rombel",
        gradeLabel: gradeLabel.trim() || "Tingkat",
        majorLabel: majorLabel.trim() || "Jurusan",
        isResultPublic,
        logoUrl: logoUrl.trim() || null,
        heroBannerUrl: heroBannerUrl.trim() || null,
      });
      toast.success("Pengaturan pemilihan berhasil disimpan!");
      setIsScheduleConfirmOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Gagal menyimpan pengaturan pemilihan"
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!shortName.trim()) {
      toast.error("Nama singkat pemilihan tidak boleh kosong");
      return;
    }
    if (!title.trim()) {
      toast.error("Judul pemilihan tidak boleh kosong");
      return;
    }
    if (!organizationName.trim()) {
      toast.error("Nama instansi/sekolah tidak boleh kosong");
      return;
    }

    if (startAt && endAt) {
      const startDate = new Date(startAt);
      const endDate = new Date(endAt);
      if (endDate.getTime() <= startDate.getTime()) {
        toast.error("Waktu selesai pemilihan harus lebih besar dari waktu mulai");
        return;
      }
    }

    // Proteksi cerdas: Status 'open' mewajibkan endAt di masa depan
    if (status === "open" && endAt) {
      const endDate = new Date(endAt);
      if (endDate.getTime() <= Date.now()) {
        toast.error(
          "Waktu selesai pemilihan harus berada di masa depan jika status pemilihan Open. Silakan perpanjang jam selesai atau ubah status ke Closed."
        );
        return;
      }
    }

    // Cek apakah pemilihan saat ini berstatus 'open' dan jadwal diubah di hari-H
    const isCurrentlyOpen = data?.election?.status === "open";
    const initialStart = toLocalDatetimeInput(data?.election?.startAt);
    const initialEnd = toLocalDatetimeInput(data?.election?.endAt);
    const hasScheduleChanged = startAt !== initialStart || endAt !== initialEnd;

    if (isCurrentlyOpen && hasScheduleChanged) {
      setIsScheduleConfirmOpen(true);
      return;
    }

    await executeSave();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#0F172A] sm:text-2xl">
            Pengaturan Pemilihan
          </h1>
          <p className="mt-1 text-sm text-[#475569]">
            Sesuaikan identitas, jadwal pelaksanaan, penamaan label dinamis, dan
            visibilitas hasil pemilihan.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="h-10 rounded-[10px] border-[#CBD5E1] bg-white text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
        >
          <Loader2
            className={cn("mr-1.5 h-3.5 w-3.5", isFetching && "animate-spin")}
            aria-hidden="true"
          />
          <span>Muat Ulang</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-[12px] border border-[#E2E8F0] bg-white p-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#D93829]" />
          <p className="mt-3 text-sm text-[#64748B]">
            Memuat konfigurasi pemilihan...
          </p>
        </div>
      ) : isError ? (
        <div className="rounded-[12px] border border-[#FECACA] bg-[#FFF5F5] p-6 text-center text-[#DC2626]">
          <AlertCircle className="mx-auto h-8 w-8" />
          <p className="mt-2 text-sm font-semibold">
            Gagal memuat pengaturan pemilihan
          </p>
          <p className="text-xs text-[#64748B]">{error?.message}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section A: Identitas Pemilihan */}
          <section className="rounded-[12px] border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2 border-b border-[#F1F5F9] pb-4">
              <Info className="h-5 w-5 text-[#D93829]" />
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">
                  A. Identitas Pemilihan
                </h2>
                <p className="text-xs text-[#64748B]">
                  Nama acara dan instansi penyelenggara yang ditampilkan kepada
                  pemilih.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="shortName"
                  className="text-xs font-semibold text-[#334155]"
                >
                  Nama Singkat Acara <span className="text-[#DC2626]">*</span>
                </label>
                <Input
                  id="shortName"
                  value={shortName}
                  onChange={(e) => setShortName(e.target.value)}
                  placeholder="Contoh: PILKETOS 2026"
                  className="h-10 rounded-[10px] border-[#CBD5E1]"
                  required
                />
                <p className="text-[11px] text-[#94A3B8]">
                  Muncul di navbar atas dan kop berita acara (maks 50 karakter).
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="organizationName"
                  className="text-xs font-semibold text-[#334155]"
                >
                  Nama Instansi / Sekolah <span className="text-[#DC2626]">*</span>
                </label>
                <Input
                  id="organizationName"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="Contoh: SMA Negeri 1 Bojonggede"
                  className="h-10 rounded-[10px] border-[#CBD5E1]"
                  required
                />
                <p className="text-[11px] text-[#94A3B8]">
                  Nama resmi instansi penyelenggara pemilihan.
                </p>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label
                  htmlFor="title"
                  className="text-xs font-semibold text-[#334155]"
                >
                  Judul Lengkap Pemilihan <span className="text-[#DC2626]">*</span>
                </label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Pemilihan Ketua dan Wakil Ketua OSIS Periode 2026/2027"
                  className="h-10 rounded-[10px] border-[#CBD5E1]"
                  required
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label
                  htmlFor="description"
                  className="text-xs font-semibold text-[#334155]"
                >
                  Deskripsi / Keterangan Acara
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Keterangan singkat mengenai tata cara atau pengumuman pemilihan..."
                  rows={3}
                  className="w-full rounded-[10px] border border-[#CBD5E1] p-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]/20"
                />
              </div>
            </div>
          </section>

          {/* Section B: Jadwal & Status */}
          <section className="rounded-[12px] border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2 border-b border-[#F1F5F9] pb-4">
              <Calendar className="h-5 w-5 text-[#D93829]" />
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">
                  B. Jadwal & Status Pemilihan
                </h2>
                <p className="text-xs text-[#64748B]">
                  Atur jendela waktu pemungutan suara dan status operasional sistem.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="status"
                  className="text-xs font-semibold text-[#334155]"
                >
                  Status Pemilihan
                </label>
                <Select
                  value={status}
                  onValueChange={(val: ElectionStatus) => setStatus(val)}
                >
                  <SelectTrigger
                    id="status"
                    className="h-10 rounded-[10px] border-[#CBD5E1]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft (Belum Dibuka)</SelectItem>
                    <SelectItem value="open">Open (Sedang Berlangsung)</SelectItem>
                    <SelectItem value="closed">Closed (Ditutup)</SelectItem>
                    <SelectItem value="archived">Archived (Diarsipkan)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-[#94A3B8]">
                  Hanya status &quot;Open&quot; yang memperbolehkan login dan pemungutan
                  suara.
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="startAt"
                  className="text-xs font-semibold text-[#334155]"
                >
                  Waktu Mulai Pemilihan
                </label>
                <Input
                  id="startAt"
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className="h-10 rounded-[10px] border-[#CBD5E1] tabular-nums"
                />
                <p className="text-[11px] text-[#94A3B8]">
                  Waktu awal pembukaan bilik suara digital.
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="endAt"
                  className="text-xs font-semibold text-[#334155]"
                >
                  Waktu Selesai Pemilihan
                </label>
                <Input
                  id="endAt"
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  className="h-10 rounded-[10px] border-[#CBD5E1] tabular-nums"
                />
                <p className="text-[11px] text-[#94A3B8]">
                  Batas akhir pengiriman suara pemilih.
                </p>
              </div>
            </div>
          </section>

          {/* Section C: Label Dinamis */}
          <section className="rounded-[12px] border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2 border-b border-[#F1F5F9] pb-4">
              <Tag className="h-5 w-5 text-[#D93829]" />
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">
                  C. Label Dinamis Kolom
                </h2>
                <p className="text-xs text-[#64748B]">
                  Sesuaikan istilah kolom agar cocok dengan sekolah (NIS, Rombel,
                  Tingkat, Jurusan) atau organisasi (NIM, Unit, Divisi).
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="idLabel"
                  className="text-xs font-semibold text-[#334155]"
                >
                  Label ID Pemilih
                </label>
                <Input
                  id="idLabel"
                  value={idLabel}
                  onChange={(e) => setIdLabel(e.target.value)}
                  placeholder="NIS / NIM / NIK"
                  className="h-10 rounded-[10px] border-[#CBD5E1]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="groupLabel"
                  className="text-xs font-semibold text-[#334155]"
                >
                  Label Kelompok / Kelas
                </label>
                <Input
                  id="groupLabel"
                  value={groupLabel}
                  onChange={(e) => setGroupLabel(e.target.value)}
                  placeholder="Rombel / Kelas / Unit"
                  className="h-10 rounded-[10px] border-[#CBD5E1]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="gradeLabel"
                  className="text-xs font-semibold text-[#334155]"
                >
                  Label Tingkat
                </label>
                <Input
                  id="gradeLabel"
                  value={gradeLabel}
                  onChange={(e) => setGradeLabel(e.target.value)}
                  placeholder="Tingkat / Angkatan / Level"
                  className="h-10 rounded-[10px] border-[#CBD5E1]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="majorLabel"
                  className="text-xs font-semibold text-[#334155]"
                >
                  Label Jurusan / Program
                </label>
                <Input
                  id="majorLabel"
                  value={majorLabel}
                  onChange={(e) => setMajorLabel(e.target.value)}
                  placeholder="Jurusan / Program / Divisi"
                  className="h-10 rounded-[10px] border-[#CBD5E1]"
                  required
                />
              </div>
            </div>
          </section>

          {/* Section D: Publikasi & Tampilan */}
          <section className="rounded-[12px] border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2 border-b border-[#F1F5F9] pb-4">
              <Globe className="h-5 w-5 text-[#D93829]" />
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">
                  D. Publikasi & Tampilan
                </h2>
                <p className="text-xs text-[#64748B]">
                  Kelola keterbukaan hasil real-time dan tautan logo atau banner.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-5">
              <div className="flex items-start gap-3 rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <Checkbox
                  id="isResultPublic"
                  checked={isResultPublic}
                  onCheckedChange={(checked) => setIsResultPublic(Boolean(checked))}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <label
                    htmlFor="isResultPublic"
                    className="text-xs font-bold text-[#0F172A] cursor-pointer"
                  >
                    Publikasikan Hasil Pemilihan ke Umum
                  </label>
                  <p className="text-xs text-[#64748B]">
                    Jika diaktifkan, halaman publik `/results` dapat diakses oleh
                    siapa saja tanpa login panitia. Jika dimatikan, hanya panitia
                    yang dapat memantau perolehan suara.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <ImageUploadCropperField
                  id="logoUrl"
                  label="Logo Sekolah / Instansi"
                  description="Logo resmi yang tampil pada bilah navigasi dan identitas pemilihan."
                  value={logoUrl}
                  onChange={(url) => setLogoUrl(url || "")}
                  aspectRatio={1}
                  aspectLabel="1:1 (Persegi)"
                  previewAspectClassName="aspect-square w-24 sm:w-28"
                  previewObjectFit="contain"
                  targetMaxWidth={512}
                  targetMaxHeight={512}
                  preferredMimeType="image/webp"
                  fallbackSrc="/images/logo-default.png"
                  placeholderUrl="https://... atau /uploads/..."
                  electionId={electionId}
                  disabled={!isSuperAdmin}
                />

                <ImageUploadCropperField
                  id="heroBannerUrl"
                  label="Hero Banner Halaman Utama"
                  description="Banner visual kampanye yang tampil pada kartu sambutan pemilih."
                  value={heroBannerUrl}
                  onChange={(url) => setHeroBannerUrl(url || "")}
                  aspectRatio={16 / 9}
                  aspectLabel="16:9 (Lanskap)"
                  previewAspectClassName="aspect-video w-48 sm:w-56"
                  previewObjectFit="cover"
                  targetMaxWidth={1920}
                  targetMaxHeight={1080}
                  preferredMimeType="image/webp"
                  fallbackSrc="/images/hero-flag-ballot.jpg"
                  placeholderUrl="https://... atau /uploads/..."
                  electionId={electionId}
                  disabled={!isSuperAdmin}
                />
              </div>
            </div>
          </section>

          {/* Action Bar */}
          <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] pt-4">
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="h-11 rounded-[10px] bg-[#D93829] px-6 text-xs font-semibold text-white shadow-sm hover:bg-[#B8281B]"
            >
              {updateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              <span>Simpan Perubahan</span>
            </Button>
          </div>

          {/* Section E: Zona Bahaya (Danger Zone) */}
          <section className="rounded-[14px] border-2 border-red-300 bg-gradient-to-b from-red-50/95 via-red-50/50 to-red-100/30 p-6 shadow-[0_4px_24px_rgba(220,38,38,0.10)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-red-200/90 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white shadow-md shadow-red-600/30 ring-4 ring-red-100">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-red-700 tracking-tight">
                      Zona Bahaya (Danger Zone)
                    </h2>
                    <span className="inline-flex items-center rounded-full border border-red-300 bg-red-100 px-2.5 py-0.5 text-[10px] font-bold text-red-800 uppercase tracking-wider">
                      Tindakan Kritis
                    </span>
                  </div>
                  <p className="text-xs text-red-900/75 mt-0.5">
                    Tindakan destruktif permanen untuk membersihkan data pemilihan dan mengembalikan status ke Draft.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {/* Warning jika status masih open/aktif */}
              {isElectionActive && (
                <div className="flex items-start gap-3 rounded-[10px] border-2 border-red-300 bg-red-100/80 p-4 text-xs text-red-950 shadow-sm">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-red-900">
                      Pemilihan Sedang Berlangsung (Status: Open)
                    </p>
                    <p className="text-[11px] leading-relaxed text-red-800">
                      Tombol reset pemilihan dikunci demi keamanan bilik suara aktif. Silakan ubah status pemilihan menjadi <strong>Closed</strong> atau <strong>Draft</strong> pada bagian Jadwal &amp; Status di atas terlebih dahulu untuk dapat mereset data.
                    </p>
                  </div>
                </div>
              )}

              {/* Warning jika bukan super_admin */}
              {role && role !== "super_admin" && (
                <div className="flex items-start gap-3 rounded-[10px] border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                  <p className="text-[11px] leading-relaxed text-red-700">
                    Hanya akun dengan hak akses <strong>Super Admin</strong> yang memiliki wewenang untuk mereset data pemilihan.
                  </p>
                </div>
              )}

              <div className="relative overflow-hidden flex flex-col justify-between gap-4 rounded-[12px] border-2 border-red-200 bg-white/95 p-5 shadow-sm sm:flex-row sm:items-center">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-600" />
                <div className="space-y-1.5 pl-2 sm:pl-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                    <h3 className="text-sm font-bold text-red-950">
                      Bersihkan &amp; Reset Data Pemilihan
                    </h3>
                  </div>
                  <p className="max-w-xl text-xs text-red-950/75 leading-relaxed">
                    Mengosongkan seluruh surat suara yang telah masuk (votes), sesi pemilih aktif, dan data DPT secara permanen. Opsi untuk membersihkan rombel, jurusan, dan kandidat tersedia pada dialog konfirmasi.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setIsResetDialogOpen(true)}
                  disabled={isElectionActive || !data?.election?.id || (role !== undefined && role !== "super_admin")}
                  className="h-11 shrink-0 rounded-[10px] bg-red-600 px-5 text-xs font-bold text-white shadow-md shadow-red-600/25 hover:bg-red-700 active:scale-[0.99] transition-all disabled:bg-red-200 disabled:text-red-400 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span>Reset Data Pemilihan</span>
                </Button>
              </div>
            </div>
          </section>
        </form>
      )}

      {/* Dialog Konfirmasi Reset Pemilihan */}
      {data?.election && (
        <ElectionResetDialog
          open={isResetDialogOpen}
          onOpenChange={setIsResetDialogOpen}
          electionId={data.election.id}
          electionName={data.election.shortName}
          onSuccess={() => void refetch()}
        />
      )}

      {/* Dialog Konfirmasi Kritis: Perubahan Jadwal Saat Status Open */}
      <AlertDialog
        open={isScheduleConfirmOpen}
        onOpenChange={setIsScheduleConfirmOpen}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-2">
              <ShieldAlert className="h-6 w-6" aria-hidden="true" />
            </div>
            <AlertDialogTitle className="text-base font-bold text-[#0F172A]">
              Konfirmasi Penyesuaian Jadwal Hari Pemilihan
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed text-[#475569]">
              Pemilihan saat ini sedang{" "}
              <strong className="text-[#0F172A]">
                BERLANGSUNG (Status: Open)
              </strong>
              . Perubahan jam mulai atau selesai akan langsung memengaruhi akses bilik suara pemilih secara waktu nyata.
              <br />
              <br />
              Tindakan ini akan dicatat secara permanen pada Audit Trail panitia. Pastikan penyesuaian jam sudah sesuai dengan kesepakatan panitia pengawas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel
              disabled={updateMutation.isPending}
              onClick={() => setIsScheduleConfirmOpen(false)}
            >
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={updateMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                executeSave();
              }}
              className="bg-[#D93829] text-white hover:bg-[#B91C1C]"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                "Lanjutkan & Terapkan Jadwal"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
