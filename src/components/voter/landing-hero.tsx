"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Inbox,
  Users,
  CheckCircle2,
  Lock,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

export interface LandingHeroProps {
  title?: string;
  description?: string | null;
  heroBannerUrl?: string | null;
  candidateCount: number;
  className?: string;
}

function splitTitleHighlight(title: string): {
  lead: string;
  accent: string | null;
} {
  const trimmed = title.trim();
  const osisMatch = trimmed.match(/^(.*?)(\s+OSIS\s+\d{4})$/i);
  if (osisMatch) {
    return { lead: osisMatch[1], accent: osisMatch[2].trim() };
  }

  const yearMatch = trimmed.match(/^(.*?)(\s+\d{4})$/);
  if (yearMatch) {
    return { lead: yearMatch[1], accent: yearMatch[2].trim() };
  }

  return { lead: trimmed, accent: null };
}

/**
 * Public landing hero banner with Impeccable spatial rhythm, ambient background texture,
 * "3 Jaminan Pemilihan" Civic Trust strip, refined showcase card, and GSAP entrance + counter animations.
 */
export function LandingHero({
  title = "Pemilihan Ketua OSIS 2026",
  description = "Kenali calon ketua sebelum menentukan pilihan. Suara kamu dijaga kerahasiaannya dan hanya bisa digunakan satu kali.",
  heroBannerUrl,
  candidateCount,
  className,
}: LandingHeroProps) {
  const resolvedHero = heroBannerUrl?.trim() || "/images/hero-flag-ballot.jpg";
  const { lead, accent } = splitTitleHighlight(title);

  const containerRef = useRef<HTMLElement>(null);
  const desktopCounterRef = useRef<HTMLSpanElement>(null);
  const mobileCounterRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      if (typeof window === "undefined" || !containerRef.current) return;

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      if (prefersReducedMotion) {
        if (desktopCounterRef.current) {
          desktopCounterRef.current.textContent = String(candidateCount);
        }
        if (mobileCounterRef.current) {
          mobileCounterRef.current.textContent = String(candidateCount);
        }
        return;
      }

      // 1. Entrance Sequence Timeline
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.fromTo(
        ".hero-eyebrow",
        { opacity: 0, y: -10 },
        { opacity: 1, y: 0, duration: 0.55 }
      )
        .fromTo(
          ".hero-title",
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.65 },
          "-=0.4"
        )
        .fromTo(
          ".hero-desc",
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.55 },
          "-=0.45"
        )
        .fromTo(
          ".hero-cta-btn",
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.5, stagger: 0.1 },
          "-=0.35"
        )
        .fromTo(
          ".hero-trust-item",
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.45, stagger: 0.08 },
          "-=0.3"
        )
        .fromTo(
          ".hero-showcase",
          { opacity: 0, scale: 0.96, y: 14 },
          { opacity: 1, scale: 1, y: 0, duration: 0.75, ease: "power2.out" },
          "-=0.55"
        );

      // 2. Animated Counter Up
      const counterTarget = { value: 0 };
      gsap.to(counterTarget, {
        value: candidateCount,
        duration: 1.2,
        ease: "power2.out",
        delay: 0.25,
        onUpdate: () => {
          const val = Math.round(counterTarget.value);
          if (desktopCounterRef.current) {
            desktopCounterRef.current.textContent = String(val);
          }
          if (mobileCounterRef.current) {
            mobileCounterRef.current.textContent = String(val);
          }
        },
      });
    },
    { scope: containerRef, dependencies: [candidateCount] }
  );

  return (
    <section
      ref={containerRef}
      className={cn(
        "relative overflow-hidden border-b border-[#E2E8F0] bg-[#FFF5F3]",
        className
      )}
    >
      {/* Ambient radial glow & subtle lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top_right,rgba(217,56,41,0.08)_0%,transparent_60%),radial-gradient(ellipse_at_bottom_left,rgba(254,242,242,0.9)_0%,transparent_65%)]"
      />
      {/* Subtle geometric dot grid overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(#D93829_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.035]"
      />

      {/* Mobile top banner illustration blending into #FFF5F3 (< lg) */}
      <div className="relative h-52 w-full overflow-hidden bg-[#F1F5F9] sm:h-64 lg:hidden">
        <Image
          src={resolvedHero}
          alt="Ilustrasi bendera dan kotak suara pemilihan"
          fill
          priority
          sizes="100vw"
          className="object-cover object-top"
          unoptimized
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#FFF5F3] via-[#FFF5F3]/60 to-transparent"
        />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-8 pt-4 sm:px-6 sm:py-10 md:py-12 lg:py-16">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-10 xl:gap-12">
          {/* Left Column: Eyebrow, Title, Description, CTAs, and Civic Trust Pillars */}
          <div className="max-w-xl lg:col-span-7">
            <div className="hero-eyebrow inline-flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-[#D93829]" aria-hidden="true" />
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#D93829]">
                PEMILIHAN RESMI &mdash; SATU ORANG, SATU SUARA
              </p>
            </div>

            <h1 className="hero-title mt-2.5 text-[30px] font-extrabold leading-[1.15] tracking-[-0.025em] text-[#0F172A] [text-wrap:balance] sm:text-4xl lg:text-[42px]">
              {lead}
              {accent && (
                <>
                  {" "}
                  <span className="text-[#D93829]">{accent}</span>
                </>
              )}
            </h1>

            <p className="hero-desc mt-3.5 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
              {description ||
                "Kenali calon ketua sebelum menentukan pilihan. Suara kamu dijaga kerahasiaannya dan hanya bisa digunakan satu kali."}
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                asChild
                size="lg"
                className="hero-cta-btn h-12 min-h-[48px] w-full rounded-[12px] bg-[#D93829] px-6 text-[15px] font-semibold text-white shadow-[0_6px_16px_-4px_rgba(217,56,41,0.35)] transition-all active:scale-[0.99] hover:bg-[#B8281B] hover:shadow-[0_8px_20px_-4px_rgba(217,56,41,0.45)] sm:w-auto"
              >
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2"
                >
                  <Inbox className="h-5 w-5" aria-hidden="true" />
                  <span>Masuk untuk memilih</span>
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                size="lg"
                className="hero-cta-btn h-12 min-h-[48px] w-full rounded-[12px] border-[#FECACA] bg-white px-6 text-[15px] font-semibold text-[#D93829] transition-all active:scale-[0.99] hover:border-[#FCA5A5] hover:bg-[#FFF0EE] hover:text-[#B8281B] sm:w-auto"
              >
                <Link
                  href="/admin/login"
                  className="inline-flex items-center justify-center gap-2"
                >
                  <Users className="h-5 w-5" aria-hidden="true" />
                  <span>Masuk sebagai panitia</span>
                </Link>
              </Button>
            </div>

            {/* 3 Jaminan Pemilihan (Civic Trust Pillars) */}
            <div className="mt-8 border-t border-[#E2E8F0]/80 pt-5 sm:mt-10">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-[#D93829]" aria-hidden="true" />
                <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#64748B]">
                  JAMINAN SISTEM ELEKTRONIK RESMI
                </p>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
                <div className="hero-trust-item flex items-start gap-2.5 rounded-xl border border-[#E2E8F0]/90 bg-white/80 p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.02)] backdrop-blur-[2px]">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#15803D]">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#0F172A]">1 Orang 1 Suara</div>
                    <div className="text-[11px] leading-tight text-[#64748B]">Kunci transaksi atomik</div>
                  </div>
                </div>

                <div className="hero-trust-item flex items-start gap-2.5 rounded-xl border border-[#E2E8F0]/90 bg-white/80 p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.02)] backdrop-blur-[2px]">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#0F172A]">Kerahasiaan Mutlak</div>
                    <div className="text-[11px] leading-tight text-[#64748B]">Surat suara anonim</div>
                  </div>
                </div>

                <div className="hero-trust-item flex items-start gap-2.5 rounded-xl border border-[#E2E8F0]/90 bg-white/80 p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.02)] backdrop-blur-[2px]">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FFF0EE] text-[#D93829]">
                    <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#0F172A]">Audit Anti-Curang</div>
                    <div className="text-[11px] leading-tight text-[#64748B]">Log jejak append-only</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile candidate counter card (< lg) */}
            <div className="mt-6 flex items-start gap-3.5 rounded-[16px] border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:max-w-md sm:p-5 lg:hidden">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF0EE] text-[#D93829]">
                <Users className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-extrabold leading-none text-[#0F172A] tabular-nums sm:text-[28px]">
                  <span ref={mobileCounterRef}>{candidateCount}</span>
                </div>
                <div className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[#64748B]">
                  CALON TERDAFTAR
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[#64748B]">
                  Pemilihan akan menentukan pemimpin masa depan sekolah kita.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Visual showcase card (lg: >= 1024px) */}
          <div className="hidden lg:col-span-5 lg:block">
            <div className="hero-showcase overflow-hidden rounded-[20px] border border-[#E2E8F0] bg-white p-3.5 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.08)]">
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[14px] bg-[#F1F5F9]">
                <Image
                  src={resolvedHero}
                  alt="Ilustrasi bendera dan kotak suara pemilihan"
                  fill
                  priority
                  sizes="(min-width: 1024px) 460px, 100vw"
                  className="object-cover object-center transition-transform duration-700 ease-out hover:scale-105"
                  unoptimized
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent"
                />
                <div className="absolute bottom-2.5 left-2.5 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-slate-900/60 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                  <span className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
                  <span>Pemungutan Suara Terpadu</span>
                </div>
              </div>

              {/* Showcase metric box */}
              <div className="mt-3.5 flex items-center justify-between rounded-[14px] border border-[#E2E8F0] bg-[#FFF5F3]/70 p-4">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFF0EE] text-[#D93829] shadow-sm">
                    <Users className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#64748B]">
                      CALON TERDAFTAR RESMI
                    </div>
                    <p className="mt-0.5 text-xs text-[#64748B]">
                      Telah diverifikasi dan siap dipilih
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    ref={desktopCounterRef}
                    className="text-3xl font-extrabold leading-none text-[#0F172A] tabular-nums"
                  >
                    {candidateCount}
                  </span>
                  <span className="block text-[11px] font-semibold text-[#D93829]">Kandidat</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
