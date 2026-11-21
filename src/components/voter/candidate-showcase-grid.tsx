"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { CandidateProfileCard } from "@/components/voter/candidate-profile-card";
import type { CandidateDTO } from "@/types/votera";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export interface CandidateShowcaseGridProps {
  candidates: CandidateDTO[];
  className?: string;
}

/**
 * Grid container with GSAP ScrollTrigger staggered entrance for candidate cards.
 * Respects prefers-reduced-motion and ensures uniform height across columns.
 */
export function CandidateShowcaseGrid({
  candidates,
  className,
}: CandidateShowcaseGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (typeof window === "undefined" || !gridRef.current) return;

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      if (prefersReducedMotion) {
        gsap.set(".candidate-grid-item", { opacity: 1, y: 0 });
        return;
      }

      gsap.fromTo(
        ".candidate-grid-item",
        {
          opacity: 0,
          y: 24,
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.1,
          ease: "power2.out",
          scrollTrigger: {
            trigger: gridRef.current,
            start: "top 85%",
            toggleActions: "play none none none",
            once: true,
          },
        }
      );
    },
    { scope: gridRef, dependencies: [candidates] }
  );

  return (
    <div
      ref={gridRef}
      className={className || "grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6"}
    >
      {candidates.map((candidate) => (
        <div key={candidate.id} className="candidate-grid-item h-full">
          <CandidateProfileCard candidate={candidate} />
        </div>
      ))}
    </div>
  );
}
