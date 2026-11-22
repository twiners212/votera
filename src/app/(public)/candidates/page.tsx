import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Inbox, Users } from "lucide-react";
import { CurvedRedFooter } from "@/components/shared/curved-red-footer";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { CandidateShowcaseGrid } from "@/components/voter/candidate-showcase-grid";
import { PublicNavbar } from "@/components/voter/public-navbar";
import { getPublicShowcaseDataCached } from "@/lib/public/showcase-cache";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daftar Kandidat — Votera",
  description:
    "Pelajari profil, motto, visi, dan misi setiap kandidat resmi sebelum memberikan suara.",
};

export default async function CandidatesPage() {
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
        <section className="border-b border-[#E2E8F0] bg-[#FFF5F3]">
          <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
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
                <div className="inline-flex h-11 items-center gap-2.5 rounded-[12px] border border-[#E2E8F0] bg-white px-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFF0EE] text-[#D93829]">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-base font-extrabold leading-none text-[#0F172A] tabular-nums">
                      {data.candidates.length}
                    </span>
                    <span className="text-xs font-semibold text-[#64748B]">
                      Calon aktif
                    </span>
                  </div>
                </div>

                <Button
                  asChild
                  className="h-11 min-h-[44px] rounded-[12px] bg-[#D93829] px-5 text-sm font-semibold text-white shadow-[0_6px_16px_-4px_rgba(217,56,41,0.35)] transition-transform active:scale-[0.99] hover:bg-[#B8281B]"
                >
                  <Link href="/login" className="inline-flex items-center gap-2">
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
          className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10"
        >
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
