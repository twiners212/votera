"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, LogOut, Users } from "lucide-react";
import { CurvedRedFooter } from "@/components/shared/curved-red-footer";
import { Button } from "@/components/ui/button";
import { PublicNavbar } from "@/components/voter/public-navbar";
import type { ElectionStatus, VoterSessionDTO } from "@/types/votera";

export interface VoteThanksViewProps {
  shortName: string;
  organizationName: string;
  title: string;
  status: ElectionStatus;
  logoUrl?: string | null;
  heroBannerUrl?: string | null;
  voter?: VoterSessionDTO | null;
}

export function VoteThanksView({
  shortName,
  organizationName,
  title,
  status,
  logoUrl,
  heroBannerUrl,
  voter = null,
}: VoteThanksViewProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const displayName = voter?.name?.trim() || "Pemilih";
  const bannerSrc = heroBannerUrl || "/images/hero-flag-ballot.jpg";

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch("/api/voter/logout", { method: "POST" });
    } catch {
      // Tetap arahkan kembali ke beranda jika jaringan bermasalah
    } finally {
      router.push("/");
      router.refresh();
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-between bg-white text-[#0F172A]">
      <PublicNavbar
        shortName={shortName}
        organizationName={organizationName}
        logoUrl={logoUrl}
        status={status}
        voter={voter}
        onLogout={handleLogout}
      />

      <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-14 sm:px-6 md:py-20">
        {/* Soft background composition */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden"
        >
          <Image
            src={bannerSrc}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-right opacity-25 sm:opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white/85 via-white/75 to-white/95" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.92)_0%,rgba(255,255,255,0.65)_60%,rgba(255,255,255,0.9)_100%)]" />
        </div>

        {/* Centered confirmation stack */}
        <section
          aria-labelledby="vote-thanks-heading"
          className="relative z-10 mx-auto flex w-full max-w-xl flex-col items-center text-center"
        >
          <div
            aria-hidden="true"
            className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#1F7A4C] shadow-lg shadow-[#16A34A]/25 ring-4 ring-[#DCFCE7]"
          >
            <Check className="h-8 w-8 text-white" strokeWidth={3.25} />
          </div>

          <p className="mb-2.5 text-xs font-extrabold uppercase tracking-[0.14em] text-[#D93829]">
            SUARA TERCATAT
          </p>

          <h1
            id="vote-thanks-heading"
            className="mb-4 text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-4xl md:text-[42px] md:leading-[1.15]"
          >
            Terima kasih,{" "}
            <span className="block text-[#D93829] sm:inline">
              {displayName}!
            </span>
          </h1>

          <p className="mb-9 max-w-md text-sm leading-relaxed text-[#475569] sm:text-base">
            Suara kamu sudah tersimpan secara anonim dan dijaga
            kerahasiaannya. Hasil pemilihan akan diumumkan secara resmi oleh
            panitia.
          </p>

          <div className="flex w-full flex-row flex-wrap items-center justify-center gap-3 sm:gap-4">
            <Button
              type="button"
              size="lg"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="min-h-[44px] min-w-[136px] gap-2 rounded-[12px] bg-[#D93829] px-7 text-sm font-bold text-white shadow-[0_6px_16px_-4px_rgba(200,50,43,0.35)] hover:bg-[#B8281B]"
            >
              {isLoggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogOut className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{isLoggingOut ? "Keluar..." : "Keluar"}</span>
            </Button>

            <Button
              asChild
              type="button"
              variant="outline"
              size="lg"
              className="min-h-[44px] min-w-[152px] gap-2 rounded-[12px] border-[#CBD5E1] bg-white px-6 text-sm font-bold text-[#0F172A] shadow-sm hover:bg-[#F8FAFC]"
            >
              <Link href="/candidates">
                <Users className="h-4 w-4 text-[#64748B]" aria-hidden="true" />
                <span>Lihat kandidat</span>
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <CurvedRedFooter
        shortName={shortName}
        organizationName={organizationName}
        title={title}
      />
    </div>
  );
}
