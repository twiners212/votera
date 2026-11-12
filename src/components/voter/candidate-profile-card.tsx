import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CandidateDTO, CandidateTheme } from "@/types/votera";

const THEME_PILL_CLASSES: Record<CandidateTheme, string> = {
  red: "border-[#C84B31] bg-[#FFFBFB] text-[#A83820]",
  green: "border-[#2F6F5E] bg-[#F7FCFA] text-[#1F5748]",
  blue: "border-[#2E6F9E] bg-[#F7FAFC] text-[#1D5680]",
  amber: "border-[#B45309] bg-[#FFFBEB] text-[#92400E]",
};

export interface CandidateProfileCardProps {
  candidate: CandidateDTO;
  className?: string;
}

/**
 * Horizontal candidate showcase card with a 3:4 portrait on the left,
 * numbered badge, motto, 3 theme-colored outline mission pills, and profile CTA.
 */
export function CandidateProfileCard({
  candidate,
  className,
}: CandidateProfileCardProps) {
  const fallbackIndex = ((Math.max(1, candidate.candidateNumber) - 1) % 4) + 1;
  const resolvedPhoto =
    candidate.photoUrl?.trim() || `/images/candidate-${fallbackIndex}.jpg`;

  const pillClasses =
    THEME_PILL_CLASSES[candidate.themeColor] ?? THEME_PILL_CLASSES.red;

  const displayedMissions = candidate.missions.slice(0, 3);

  return (
    <article
      className={cn(
        "group flex flex-row items-stretch overflow-hidden rounded-[16px] border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_4px_12px_-2px_rgba(15,23,42,0.06)]",
        className
      )}
    >
      <div className="relative aspect-[3/4] w-[36%] min-w-[122px] max-w-[196px] shrink-0 overflow-hidden bg-[#F1F5F9] sm:w-[38%]">
        <span className="absolute left-2.5 top-2.5 z-20 inline-flex items-center rounded-[8px] bg-[#D93829] px-2.5 py-1 text-xs font-extrabold tracking-wide text-white shadow-sm tabular-nums">
          #{candidate.candidateNumber}
        </span>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_80%_50%,rgba(217,56,41,0.22)_0%,rgba(217,56,41,0.06)_48%,transparent_75%)]"
        />

        <Image
          src={resolvedPhoto}
          alt={`Foto ${candidate.name}`}
          fill
          sizes="(max-width: 640px) 38vw, 196px"
          className="relative z-10 object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
          unoptimized
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between p-3.5 sm:p-4">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold leading-snug text-[#0F172A] sm:text-base">
              {candidate.name}
            </h3>
            {candidate.classOrUnit && (
              <span className="shrink-0 rounded-md bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-semibold text-[#475569]">
                {candidate.classOrUnit}
              </span>
            )}
          </div>

          <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-relaxed text-[#64748B]">
            {candidate.motto}
          </p>

          {displayedMissions.length > 0 && (
            <ul
              className="mt-3 space-y-1.5"
              aria-label={`Misi utama ${candidate.name}`}
            >
              {displayedMissions.map((mission, index) => (
                <li
                  key={`${candidate.id}-mission-${index}`}
                  className={cn(
                    "rounded-[14px] border px-3 py-1.5 text-[11px] font-semibold leading-snug sm:text-xs",
                    pillClasses
                  )}
                >
                  {mission}
                </li>
              ))}
            </ul>
          )}
        </div>

        <Button
          asChild
          variant="outline"
          className="mt-3.5 min-h-[44px] w-full rounded-[12px] border-[#E2E8F0] bg-white text-xs font-bold text-[#0F172A] shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-[#CBD5E1] hover:bg-[#F8FAFC] sm:text-sm"
        >
          <Link href={`/candidates/${candidate.id}`}>
            <span>Lihat Profil</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </article>
  );
}
