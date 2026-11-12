"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, Vote } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { BallotCandidateCard } from "@/components/voter/ballot-candidate-card";
import { StickyBallotBar } from "@/components/voter/sticky-ballot-bar";
import { VoteConfirmDialog } from "@/components/voter/vote-confirm-dialog";
import type { CandidateDTO, ElectionStatus } from "@/types/votera";

export interface BallotElectionSummary {
  id: string;
  shortName: string;
  title: string;
  organizationName: string;
  status: ElectionStatus;
  heroBannerUrl: string | null;
}

export interface BallotWorkspaceProps {
  election: BallotElectionSummary | null;
  candidates: CandidateDTO[];
  isVotingOpen: boolean;
}

export function BallotWorkspace({
  election,
  candidates,
  isVotingOpen,
}: BallotWorkspaceProps) {
  const [selectedCandidateId, setSelectedCandidateId] = React.useState<
    string | null
  >(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const heroSrc =
    election?.heroBannerUrl?.trim() || "/images/hero-flag-ballot.jpg";

  const selectedCandidate = React.useMemo(
    () => candidates.find((c) => c.id === selectedCandidateId) ?? null,
    [candidates, selectedCandidateId]
  );

  function handleCardKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) {
    if (candidates.length === 0) return;

    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % candidates.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + candidates.length) % candidates.length;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      const targetCandidate = candidates[nextIndex];
      if (targetCandidate) {
        setSelectedCandidateId(targetCandidate.id);
        const container = event.currentTarget.parentElement;
        const buttons =
          container?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
        buttons?.[nextIndex]?.focus();
      }
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <main className="flex-1 pb-10">
        {/* Hero Header Surat Suara */}
        <section className="relative w-full overflow-hidden border-b border-[#E2E8F0] bg-white">
          {/* Decorative Hero Backdrop */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 select-none overflow-hidden"
          >
            <div className="absolute inset-y-0 right-0 w-full sm:w-2/3 lg:w-1/2">
              <Image
                src={heroSrc}
                alt=""
                fill
                priority
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover object-center opacity-85"
                unoptimized
              />
            </div>
            {/* Fade-out gradient mask so left-side typography stays high-contrast */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/95 via-white/90 to-white/80 sm:bg-gradient-to-r sm:from-white sm:via-white/90 sm:to-white/15" />
          </div>

          <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
            <div className="max-w-xl">
              <span className="inline-block text-xs font-extrabold uppercase tracking-[0.08em] text-[#D93829]">
                SURAT SUARA
              </span>
              <h1 className="mt-2 text-3xl font-extrabold leading-[1.15] tracking-tight text-[#0F172A] sm:text-4xl lg:text-[42px]">
                Pilih Satu{" "}
                <span className="text-[#D93829]">Calon Ketua</span>
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-[#64748B] sm:mt-4 sm:text-base">
                Ketuk kartu kandidat pilihan kamu. Setelah suara dikirim,
                pilihan{" "}
                <strong className="font-bold text-[#0F172A]">
                  tidak bisa diubah
                </strong>
                .
              </p>
            </div>
          </div>
        </section>

        {/* Voting Window Closed Notice */}
        {election && !isVotingOpen && (
          <div className="mx-auto mt-6 max-w-7xl px-4 sm:px-6">
            <div
              role="status"
              className="flex flex-col gap-3 rounded-[12px] border border-[#FDE68A] bg-[#FEF3C7]/70 px-4 py-3.5 text-sm text-[#92400E] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#D97706]"
                  aria-hidden="true"
                />
                <span>
                  Pemungutan suara untuk{" "}
                  <strong className="font-bold">{election.title}</strong> sedang
                  tidak dibuka atau berada di luar jadwal resmi.
                </span>
              </div>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-fit shrink-0 border-[#FDE68A] bg-white text-[#92400E] hover:bg-[#FFFBEB]"
              >
                <Link href="/candidates">Lihat profil kandidat</Link>
              </Button>
            </div>
          </div>
        )}

        {/* Candidates Radio Grid */}
        <section
          aria-label="Daftar kandidat"
          className="mx-auto mt-7 max-w-7xl px-4 sm:mt-8 sm:px-6"
        >
          {!election || candidates.length === 0 ? (
            <div className="rounded-[16px] border border-[#E2E8F0] bg-white">
              <EmptyState
                icon={<Vote className="h-5 w-5" aria-hidden="true" />}
                title="Surat suara belum tersedia"
                description="Belum ada kandidat aktif pada pemilihan saat ini. Silakan kembali ke beranda atau hubungi panitia."
                action={
                  <Button asChild variant="outline" className="min-h-[44px]">
                    <Link href="/">Kembali ke beranda</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <div
              role="radiogroup"
              aria-label="Pilih satu kandidat"
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6"
            >
              {candidates.map((candidate, index) => (
                <BallotCandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  selected={selectedCandidateId === candidate.id}
                  disabled={!isVotingOpen}
                  onSelect={(id) => setSelectedCandidateId(id)}
                  onKeyDown={(e) => handleCardKeyDown(e, index)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Sticky Bottom Confirmation Bar */}
      <StickyBallotBar
        selectedCandidate={selectedCandidate}
        disabled={!isVotingOpen || candidates.length === 0}
        onSubmitClick={() => {
          if (selectedCandidate && isVotingOpen) {
            setConfirmOpen(true);
          }
        }}
      />

      {/* Vote Confirmation Modal */}
      <VoteConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        candidate={selectedCandidate}
      />
    </div>
  );
}
