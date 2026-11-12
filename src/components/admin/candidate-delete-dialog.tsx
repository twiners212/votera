"use client";

import * as React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useDeleteCandidate } from "@/hooks/use-candidates";
import type { CandidateDTO } from "@/types/votera";

export interface CandidateDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: CandidateDTO | null;
  electionId?: string;
}

export function CandidateDeleteDialog({
  open,
  onOpenChange,
  candidate,
  electionId = "active",
}: CandidateDeleteDialogProps) {
  const deleteCandidate = useDeleteCandidate(electionId);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setErrorMessage(null);
    }
  }, [open, candidate?.id]);

  async function handleConfirmDelete() {
    if (!candidate || deleteCandidate.isPending) return;
    setErrorMessage(null);

    try {
      await deleteCandidate.mutateAsync(candidate.id);
      toast.success(
        `Kandidat #${candidate.candidateNumber} ${candidate.name} berhasil dihapus`
      );
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menghapus kandidat";
      setErrorMessage(message);
      toast.error(message);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!deleteCandidate.isPending) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-[#FEE2E2] text-[#DC2626] sm:mx-0">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <AlertDialogTitle>Hapus kandidat?</AlertDialogTitle>
          <AlertDialogDescription>
            {candidate ? (
              <>
                Kamu akan menghapus{" "}
                <span className="font-semibold text-[#0F172A]">
                  <span className="tabular-nums">
                    #{candidate.candidateNumber}
                  </span>{" "}
                  {candidate.name}
                </span>{" "}
                ({candidate.classOrUnit}). Kandidat yang sudah menerima suara
                tidak dapat dihapus. Tindakan ini bersifat permanen.
              </>
            ) : (
              "Tindakan ini akan menghapus data kandidat secara permanen."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#DC2626]"
          >
            {errorMessage}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteCandidate.isPending}>
            Batal
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={!candidate || deleteCandidate.isPending}
            onClick={handleConfirmDelete}
          >
            {deleteCandidate.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            <span>Hapus kandidat</span>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
