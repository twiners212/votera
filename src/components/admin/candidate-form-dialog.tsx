"use client";

import * as React from "react";
import Image from "next/image";
import {
  Controller,
  useFieldArray,
  useForm,
  type Control,
  type FieldErrors,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateCandidate,
  useUpdateCandidate,
  type CandidateFormInput,
} from "@/hooks/use-candidates";
import { cn } from "@/lib/utils";
import type { ApiResponse, CandidateDTO, CandidateTheme } from "@/types/votera";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const THEME_OPTIONS: Array<{
  value: CandidateTheme;
  label: string;
  swatchClass: string;
}> = [
  { value: "red", label: "Merah Terakota", swatchClass: "bg-[#C84B31]" },
  { value: "green", label: "Hijau Emerald", swatchClass: "bg-[#2F6F5E]" },
  { value: "blue", label: "Biru Kobalt", swatchClass: "bg-[#2E6F9E]" },
  { value: "amber", label: "Kuning Amber", swatchClass: "bg-[#B45309]" },
];

const candidateFormSchema = z.object({
  candidateNumber: z.coerce
    .number({ invalid_type_error: "Nomor urut wajib berupa angka" })
    .int("Nomor urut harus bilangan bulat")
    .min(1, "Nomor urut minimal 1")
    .max(99, "Nomor urut maksimal 99"),
  name: z
    .string()
    .trim()
    .min(2, "Nama kandidat minimal 2 karakter")
    .max(120, "Nama kandidat maksimal 120 karakter"),
  classOrUnit: z
    .string()
    .trim()
    .min(1, "Kelas atau unit wajib diisi")
    .max(60, "Kelas atau unit maksimal 60 karakter"),
  motto: z
    .string()
    .trim()
    .min(3, "Motto kampanye minimal 3 karakter")
    .max(200, "Motto maksimal 200 karakter"),
  vision: z.string().trim().min(10, "Visi minimal 10 karakter"),
  missions: z
    .array(
      z.object({
        value: z.string().trim().min(1, "Poin misi tidak boleh kosong"),
      })
    )
    .min(1, "Minimal 1 misi wajib diisi"),
  programs: z.array(
    z.object({
      value: z.string(),
    })
  ),
  supporters: z.array(
    z.object({
      value: z.string(),
    })
  ),
  photoUrl: z.string().trim().nullable().optional(),
  themeColor: z.enum(["red", "green", "blue", "amber"]),
  isActive: z.boolean(),
});

type CandidateFormValues = z.infer<typeof candidateFormSchema>;

function getFallbackPortrait(candidateNumber: number): string {
  const safeNum = Number.isFinite(candidateNumber) && candidateNumber > 0 ? candidateNumber : 1;
  return `/images/candidate-${((safeNum - 1) % 4) + 1}.jpg`;
}

function toFieldItems(items: string[] | undefined, ensureOne = false) {
  const cleaned = (items ?? []).map((value) => ({ value }));
  if (cleaned.length === 0 && ensureOne) {
    return [{ value: "" }];
  }
  return cleaned;
}

function getDefaultValues(
  candidate: CandidateDTO | null,
  nextCandidateNumber: number
): CandidateFormValues {
  if (!candidate) {
    return {
      candidateNumber: nextCandidateNumber,
      name: "",
      classOrUnit: "",
      motto: "",
      vision: "",
      missions: [{ value: "" }],
      programs: [{ value: "" }],
      supporters: [{ value: "" }],
      photoUrl: null,
      themeColor: "red",
      isActive: true,
    };
  }

  return {
    candidateNumber: candidate.candidateNumber,
    name: candidate.name,
    classOrUnit: candidate.classOrUnit,
    motto: candidate.motto,
    vision: candidate.vision,
    missions: toFieldItems(candidate.missions, true),
    programs: toFieldItems(candidate.programs, false),
    supporters: toFieldItems(candidate.supporters, false),
    photoUrl: candidate.photoUrl ?? null,
    themeColor: candidate.themeColor,
    isActive: candidate.isActive,
  };
}

interface DynamicStringListFieldProps {
  control: Control<CandidateFormValues>;
  errors: FieldErrors<CandidateFormValues>;
  name: "missions" | "programs" | "supporters";
  label: string;
  placeholder: string;
  addLabel: string;
  requiredFirst?: boolean;
}

