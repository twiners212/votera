"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import type { CandidateDTO } from "@/types/votera";

export interface StickyBallotBarProps {
  selectedCandidate: CandidateDTO | null;
  disabled?: boolean;
  isSubmitting?: boolean;
  onSubmitClick: () => void;
}

export function StickyBallotBar({
  selectedCandidate,
  disabled = false,
  isSubmitting = false,
  onSubmitClick,
}: StickyBallotBarProps) {
  const canSubmit = Boolean(selectedCandidate) && !disabled && !isSubmitting;

  return (
    <aside
      aria-label="Konfirmasi pilihan surat suara"
      className="sticky bottom-0 z-30 w-full border-t border-[#E2E8F0] bg-white/95 shadow-[0_-4px_16px_-4px_rgba(15,23,42,0.08)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
        <div className="min-w-0 flex-1" aria-live="polite">
          {selectedCandidate ? (
            <p className="truncate text-sm font-bold tracking-tight text-[#0F172A] tabular-nums sm:text-[15px]">
              <span className="font-medium text-[#64748B]">Dipilih: </span>
              No. {selectedCandidate.candidateNumber} — {selectedCandidate.name}
            </p>
          ) : (
            <p className="truncate text-sm font-medium text-[#64748B]">
              Belum ada kandidat dipilih
            </p>
          )}
        </div>

        <Button
          type="button"
          onClick={onSubmitClick}
          disabled={!canSubmit}
          className="min-h-[44px] shrink-0 rounded-[12px] bg-[#D93829] px-6 text-sm font-bold text-white shadow-[0_6px_16px_-4px_rgba(217,56,41,0.35)] transition-all hover:bg-[#B8281B] disabled:cursor-not-allowed disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:opacity-100 disabled:shadow-none"
        >
          Kirim suara
        </Button>
      </div>
    </aside>
  );
}
