"use client";

import * as React from "react";
import Image from "next/image";
import Cropper, { type Point } from "react-easy-crop";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Crop,
  FileImage,
  Link as LinkIcon,
  Loader2,
  RotateCcw,
  RotateCw,
  Trash2,
  Upload,
  ZoomIn,
} from "lucide-react";
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
import { useAdminUpload } from "@/hooks/use-candidates";
import {
  cropAndCompressImage,
  type PixelCrop,
} from "@/lib/media/crop-image";
import {
  formatFileSize,
  MAX_RAW_PHOTO_BYTES,
} from "@/lib/media/image-compressor";
import { cn } from "@/lib/utils";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface ImageUploadCropperFieldProps {
  id: string;
  label: string;
  description?: string;
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  aspectRatio: number; // e.g. 1 (1:1), 16/9, 4/5
  aspectLabel?: string; // e.g. "1:1", "16:9", "4:5"
  previewAspectClassName?: string; // e.g. "aspect-square w-24 sm:w-28", "aspect-video w-48 sm:w-64", "aspect-[4/5] w-[104px]"
  previewObjectFit?: "cover" | "contain";
  targetMaxWidth?: number;
  targetMaxHeight?: number;
  preferredMimeType?: "image/webp" | "image/jpeg";
  fallbackSrc?: string;
  placeholderUrl?: string;
  electionId?: string;
  disabled?: boolean;
  required?: boolean;
  allowManualUrl?: boolean;
}

interface CompressionStats {
  originalBytes: number;
  compressedBytes: number;
}

