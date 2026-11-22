import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CurvedRedFooter } from "@/components/shared/curved-red-footer";
import { EmptyState } from "@/components/shared/empty-state";
import { CandidateShowcaseGrid } from "@/components/voter/candidate-showcase-grid";
import { LandingHero } from "@/components/voter/landing-hero";
import { PublicNavbar } from "@/components/voter/public-navbar";
import { getPublicShowcaseDataCached } from "@/lib/public/showcase-cache";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Beranda — Votera",
  description:
    "Portal resmi pemilihan online. Kenali visi, misi, dan program kerja setiap kandidat sebelum memberikan suara.",
};

export default async function HomePage() {
  const data = await getPublicShowcaseDataCached();

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
