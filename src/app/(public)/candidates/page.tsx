import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { ArrowLeft, Inbox, Users } from "lucide-react";
import { db, candidates, electionSettings, elections } from "@/db";
import { CurvedRedFooter } from "@/components/shared/curved-red-footer";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { CandidateProfileCard } from "@/components/voter/candidate-profile-card";
import { PublicNavbar } from "@/components/voter/public-navbar";
import type { CandidateDTO, ElectionStatus } from "@/types/votera";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daftar Kandidat — Votera",
  description:
    "Pelajari profil, motto, visi, dan misi setiap kandidat resmi sebelum memberikan suara.",
};

interface CandidatesPageData {
  shortName: string;
  title: string;
  organizationName: string;
  status: ElectionStatus;
  logoUrl: string;
  candidates: CandidateDTO[];
}

const DEFAULT_CANDIDATES_PAGE_DATA: CandidatesPageData = {
  shortName: "PILKETOS 2026",
  title: "Pemilihan Ketua OSIS 2026",
  organizationName: "SMA Bojong Gede",
  status: "draft",
  logoUrl: "/images/logo-default.png",
  candidates: [],
};

async function getCandidatesPageData(): Promise<CandidatesPageData> {
  try {
    const [election] = await db
      .select({
        id: elections.id,
        shortName: elections.shortName,
        title: elections.title,
        organizationName: elections.organizationName,
        status: elections.status,
      })
      .from(elections)
      .where(eq(elections.isActive, true))
      .orderBy(desc(elections.createdAt))
      .limit(1);

    if (!election) {
      return DEFAULT_CANDIDATES_PAGE_DATA;
    }

    const [[settings], activeCandidates] = await Promise.all([
      db
        .select({
          logoUrl: electionSettings.logoUrl,
        })
        .from(electionSettings)
        .where(eq(electionSettings.electionId, election.id))
        .limit(1),
      db
        .select({
          id: candidates.id,
          electionId: candidates.electionId,
          candidateNumber: candidates.candidateNumber,
          name: candidates.name,
          classOrUnit: candidates.classOrUnit,
          motto: candidates.motto,
          vision: candidates.vision,
          missions: candidates.missions,
          programs: candidates.programs,
          supporters: candidates.supporters,
          photoUrl: candidates.photoUrl,
          themeColor: candidates.themeColor,
          isActive: candidates.isActive,
        })
        .from(candidates)
        .where(
          and(
            eq(candidates.electionId, election.id),
            eq(candidates.isActive, true)
          )
        )
        .orderBy(asc(candidates.candidateNumber)),
    ]);

    return {
      shortName: election.shortName,
      title: election.title,
      organizationName: election.organizationName,
      status: election.status,
      logoUrl: settings?.logoUrl?.trim() || "/images/logo-default.png",
      candidates: activeCandidates.map((item) => ({
        ...item,
        missions: Array.isArray(item.missions) ? item.missions : [],
        programs: Array.isArray(item.programs) ? item.programs : [],
        supporters: Array.isArray(item.supporters) ? item.supporters : [],
      })),
    };
  } catch {
    return DEFAULT_CANDIDATES_PAGE_DATA;
  }
}

export default async function CandidatesPage() {
  const data = await getCandidatesPageData();

  return (
    <>
      <PublicNavbar
        shortName={data.shortName}
        organizationName={data.organizationName}
        logoUrl={data.logoUrl}
        status={data.status}
      />

      <main className="flex-1">
        <section className="border-b border-[#E2E8F0] bg-[#FFF5F3]">
          <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#475569] transition-colors hover:text-[#0F172A] sm:text-sm"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Kembali ke beranda</span>
            </Link>

            <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#D93829] sm:text-xs">
                  DAFTAR KANDIDAT RESMI
                </p>
                <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-3xl">
                  Kandidat {data.shortName}
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-[#475569] sm:text-base">
                  Pelajari profil, motto, visi, dan misi setiap calon sebelum
                  menentukan pilihan terbaikmu.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="inline-flex items-center gap-2.5 rounded-[12px] border border-[#E2E8F0] bg-white px-4 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFF0EE] text-[#D93829]">
                    <Users className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <div className="text-base font-extrabold leading-none text-[#0F172A] tabular-nums">
                      {data.candidates.length}
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold text-[#64748B]">
                      Calon aktif
                    </div>
                  </div>
                </div>

                <Button
                  asChild
                  className="min-h-[44px] rounded-[12px] bg-[#D93829] px-5 text-sm font-semibold text-white shadow-[0_6px_16px_-4px_rgba(217,56,41,0.35)] hover:bg-[#B8281B]"
                >
                  <Link href="/login">
                    <Inbox className="h-4 w-4" aria-hidden="true" />
                    <span>Masuk untuk memilih</span>
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section
          aria-label="Daftar profil kandidat"
          className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10"
        >
          {data.candidates.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
              {data.candidates.map((candidate) => (
                <CandidateProfileCard
                  key={candidate.id}
                  candidate={candidate}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[16px] border border-[#E2E8F0] bg-white">
              <EmptyState
                title="Belum ada kandidat aktif"
                description="Daftar kandidat resmi akan tampil di halaman ini setelah diumumkan oleh panitia."
              />
            </div>
          )}
        </section>
      </main>

      <CurvedRedFooter
        shortName={data.shortName}
        organizationName={data.organizationName}
        title={data.title}
      />
    </>
  );
}