function DynamicStringListField({
  control,
  errors,
  name,
  label,
  placeholder,
  addLabel,
  requiredFirst = false,
}: DynamicStringListFieldProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });

  const fieldError = errors[name];
  const rootErrorMessage =
    fieldError && !Array.isArray(fieldError) && "message" in fieldError
      ? fieldError.message
      : undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[13px] font-semibold text-[#0F172A]">
          {label}
          {requiredFirst && <span className="ml-0.5 text-[#DC2626]">*</span>}
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ value: "" })}
          className="h-7 px-2.5 text-xs"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{addLabel}</span>
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2.5 text-xs text-[#64748B]">
          Belum ada item ditambahkan. Klik &ldquo;{addLabel}&rdquo; untuk
          menambahkan.
        </p>
      ) : (
        <div className="space-y-2">
          {fields.map((field, index) => {
            const itemError = Array.isArray(fieldError)
              ? fieldError[index]?.value?.message
              : undefined;
            const disableRemove = requiredFirst && fields.length <= 1;

            return (
              <div key={field.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-right text-xs font-semibold text-[#94A3B8] tabular-nums">
                    {index + 1}.
                  </span>
                  <Controller
                    control={control}
                    name={`${name}.${index}.value`}
                    render={({ field: inputField }) => (
                      <Input
                        {...inputField}
                        placeholder={placeholder}
                        aria-invalid={Boolean(itemError)}
                        className={cn(
                          itemError &&
                            "border-[#DC2626] bg-[#FEF2F2] focus-visible:border-[#DC2626] focus-visible:ring-[#DC2626]/20"
                        )}
                      />
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disableRemove}
                    onClick={() => remove(index)}
                    aria-label={`Hapus ${label.toLowerCase()} nomor ${index + 1}`}
                    className="h-10 w-10 shrink-0 text-[#64748B] hover:bg-[#FEE2E2] hover:text-[#DC2626] disabled:opacity-35"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
                {itemError && (
                  <p className="pl-7 text-xs font-medium text-[#DC2626]">
                    {itemError}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {rootErrorMessage && (
        <p className="text-xs font-medium text-[#DC2626]">
          {rootErrorMessage}
        </p>
      )}
    </div>
  );
}

export interface CandidateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: CandidateDTO | null;
  nextCandidateNumber?: number;
  electionId?: string;
}

export function CandidateFormDialog({
  open,
  onOpenChange,
  candidate,
  nextCandidateNumber = 1,
  electionId = "active",
}: CandidateFormDialogProps) {
  const isEditMode = Boolean(candidate);
  const createCandidate = useCreateCandidate(electionId);
  const updateCandidate = useUpdateCandidate(electionId);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = React.useState<string | null>(
    null
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CandidateFormValues>({
    resolver: zodResolver(candidateFormSchema),
    defaultValues: getDefaultValues(candidate, nextCandidateNumber),
  });

  React.useEffect(() => {
    if (open) {
      reset(getDefaultValues(candidate, nextCandidateNumber));
      setUploadError(null);
      setSubmitError(null);
      setLocalPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
  }, [open, candidate, nextCandidateNumber, reset]);

  React.useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  const watchedPhotoUrl = watch("photoUrl");
  const watchedNumber = watch("candidateNumber");
  const isSubmitting = createCandidate.isPending || updateCandidate.isPending;

  const previewSrc =
    localPreviewUrl ||
    (watchedPhotoUrl && watchedPhotoUrl.trim().length > 0
      ? watchedPhotoUrl
      : getFallbackPortrait(Number(watchedNumber) || 1));

  const hasCustomPhoto = Boolean(localPreviewUrl || watchedPhotoUrl);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadError(null);

    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
      const msg = "Format foto harus JPG, PNG, atau WebP.";
      setUploadError(msg);
      toast.error(msg);
      return;
    }

    if (file.size > MAX_PHOTO_BYTES) {
      const msg = "Ukuran file melebihi batas maksimal 2MB.";
      setUploadError(msg);
      toast.error(msg);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setLocalPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return objectUrl;
    });

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const json = (await res.json().catch(() => null)) as
        | (ApiResponse<{ url: string }> & { url?: string })
        | { url?: string }
        | null;

      let uploadedUrl: string | undefined;
      if (json && "success" in json) {
        if (!res.ok || !json.success) {
          throw new Error(
            !json.success ? json.error.message : "Gagal mengunggah foto"
          );
        }
        uploadedUrl = json.data?.url ?? json.url;
      } else if (res.ok && json && "url" in json && typeof json.url === "string") {
        uploadedUrl = json.url;
      }

      if (!res.ok || !uploadedUrl) {
        throw new Error("Gagal mengunggah foto kandidat");
      }

      setValue("photoUrl", uploadedUrl, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setLocalPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      toast.success("Foto kandidat berhasil diunggah");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal mengunggah foto kandidat";
      setUploadError(message);
      setLocalPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  }

  function handleRemovePhoto() {
    setUploadError(null);
    setLocalPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setValue("photoUrl", null, { shouldDirty: true, shouldValidate: true });
  }

  async function onSubmit(values: CandidateFormValues) {
    if (isUploading || isSubmitting) return;
    setSubmitError(null);

    const payload: CandidateFormInput = {
      candidateNumber: values.candidateNumber,
      name: values.name.trim(),
      classOrUnit: values.classOrUnit.trim(),
      motto: values.motto.trim(),
      vision: values.vision.trim(),
      missions: values.missions.map((m) => m.value.trim()).filter(Boolean),
      programs: values.programs.map((p) => p.value.trim()).filter(Boolean),
      supporters: values.supporters.map((s) => s.value.trim()).filter(Boolean),
      photoUrl: values.photoUrl?.trim() ? values.photoUrl.trim() : null,
      themeColor: values.themeColor,
      isActive: values.isActive,
    };

    try {
      if (candidate) {
        await updateCandidate.mutateAsync({ id: candidate.id, ...payload });
        toast.success(`Data kandidat #${payload.candidateNumber} diperbarui`);
      } else {
        await createCandidate.mutateAsync(payload);
        toast.success(`Kandidat #${payload.candidateNumber} berhasil ditambahkan`);
      }
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menyimpan data kandidat";
      setSubmitError(message);
      toast.error(message);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting && !isUploading) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Data Kandidat" : "Tambah Kandidat Baru"}
          </DialogTitle>
          <DialogDescription>
            Lengkapi profil, visi-misi, program kerja, dan foto resmi kandidat
            yang akan tampil pada surat suara pemilih.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {submitError && (
            <div
              role="alert"
              className="rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#DC2626]"
            >
              {submitError}
            </div>
          )}

          {/* Foto Kandidat (4:5 Preview + Upload) */}
          <div className="flex flex-col gap-4 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] p-4 sm:flex-row sm:items-center">
            <div className="relative aspect-[4/5] w-[104px] shrink-0 overflow-hidden rounded-[12px] border border-[#E2E8F0] bg-white">
              <Image
                src={previewSrc}
                alt="Pratinjau foto kandidat"
                fill
                sizes="104px"
                className="object-cover"
                unoptimized
              />
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/45 text-white">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2">
              <div>
                <p className="text-[13px] font-semibold text-[#0F172A]">
                  Foto Kandidat
                </p>
                <p className="text-xs text-[#64748B]">
                  Format JPG, PNG, atau WebP dengan ukuran maksimal 2MB. Jika
                  tidak diunggah, foto placeholder bawaan akan digunakan.
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploading || isSubmitting}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{isUploading ? "Mengunggah..." : "Pilih Foto"}</span>
                </Button>

                {hasCustomPhoto && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isUploading || isSubmitting}
                    onClick={handleRemovePhoto}
                    className="h-8 px-2.5 text-xs text-[#64748B] hover:text-[#DC2626]"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Gunakan default</span>
                  </Button>
                )}
              </div>

              {uploadError && (
                <p className="text-xs font-medium text-[#DC2626]">
                  {uploadError}
                </p>
              )}
            </div>
          </div>

          {/* Identitas Dasar */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-1">
              <label
                htmlFor="candidateNumber"
                className="text-[13px] font-semibold text-[#0F172A]"
              >
                Nomor Urut<span className="ml-0.5 text-[#DC2626]">*</span>
              </label>
              <Input
                id="candidateNumber"
                type="number"
                min={1}
                max={99}
                className={cn(
                  "tabular-nums",
                  errors.candidateNumber &&
                    "border-[#DC2626] bg-[#FEF2F2] focus-visible:border-[#DC2626]"
                )}
                {...register("candidateNumber", { valueAsNumber: true })}
              />
              {errors.candidateNumber && (
                <p className="text-xs font-medium text-[#DC2626]">
                  {errors.candidateNumber.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-3">
              <label
                htmlFor="candidateName"
                className="text-[13px] font-semibold text-[#0F172A]"
              >
                Nama Lengkap<span className="ml-0.5 text-[#DC2626]">*</span>
              </label>
              <Input
                id="candidateName"
                placeholder="Contoh: Raka Aditya Pratama"
                className={cn(
                  errors.name &&
                    "border-[#DC2626] bg-[#FEF2F2] focus-visible:border-[#DC2626]"
                )}
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs font-medium text-[#DC2626]">
                  {errors.name.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="classOrUnit"
                className="text-[13px] font-semibold text-[#0F172A]"
              >
                Kelas / Unit<span className="ml-0.5 text-[#DC2626]">*</span>
              </label>
              <Input
                id="classOrUnit"
                placeholder="Contoh: XI IPA"
                className={cn(
                  errors.classOrUnit &&
                    "border-[#DC2626] bg-[#FEF2F2] focus-visible:border-[#DC2626]"
                )}
                {...register("classOrUnit")}
              />
              {errors.classOrUnit && (
                <p className="text-xs font-medium text-[#DC2626]">
                  {errors.classOrUnit.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="motto"
                className="text-[13px] font-semibold text-[#0F172A]"
              >
                Motto Kampanye<span className="ml-0.5 text-[#DC2626]">*</span>
              </label>
              <Input
                id="motto"
                placeholder="Contoh: Bersama Bergerak, Bersama Bersinar"
                className={cn(
                  errors.motto &&
                    "border-[#DC2626] bg-[#FEF2F2] focus-visible:border-[#DC2626]"
                )}
                {...register("motto")}
              />
              {errors.motto && (
                <p className="text-xs font-medium text-[#DC2626]">
                  {errors.motto.message}
                </p>
              )}
            </div>
          </div>

          {/* Tema Warna & Status */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#0F172A]">
                Tema Warna Aksen
              </label>
              <Controller
                control={control}
                name="themeColor"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label="Pilih tema warna kandidat">
                      <SelectValue placeholder="Pilih warna aksen" />
                    </SelectTrigger>
                    <SelectContent>
                      {THEME_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <span className="flex items-center gap-2">
                            <span
                              aria-hidden="true"
                              className={cn(
                                "inline-block h-2.5 w-2.5 rounded-full",
                                option.swatchClass
                              )}
                            />
                            <span>{option.label}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#0F172A]">
                Status Keaktifan
              </label>
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <Select
                    value={field.value ? "active" : "inactive"}
                    onValueChange={(val) => field.onChange(val === "active")}
                  >
                    <SelectTrigger aria-label="Pilih status keaktifan">
                      <SelectValue placeholder="Pilih status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">
                        Aktif (Tampil di surat suara)
                      </SelectItem>
                      <SelectItem value="inactive">
                        Nonaktif (Disembunyikan)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Visi */}
          <div className="space-y-1.5">
            <label
              htmlFor="vision"
              className="text-[13px] font-semibold text-[#0F172A]"
            >
              Visi<span className="ml-0.5 text-[#DC2626]">*</span>
            </label>
            <textarea
              id="vision"
              rows={3}
              placeholder="Tuliskan visi utama kandidat..."
              className={cn(
                "flex w-full rounded-[10px] border border-[#CBD5E1] bg-white px-3.5 py-2.5 text-sm text-[#0F172A] shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors placeholder:text-[#94A3B8] focus-visible:border-[#D93829] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]/20",
                errors.vision &&
                  "border-[#DC2626] bg-[#FEF2F2] focus-visible:border-[#DC2626] focus-visible:ring-[#DC2626]/20"
              )}
              {...register("vision")}
            />
            {errors.vision && (
              <p className="text-xs font-medium text-[#DC2626]">
                {errors.vision.message}
              </p>
            )}
          </div>

          {/* Dynamic Lists: Misi, Program Kerja, Pendukung */}
          <DynamicStringListField
            control={control}
            errors={errors}
            name="missions"
            label="Misi"
            placeholder="Contoh: Meningkatkan partisipasi aktif siswa..."
            addLabel="Tambah misi"
            requiredFirst
          />

          <DynamicStringListField
            control={control}
            errors={errors}
            name="programs"
            label="Program Kerja"
            placeholder="Contoh: Pekan Kreasi & Seni Pelajar"
            addLabel="Tambah program"
          />

          <DynamicStringListField
            control={control}
            errors={errors}
            name="supporters"
            label="Pendukung / Pengusung"
            placeholder="Contoh: Paskibra SMA Bojong Gede"
            addLabel="Tambah pendukung"
          />

          <DialogFooter className="border-t border-[#F1F5F9] pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting || isUploading}
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting || isUploading}>
              {isSubmitting && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              <span>
                {isEditMode ? "Simpan Perubahan" : "Simpan Kandidat"}
              </span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
