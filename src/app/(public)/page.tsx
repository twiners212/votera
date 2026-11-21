import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { db, candidates, electionSettings, elections } from "@/db";
import { CurvedRedFooter } from "@/components/shared/curved-red-footer";
import { EmptyState } from "@/components/shared/empty-state";
import { CandidateShowcaseGrid } from "@/components/voter/candidate-showcase-grid";
import { LandingHero } from "@/components/voter/landing-hero";
import { PublicNavbar } from "@/components/voter/public-navbar";
import type { CandidateDTO, ElectionStatus } from "@/types/votera";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Beranda — Votera",
  description:
    "Portal resmi pemilihan online. Kenali visi, misi, dan program kerja setiap kandidat sebelum memberikan suara.",
};

interface PublicShowcaseData {
  shortName: string;
  title: string;
  organizationName: string;
  description: string | null;
  status: ElectionStatus;
  logoUrl: string;
  heroBannerUrl: string;
  candidates: CandidateDTO[];
}

const DEFAULT_SHOWCASE_DATA: PublicShowcaseData = {
  shortName: "PILKETOS 2026",
  title: "Pemilihan Ketua OSIS 2026",
  organizationName: "SMA Bojong Gede",
  description:
    "Kenali calon ketua sebelum menentukan pilihan. Suara kamu dijaga kerahasiaannya dan hanya bisa digunakan satu kali.",
  status: "draft",
  logoUrl: "/images/logo-default.png",
  heroBannerUrl: "/images/hero-flag-ballot.jpg",
  candidates: [],
};

async function getPublicShowcaseData(): Promise<PublicShowcaseData> {
  try {
    const [election] = await db
      .select({
        id: elections.id,
        shortName: elections.shortName,
        title: elections.title,
        organizationName: elections.organizationName,
        description: elections.description,
        status: elections.status,
      })
      .from(elections)
      .where(eq(elections.isActive, true))
      .orderBy(desc(elections.createdAt))
      .limit(1);

    if (!election) {
      return DEFAULT_SHOWCASE_DATA;
    }

    const [[settings], activeCandidates] = await Promise.all([
      db
        .select({
          logoUrl: electionSettings.logoUrl,
          heroBannerUrl: electionSettings.heroBannerUrl,
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
      description: election.description,
      status: election.status,
      logoUrl: settings?.logoUrl?.trim() || "/images/logo-default.png",
      heroBannerUrl:
        settings?.heroBannerUrl?.trim() || "/images/hero-flag-ballot.jpg",
      candidates: activeCandidates.map((item) => ({
        ...item,
        missions: Array.isArray(item.missions) ? item.missions : [],
        programs: Array.isArray(item.programs) ? item.programs : [],
        supporters: Array.isArray(item.supporters) ? item.supporters : [],
      })),
    };
  } catch {
    return DEFAULT_SHOWCASE_DATA;
  }
}

export default async function HomePage() {
  const data = await getPublicShowcaseData();

  return (
    <>
      <PublicNavbar
        shortName={data.shortName}
        organizationName={data.organizationName}
        logoUrl={data.logoUrl}
        status={data.status}
      />

      <main className="flex-1">
        <LandingHero
          title={data.title}
          description={data.description}
          heroBannerUrl={data.heroBannerUrl}
          candidateCount={data.candidates.length}
        />

        <section
          aria-labelledby="candidate-showcase-heading"
          className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:py-12"
        >
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#D93829]">
                KENALI CALON PEMIMPIN
              </p>
              <h2
                id="candidate-showcase-heading"
                className="mt-1 text-xl font-extrabold tracking-tight text-[#0F172A] sm:text-2xl"
              >
                Daftar Kandidat Resmi
              </h2>
            </div>

            {data.candidates.length > 0 && (
              <Link
                href="/candidates"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#D93829] transition-colors hover:text-[#B8281B]"
              >
                <span>Lihat semua kandidat</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
          </div>

          {data.candidates.length > 0 ? (
            <CandidateShowcaseGrid candidates={data.candidates} />
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