export function ImageUploadCropperField({
  id,
  label,
  description,
  value,
  onChange,
  aspectRatio,
  aspectLabel = "Bebas",
  previewAspectClassName = "aspect-square w-24 sm:w-28",
  previewObjectFit = "cover",
  targetMaxWidth = 1200,
  targetMaxHeight = 1200,
  preferredMimeType = "image/webp",
  fallbackSrc,
  placeholderUrl = "https://... atau /uploads/...",
  electionId = "active",
  disabled = false,
  required = false,
  allowManualUrl = true,
}: ImageUploadCropperFieldProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const uploadMutation = useAdminUpload(electionId);

  // Cropper states
  const [isCropperOpen, setIsCropperOpen] = React.useState(false);
  const [rawImageSrc, setRawImageSrc] = React.useState<string | null>(null);
  const [rawFile, setRawFile] = React.useState<File | null>(null);
  const [crop, setCrop] = React.useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<PixelCrop | null>(null);

  // Processing & UI states
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [compressionStats, setCompressionStats] = React.useState<CompressionStats | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  // Manual URL accordion states
  const [isUrlAccordionOpen, setIsUrlAccordionOpen] = React.useState(false);
  const [manualUrlInput, setManualUrlInput] = React.useState(value || "");

  // Sinkronisasi manualUrlInput jika value luar berubah
  React.useEffect(() => {
    setManualUrlInput(value || "");
  }, [value]);

  // Bersihkan object URL saat unmount
  React.useEffect(() => {
    return () => {
      if (rawImageSrc) {
        URL.revokeObjectURL(rawImageSrc);
      }
    };
  }, [rawImageSrc]);

  const hasImage = Boolean(value && value.trim().length > 0);
  const currentPreviewSrc = hasImage ? (value as string) : fallbackSrc || "";

  function handleFileSelected(file?: File) {
    if (!file || disabled) return;
    setErrorMessage(null);

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      const msg = "Format berkas harus JPG, PNG, atau WebP.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (file.size > MAX_RAW_PHOTO_BYTES) {
      const msg = `Ukuran berkas terlalu besar (${formatFileSize(file.size)}). Maksimal 10MB.`;
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    // Revoke URL lama jika ada
    if (rawImageSrc) {
      URL.revokeObjectURL(rawImageSrc);
    }

    const objectUrl = URL.createObjectURL(file);
    setRawImageSrc(objectUrl);
    setRawFile(file);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setCroppedAreaPixels(null);
    setIsCropperOpen(true);
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    handleFileSelected(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    handleFileSelected(file);
  }

  function handleResetCropper() {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  }

  function handleRotate90() {
    setRotation((prev) => (prev + 90) % 360);
  }

  async function handleApplyCrop() {
    if (!rawImageSrc || !croppedAreaPixels || isProcessing) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // 1. Potong kanvas dan kompresi di browser via HTML5 Canvas
      const compressionResult = await cropAndCompressImage(
        rawImageSrc,
        croppedAreaPixels,
        rotation,
        rawFile?.size || 0,
        {
          maxWidth: targetMaxWidth,
          maxHeight: targetMaxHeight,
          preferredMimeType,
          fileName: rawFile?.name || "image",
        }
      );

      // 2. Unggah file terkompresi ke endpoint /api/admin/upload
      const uploadResult = await uploadMutation.mutateAsync(compressionResult.file);

      // 3. Simpan URL ke state
      onChange(uploadResult.url);
      setManualUrlInput(uploadResult.url);

      // 4. Rekam statistik kompresi
      setCompressionStats({
        originalBytes: compressionResult.originalBytes,
        compressedBytes: compressionResult.compressedBytes,
      });

      setIsCropperOpen(false);

      const savingsPct =
        compressionResult.originalBytes > 0
          ? Math.round(
              (1 - compressionResult.compressedBytes / compressionResult.originalBytes) * 100
            )
          : 0;

      const successMsg =
        savingsPct > 0
          ? `${label} berhasil diunggah (${formatFileSize(compressionResult.compressedBytes)}, hemat ${savingsPct}%)`
          : `${label} berhasil diunggah`;

      toast.success(successMsg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Gagal mengunggah ${label.toLowerCase()}`;
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  }

  function handleRemoveImage() {
    setErrorMessage(null);
    setCompressionStats(null);
    setManualUrlInput("");
    onChange(null);
    toast.info(`${label} dihapus / direset ke bawaan.`);
  }

  function handleApplyManualUrl() {
    const trimmed = manualUrlInput.trim();
    setErrorMessage(null);
    setCompressionStats(null);
    if (!trimmed) {
      onChange(null);
      toast.info(`${label} dikosongkan.`);
    } else {
      onChange(trimmed);
      toast.success(`URL ${label.toLowerCase()} diterapkan.`);
    }
  }

  const isUploading = isProcessing || uploadMutation.isPending;

  return (
    <div className="space-y-3">
      {/* Header Label */}
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="text-xs font-semibold text-[#334155]"
        >
          {label}
          {required && <span className="ml-0.5 text-[#DC2626]">*</span>}
        </label>
        <span className="rounded bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-medium text-[#64748B]">
          Rasio {aspectLabel}
        </span>
      </div>

      {description && (
        <p className="text-xs text-[#64748B] -mt-1">{description}</p>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2 text-xs font-medium text-[#DC2626]"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled || isUploading}
      />

      {/* Pratinjau Gambar Aktif atau Dropzone */}
      {hasImage || currentPreviewSrc ? (
        <div className="flex flex-col gap-4 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] p-4 sm:flex-row sm:items-center">
          {/* Thumbnail Preview */}
          <div
            className={cn(
              "relative shrink-0 overflow-hidden rounded-[10px] border border-[#CBD5E1] bg-white shadow-sm",
              previewAspectClassName
            )}
          >
            {currentPreviewSrc ? (
              <Image
                src={currentPreviewSrc}
                alt={`Pratinjau ${label}`}
                fill
                sizes="192px"
                className={cn(
                  previewObjectFit === "contain"
                    ? "object-contain p-1.5"
                    : "object-cover"
                )}
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#F1F5F9] text-[#94A3B8]">
                <FileImage className="h-8 w-8" aria-hidden="true" />
              </div>
            )}

            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 text-white">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              </div>
            )}
          </div>

          {/* Action & Info Area */}
          <div className="flex-1 space-y-2.5">
            <div className="space-y-1">
              <p className="text-xs font-bold text-[#0F172A] break-all font-mono">
                {hasImage ? (
                  value?.startsWith("/uploads/") ? (
                    value.split("/").pop()
                  ) : (
                    value
                  )
                ) : (
                  <span className="font-sans font-medium text-[#64748B]">
                    Menggunakan gambar bawaan sistem
                  </span>
                )}
              </p>

              {compressionStats && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200 tabular-nums">
                  <Check className="h-3 w-3 shrink-0 text-emerald-600" />
                  <span>
                    Terkompresi: {formatFileSize(compressionStats.compressedBytes)}{" "}
                    (hemat{" "}
                    {Math.round(
                      (1 -
                        compressionStats.compressedBytes /
                          compressionStats.originalBytes) *
                        100
                    )}
                    %)
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="h-8 rounded-[8px] border-[#CBD5E1] px-2.5 text-xs font-semibold text-[#0F172A] hover:bg-white"
              >
                {isUploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>Ganti Berkas</span>
              </Button>

              {rawImageSrc && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled || isUploading}
                  onClick={() => setIsCropperOpen(true)}
                  className="h-8 rounded-[8px] border-[#CBD5E1] px-2.5 text-xs font-semibold text-[#0F172A] hover:bg-white"
                >
                  <Crop className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Edit Crop</span>
                </Button>
              )}

              {hasImage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled || isUploading}
                  onClick={handleRemoveImage}
                  className="h-8 rounded-[8px] px-2.5 text-xs font-semibold text-[#DC2626] hover:bg-[#FEF2F2] hover:text-[#B91C1C]"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Hapus / Reset</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Dropzone jika belum ada gambar */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => {
            if (!disabled && !isUploading) {
              fileInputRef.current?.click();
            }
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-[12px] border-2 border-dashed p-6 text-center cursor-pointer transition-colors",
            isDragging
              ? "border-[#D93829] bg-[#FEF2F2]"
              : "border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#94A3B8] hover:bg-[#F1F5F9]",
            disabled && "cursor-not-allowed opacity-60"
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-xs text-[#64748B]">
            <Upload className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#0F172A]">
              Klik atau seret berkas {label.toLowerCase()} ke sini
            </p>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              JPG, PNG, atau WebP (maksimal 10MB, auto-crop rasio {aspectLabel})
            </p>
          </div>
        </div>
      )}

      {/* Accordion Mode URL Manual */}
      {allowManualUrl && (
        <div className="rounded-[10px] border border-[#E2E8F0] bg-white">
          <button
            type="button"
            onClick={() => setIsUrlAccordionOpen(!isUrlAccordionOpen)}
            className="flex w-full items-center justify-between px-3.5 py-2 text-left text-xs font-semibold text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Atau masukkan URL manual
            </span>
            {isUrlAccordionOpen ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          {isUrlAccordionOpen && (
            <div className="border-t border-[#F1F5F9] p-3.5 space-y-2 bg-[#F8FAFC]/50">
              <div className="flex gap-2">
                <Input
                  value={manualUrlInput}
                  onChange={(e) => setManualUrlInput(e.target.value)}
                  placeholder={placeholderUrl}
                  disabled={disabled || isUploading}
                  className="h-9 rounded-[8px] border-[#CBD5E1] text-xs font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleApplyManualUrl}
                  disabled={disabled || isUploading}
                  className="h-9 shrink-0 rounded-[8px] border-[#CBD5E1] px-3 text-xs font-semibold hover:bg-white"
                >
                  Terapkan
                </Button>
              </div>
              <p className="text-[11px] text-[#94A3B8]">
                Gunakan opsi ini jika berkas gambar sudah ter-host di server CDN eksternal atau direktori publik lokal.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal Image Cropper Dialog */}
      <Dialog
        open={isCropperOpen}
        onOpenChange={(open) => {
          if (!isProcessing && !open) {
            setIsCropperOpen(false);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#0F172A] flex items-center gap-2">
              <Crop className="h-5 w-5 text-[#D93829]" />
              <span>Sesuaikan & Potong {label}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Geser gambar untuk menentukan posisi, atur perbesaran slider, dan putar jika diperlukan. (Format target: Rasio {aspectLabel}).
            </DialogDescription>
          </DialogHeader>

          {/* Canvas Cropper Area */}
          <div className="relative mt-2 h-[320px] sm:h-[380px] w-full overflow-hidden rounded-[12px] bg-slate-900 shadow-inner">
            {rawImageSrc && (
              <Cropper
                image={rawImageSrc}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={aspectRatio}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
                onCropComplete={(_croppedArea, croppedAreaPixels) => {
                  setCroppedAreaPixels(croppedAreaPixels);
                }}
              />
            )}
          </div>

          {/* Kontrol Zoom, Rotasi, & Reset */}
          <div className="mt-4 flex flex-col gap-3 rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] p-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Slider Zoom */}
            <div className="flex flex-1 items-center gap-2.5">
              <ZoomIn className="h-4 w-4 shrink-0 text-[#64748B]" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                aria-label="Tingkat pembesaran (zoom)"
                className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-[#E2E8F0] accent-[#D93829]"
              />
              <span className="w-10 text-right text-xs font-semibold text-[#334155] tabular-nums">
                {zoom.toFixed(1)}x
              </span>
            </div>

            {/* Rotasi 90 & Reset */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRotate90}
                className="h-8 gap-1 rounded-[8px] border-[#CBD5E1] px-2.5 text-xs font-semibold text-[#0F172A] hover:bg-white"
              >
                <RotateCw className="h-3.5 w-3.5 text-[#64748B]" />
                <span>Putar 90°</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetCropper}
                className="h-8 gap-1 rounded-[8px] px-2 text-xs font-semibold text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#0F172A]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset</span>
              </Button>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={isProcessing}
              onClick={() => setIsCropperOpen(false)}
              className="h-9 rounded-[10px] border-[#CBD5E1] text-xs font-semibold"
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={isProcessing}
              onClick={handleApplyCrop}
              className="h-9 gap-1.5 rounded-[10px] bg-[#D93829] text-xs font-semibold text-white hover:bg-[#B91C1C]"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Mengompresi & Mengunggah...</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Terapkan & Unggah</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
