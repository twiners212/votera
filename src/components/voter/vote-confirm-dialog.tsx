"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { CandidateDTO } from "@/types/votera";

export interface VoteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: CandidateDTO | null;
}

function getFallbackCandidatePhoto(candidateNumber: number): string {
  const index = ((Math.max(1, candidateNumber) - 1) % 4) + 1;
  return `/images/candidate-${index}.jpg`;
}

export function VoteConfirmDialog({
  open,
  onOpenChange,
  candidate,
}: VoteConfirmDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const fallbackPhoto = candidate
    ? getFallbackCandidatePhoto(candidate.candidateNumber)
    : "/images/candidate-1.jpg";
  const [imgSrc, setImgSrc] = React.useState<string>(
    candidate?.photoUrl?.trim() || fallbackPhoto
  );

  React.useEffect(() => {
    setImgSrc(candidate?.photoUrl?.trim() || fallbackPhoto);
    setErrorMessage(null);
  }, [candidate?.id, candidate?.photoUrl, fallbackPhoto, open]);

  if (!candidate) {
    return null;
  }

  async function handleConfirmVote() {
    if (!candidate || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/voter/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: candidate.id }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            success: true;
            data?: { votedAt?: string; redirectTo?: string };
          }
        | {
            success: false;
            error?: { code?: string; message?: string };
          }
        | null;

      if (!response.ok || !payload || !payload.success) {
        const msg =
          (payload && !payload.success && payload.error?.message) ||
          "Gagal mengirim suara. Silakan coba beberapa saat lagi.";
        setErrorMessage(msg);
        toast.error(msg);
        setIsSubmitting(false);
        return;
      }

      const target = payload.data?.redirectTo || "/vote/thanks";
      onOpenChange(false);
      router.push(target);
      router.refresh();
    } catch {
      const msg =
        "Terjadi gangguan jaringan saat mengirim suara. Periksa koneksi kamu dan coba lagi.";
      setErrorMessage(msg);
      toast.error(msg);
      setIsSubmitting(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <AlertDialogContent className="max-w-[440px] rounded-[20px] p-6">
        <AlertDialogHeader className="space-y-2 text-left">
          <span className="inline-flex w-fit items-center rounded-full bg-[#FFF0EE] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#D93829]">
            KONFIRMASI PILIHAN
          </span>
          <AlertDialogTitle className="text-xl font-extrabold tracking-tight text-[#0F172A] tabular-nums">
            Kirim suara untuk Kandidat #{candidate.candidateNumber}?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-[#64748B]">
            Pastikan pilihan kamu sudah sesuai sebelum dikirim ke kotak suara
            digital.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Candidate Summary Card */}
        <div className="flex items-center gap-3.5 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
          <div className="relative aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white">
            <Image
              src={imgSrc}
              alt={`Foto ${candidate.name}`}
              fill
              sizes="64px"
              className="object-cover object-top"
              unoptimized
              onError={() => {
                if (imgSrc !== fallbackPhoto) {
                  setImgSrc(fallbackPhoto);
                }
              }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center rounded-md bg-[#D93829] px-2 py-0.5 text-[11px] font-extrabold text-white tabular-nums">
                #{candidate.candidateNumber}
              </span>
              <span className="text-xs font-semibold text-[#64748B]">
                {candidate.classOrUnit}
              </span>
            </div>
            <p className="mt-1 truncate text-base font-bold text-[#0F172A]">
              {candidate.name}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs text-[#64748B]">
              {candidate.motto}
            </p>
          </div>
        </div>

        {/* Irreversible Warning */}
        <div className="flex items-start gap-2.5 rounded-[12px] border border-[#FDE68A] bg-[#FEF3C7]/60 px-3.5 py-3 text-xs leading-relaxed text-[#92400E]">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-[#D97706]"
            aria-hidden="true"
          />
          <p>
            <span className="font-bold">
              Pilihan tidak bisa diubah setelah dikirim.
            </span>{" "}
            Suara kamu dicatat secara rahasia dan hanya dapat digunakan satu
            kali.
          </p>
        </div>

        {/* Inline Error Feedback */}
        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-[12px] border border-[#FECACA] bg-[#FEE2E2]/70 px-3.5 py-3 text-xs font-medium text-[#DC2626]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        <AlertDialogFooter className="mt-1 gap-2.5 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="min-h-[44px] flex-1 rounded-[12px] border-[#CBD5E1] font-semibold text-[#0F172A]"
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleConfirmVote}
            disabled={isSubmitting}
            className="min-h-[44px] flex-1 rounded-[12px] bg-[#D93829] font-bold text-white shadow-[0_6px_16px_-4px_rgba(217,56,41,0.35)] hover:bg-[#B8281B]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Mengirim suara...</span>
              </>
            ) : (
              <span>Ya, Kirim Suara</span>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
