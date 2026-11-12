"use client";

import * as React from "react";
import Image from "next/image";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CandidateDTO } from "@/types/votera";

export interface BallotCandidateCardProps {
  candidate: CandidateDTO;
  selected: boolean;
  disabled?: boolean;
  onSelect: (candidateId: string) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
}

function getFallbackCandidatePhoto(candidateNumber: number): string {
  const index = ((Math.max(1, candidateNumber) - 1) % 4) + 1;
  return `/images/candidate-${index}.jpg`;
}

export function BallotCandidateCard({
  candidate,
  selected,
  disabled = false,
  onSelect,
  onKeyDown,
}: BallotCandidateCardProps) {
  const fallbackPhoto = getFallbackCandidatePhoto(candidate.candidateNumber);
  const [imgSrc, setImgSrc] = React.useState<string>(
    candidate.photoUrl?.trim() || fallbackPhoto
  );

  React.useEffect(() => {
    setImgSrc(candidate.photoUrl?.trim() || fallbackPhoto);
  }, [candidate.photoUrl, fallbackPhoto]);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`Kandidat nomor ${candidate.candidateNumber}: ${candidate.name}`}
      disabled={disabled}
      onClick={() => onSelect(candidate.id)}
      onKeyDown={onKeyDown}
      className={cn(
        "group relative flex w-full flex-col overflow-hidden rounded-[16px] bg-white text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]/40 focus-visible:ring-offset-2",
        disabled ? "cursor-not-allowed opacity-75" : "cursor-pointer",
        selected
          ? "border-2 border-[#D93829] shadow-[0_8px_20px_-4px_rgba(217,56,41,0.18)]"
          : "border border-[#E2E8F0] hover:border-[#CBD5E1] hover:shadow-md"
      )}
    >
      {/* Portrait Area (4:5) */}
      <div
        className={cn(
          "relative aspect-[4/5] w-full overflow-hidden border-b",
          selected
            ? "border-[#FECACA]/70 bg-gradient-to-tr from-[#FFF5F3] via-slate-50 to-rose-50"
            : "border-[#F1F5F9] bg-gradient-to-tr from-slate-100 via-slate-50 to-slate-100"
        )}
      >
        {/* Top-left Candidate Number Badge */}
        <div className="absolute left-3.5 top-3.5 z-10">
          <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-[8px] bg-[#D93829] px-2 text-xs font-extrabold text-white shadow-sm tabular-nums">
            #{candidate.candidateNumber}
          </span>
        </div>

        {/* Top-right Radio Selection Indicator */}
        <div className="absolute right-3.5 top-3.5 z-10" aria-hidden="true">
          {selected ? (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#D93829] text-white shadow-md transition-transform duration-150">
              <Check className="h-4 w-4 stroke-[2.75]" />
            </span>
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#CBD5E1] bg-white/90 shadow-sm backdrop-blur-sm transition-colors group-hover:border-[#94A3B8]" />
          )}
        </div>

        {/* Candidate Portrait */}
        <Image
          src={imgSrc}
          alt={`Foto ${candidate.name}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
          unoptimized
          onError={() => {
            if (imgSrc !== fallbackPhoto) {
              setImgSrc(fallbackPhoto);
            }
          }}
        />
      </div>

      {/* Candidate Identity Info */}
      <div className="flex flex-1 flex-col justify-start bg-white p-4">
        <h3 className="text-base font-bold leading-snug tracking-tight text-[#0F172A]">
          {candidate.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[#64748B]">
          {candidate.motto}
        </p>
      </div>
    </button>
  );
}
