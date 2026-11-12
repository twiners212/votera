import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardList,
  Users,
} from "lucide-react";
import { CurvedRedFooter } from "@/components/shared/curved-red-footer";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { PublicNavbar } from "@/components/voter/public-navbar";
import type {
  CandidateDTO,
  ElectionStatus,
  VoterSessionDTO,
} from "@/types/votera";

export interface CandidateDetailViewProps {
  candidate: CandidateDTO;
  election: {
    shortName: string;
    title: string;
    organizationName: string;
    status: ElectionStatus;
    logoUrl: string | null;
    heroBannerUrl: string | null;
  };
  voter?: VoterSessionDTO | null;
  hasVoterSession?: boolean;
}

function getFallbackCandidatePhoto(candidateNumber: number): string {
  const normalizedIndex =
    candidateNumber > 0 ? ((candidateNumber - 1) % 4) + 1 : 1;
  return `/images/candidate-${normalizedIndex}.jpg`;
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="mb-3.5 flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="inline-block h-1 w-4 shrink-0 rounded-full bg-[#D93829]"
      />
      <h2 className="text-base font-bold tracking-tight text-[#0F172A] sm:text-lg">
        {title}
      </h2>
    </div>
  );
}

export function CandidateDetailView({
  candidate,
  election,
  voter = null,
  hasVoterSession = false,
}: CandidateDetailViewProps) {
  const portraitSrc =
    candidate.photoUrl || getFallbackCandidatePhoto(candidate.candidateNumber);
  const heroStripSrc =
    election.heroBannerUrl || "/images/hero-flag-ballot.jpg";

  const canGoToBallot =
    Boolean(voter && !voter.hasVoted) || (hasVoterSession && !voter?.hasVoted);
  const ctaHref = canGoToBallot ? "/vote" : "/login";
  const ctaLabel = canGoToBallot
    ? "Pilih di Surat Suara"
    : "Masuk untuk memilih";

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-[#0F172A]">
      <PublicNavbar
        shortName={election.shortName}
        organizationName={election.organizationName}
        logoUrl={election.logoUrl}
        status={election.status}
        voter={voter}
      />

      {/* Short Hero Strip */}
      <div className="relative h-28 w-full overflow-hidden bg-[#FDF8F6] sm:h-32">
        <Image
          src={heroStripSrc}
          alt={`Banner ${election.title}`}
          fill
          priority
          sizes="100vw"
          className="object-cover object-right opacity-85"
          unoptimized
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-white/10 via-[#F8FAFC]/55 to-[#F8FAFC]"
        />
      </div>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-14 sm:px-6">
        {/* Back Link & Candidate Header */}
        <section className="-mt-4 pb-5 sm:-mt-6 sm:pb-6">
          <Link
            href="/candidates"
            className="group mb-3 inline-flex min-h-[36px] items-center gap-1.5 text-xs font-semibold text-[#64748B] transition-colors hover:text-[#D93829] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]/30 sm:text-sm"
          >
            <span
              aria-hidden="true"
              className="transition-transform group-hover:-translate-x-0.5"
            >
              ←
            </span>
            <span>Semua kandidat</span>
          </Link>

          <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#D93829] tabular-nums sm:text-xs">
            KANDIDAT NOMOR {candidate.candidateNumber}
          </p>

          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-3xl">
              {candidate.name}
            </h1>
            <span className="inline-flex items-center rounded-md border border-[#E2E8F0] bg-white px-2.5 py-0.5 text-xs font-bold text-[#334155]">
              {candidate.classOrUnit}
            </span>
          </div>

          <p className="mt-2 text-sm font-medium italic leading-relaxed text-[#64748B] sm:text-base">
            &ldquo;{candidate.motto}&rdquo;
          </p>
        </section>

        {/* Framed Portrait Card */}
        <section
          aria-label={`Profil ${candidate.name}`}
          className="mb-5 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative mx-auto aspect-[4/5] w-full max-w-[240px] shrink-0 overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#FAF9F7] sm:mx-0 sm:w-52">
              <div
                aria-hidden="true"
                className="absolute inset-y-0 right-0 w-28 translate-x-6 skew-x-12 bg-gradient-to-tr from-transparent via-[#D93829]/15 to-[#D93829]/30"
              />
              <span className="absolute left-2.5 top-2.5 z-20 inline-flex h-7 min-w-[34px] items-center justify-center rounded-lg bg-[#D93829] px-2.5 text-xs font-extrabold text-white shadow-sm tabular-nums">
                #{candidate.candidateNumber}
              </span>
              <Image
                src={portraitSrc}
                alt={`Foto kandidat nomor ${candidate.candidateNumber} ${candidate.name}`}
                fill
                priority
                sizes="(max-width: 640px) 240px, 208px"
                className="relative z-10 object-cover object-top"
                unoptimized
              />
            </div>

            <div className="flex flex-1 flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill
                    status="active"
                    label="Kandidat Aktif"
                    size="sm"
                  />
                  <span className="inline-flex items-center rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-[11px] font-semibold text-[#334155]">
                    {candidate.classOrUnit}
                  </span>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                    {election.title}
                  </div>
                  <div className="mt-1 text-lg font-bold text-[#0F172A]">
                    Calon Nomor Urut{" "}
                    <span className="text-[#D93829] tabular-nums">
                      #{candidate.candidateNumber}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-[#64748B]">
                    &ldquo;{candidate.motto}&rdquo;
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-[#F1F5F9] pt-3">
                <div className="rounded-xl bg-[#F8FAFC] px-3 py-2 text-center">
                  <div className="text-base font-extrabold text-[#0F172A] tabular-nums">
                    {candidate.missions.length}
                  </div>
                  <div className="text-[11px] font-medium text-[#64748B]">
                    Misi
                  </div>
                </div>
                <div className="rounded-xl bg-[#F8FAFC] px-3 py-2 text-center">
                  <div className="text-base font-extrabold text-[#0F172A] tabular-nums">
                    {candidate.programs.length}
                  </div>
                  <div className="text-[11px] font-medium text-[#64748B]">
                    Program
                  </div>
                </div>
                <div className="rounded-xl bg-[#F8FAFC] px-3 py-2 text-center">
                  <div className="text-base font-extrabold text-[#0F172A] tabular-nums">
                    {candidate.supporters.length}
                  </div>
                  <div className="text-[11px] font-medium text-[#64748B]">
                    Pendukung
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Visi, Misi, Program Kerja, Pendukung Cards */}
        <div className="space-y-4">
          {/* Visi */}
          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6">
            <SectionHeading title="Visi" />
            <p className="text-sm leading-relaxed text-[#334155] sm:text-[15px]">
              {candidate.vision}
            </p>
          </section>

          {/* Misi */}
          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6">
            <SectionHeading title="Misi" />
            {candidate.missions.length > 0 ? (
              <ul className="space-y-3">
                {candidate.missions.map((mission, index) => (
                  <li
                    key={`${index}-${mission}`}
                    className="flex items-start gap-3 text-sm leading-relaxed text-[#334155] sm:text-[15px]"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FFF0EE] text-[#D93829]"
                    >
                      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                    </span>
                    <span>{mission}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#64748B]">
                Belum ada misi yang dicantumkan.
              </p>
            )}
          </section>

          {/* Program Kerja */}
          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6">
            <SectionHeading title="Program Kerja" />
            {candidate.programs.length > 0 ? (
              <ol className="space-y-2.5">
                {candidate.programs.map((program, index) => (
                  <li
                    key={`${index}-${program}`}
                    className="flex items-start gap-3 rounded-xl border border-[#F1F5F9] bg-[#F8FAFC] px-3.5 py-3 text-sm leading-relaxed text-[#334155] sm:text-[15px]"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#FFF0EE] text-xs font-extrabold text-[#D93829] tabular-nums">
                      {index + 1}
                    </span>
                    <div className="flex flex-1 items-start justify-between gap-2">
                      <span>{program}</span>
                      <ClipboardList
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#94A3B8]"
                        aria-hidden="true"
                      />
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-[#64748B]">
                Belum ada program kerja yang dicantumkan.
              </p>
            )}
          </section>

          {/* Pendukung */}
          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6">
            <SectionHeading title="Pendukung" />
            {candidate.supporters.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {candidate.supporters.map((supporter, index) => (
                  <li
                    key={`${index}-${supporter}`}
                    className="inline-flex items-center gap-2 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-1.5 text-xs font-semibold text-[#334155] sm:text-sm"
                  >
                    <Users
                      className="h-3.5 w-3.5 shrink-0 text-[#D93829]"
                      aria-hidden="true"
                    />
                    <span>{supporter}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#64748B]">
                Belum ada daftar pendukung yang dicantumkan.
              </p>
            )}
          </section>
        </div>

        {/* Bottom Voting CTA */}
        <section className="mt-6 rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">
                Siap menentukan pilihan?
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#64748B] sm:text-sm">
                {election.status === "open"
                  ? "Suara kamu bersifat rahasia dan hanya dapat dikirim satu kali."
                  : election.status === "draft"
                    ? "Pemungutan suara belum dibuka oleh panitia."
                    : "Periode pemungutan suara telah berakhir."}
              </p>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <Button
                asChild
                variant="outline"
                size="lg"
                className="min-h-[46px] w-full border-[#CBD5E1] sm:w-auto"
              >
                <Link href="/candidates">Semua kandidat</Link>
              </Button>
              <Button
                asChild
                size="lg"
                className="min-h-[46px] w-full shadow-[0_6px_16px_-4px_rgba(200,50,43,0.35)] sm:w-auto"
              >
                <Link href={ctaHref}>
                  {canGoToBallot ? (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  ) : null}
                  <span>{ctaLabel}</span>
                  {!canGoToBallot ? (
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  ) : null}
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <CurvedRedFooter
        shortName={election.shortName}
        organizationName={election.organizationName}
        title={election.title}
      />
    </div>
  );
}
