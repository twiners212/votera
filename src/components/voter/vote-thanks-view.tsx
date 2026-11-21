"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, LogOut, ShieldCheck, Users } from "lucide-react";
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

function formatWibTimestamp(isoDateString?: string | null): string {
  if (!isoDateString) {
    return "Tercatat Resmi — WIB";
  }
  const date = new Date(isoDateString);
  if (isNaN(date.getTime())) {
    return "Tercatat Resmi — WIB";
  }

  return (
    new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date) + " WIB"
  );
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
  const [clientTimestamp, setClientTimestamp] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!voter?.votedAt) {
      setClientTimestamp(
        new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Jakarta",
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(new Date()) + " WIB"
      );
    }
  }, [voter?.votedAt]);

  const displayName = voter?.name?.trim() || "Pemilih";
  const bannerSrc = heroBannerUrl || "/images/hero-flag-ballot.jpg";
  const timestampDisplay = voter?.votedAt
    ? formatWibTimestamp(voter.votedAt)
    : clientTimestamp || "Hari ini — WIB";

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

        {/* Elevated Civic Trust Certificate Card on Desktop, Linear on Mobile */}
        <section
          aria-labelledby="vote-thanks-heading"
          className="relative z-10 mx-auto flex w-full max-w-xl flex-col items-center text-center p-0 sm:p-8 lg:max-w-2xl lg:rounded-[24px] lg:border lg:border-[#E2E8F0] lg:bg-white/95 lg:backdrop-blur lg:shadow-[0_20px_50px_rgba(15,23,42,0.08)] lg:p-10"
        >
          {/* Centered green check icon with double ring */}
          <div
            aria-hidden="true"
            className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#1F7A4C] shadow-lg shadow-[#16A34A]/20 ring-4 ring-[#DCFCE7] ring-offset-2 ring-offset-white"
          >
            <Check className="h-8 w-8 text-white" strokeWidth={3.25} />
          </div>

          <p className="mb-2.5 text-xs font-extrabold uppercase tracking-[0.14em] text-[#D93829]">
            SUARA TERCATAT &amp; TERVERIFIKASI
          </p>

          <h1
            id="vote-thanks-heading"
            className="mb-4 text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-4xl md:text-[42px] md:leading-[1.15] [text-wrap:balance]"
            style={{ textWrap: "balance" }}
          >
            Terima kasih,{" "}
            <span className="block text-[#D93829] sm:inline">
              {displayName}!
            </span>
          </h1>

          <p className="mb-6 max-w-md text-sm leading-relaxed text-[#475569] sm:text-base">
            Suara kamu sudah tersimpan secara anonim dan dijaga kerahasiaannya.
            Hasil pemilihan akan diumumkan secara resmi oleh panitia.
          </p>

          {/* Anonymity note & voting confirmation in clean box */}
          <div className="mb-8 w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-left shadow-sm sm:p-5">
            <div className="flex items-start gap-3.5">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#DCFCE7] text-[#16A34A]">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                    Jaminan Kerahasiaan (Unlinkable Ballot)
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[10px] font-bold text-[#15803D]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
                    Terverifikasi
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-[#475569] sm:text-[13px]">
                  Suara kamu telah dipisahkan secara permanen dari identitas
                  pemilih (zero-knowledge unlinkable ballot). Surat suara
                  terenkripsi dan tidak dapat dilacak kembali oleh pihak mana
                  pun.
                </p>
                <div className="border-t border-[#E2E8F0] pt-2 text-xs text-[#64748B]">
                  <span>Waktu Pencatatan: </span>
                  <span className="font-semibold text-[#0F172A] tabular-nums">
                    {timestampDisplay}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Dual CTA buttons */}
          <div className="flex w-full flex-row flex-wrap items-center justify-center gap-3 sm:gap-4">
            <Button
              type="button"
              size="lg"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="min-h-[46px] min-w-[140px] gap-2 rounded-xl bg-[#D93829] px-8 text-sm font-bold text-white shadow-[0_6px_16px_-4px_rgba(200,50,43,0.35)] hover:bg-[#B8281B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]/50"
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
              className="min-h-[46px] min-w-[152px] gap-2 rounded-xl border border-[#CBD5E1] bg-white px-8 text-sm font-bold text-[#0F172A] shadow-sm hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]/30"
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
