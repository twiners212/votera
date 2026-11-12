import Image from "next/image";
import Link from "next/link";
import { Inbox, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
 * Public landing hero banner with #FFF5F3 warm tint, official eyebrow,
 * primary/secondary login actions (>=48px tap target), and tabular candidate counter card.
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

  return (
    <section
      className={cn(
        "relative overflow-hidden border-b border-[#E2E8F0] bg-[#FFF5F3]",
        className
      )}
    >
      {/* Mobile top banner illustration blending into #FFF5F3 */}
      <div className="relative h-52 w-full overflow-hidden bg-[#F1F5F9] sm:h-64 md:hidden">
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

      {/* Desktop right-side hero illustration with horizontal fade-out mask */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[62%] md:block"
      >
        <Image
          src={resolvedHero}
          alt=""
          fill
          priority
          sizes="62vw"
          className="object-cover object-center"
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#FFF5F3] via-[#FFF5F3]/85 to-[#FFF5F3]/15" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-8 pt-3 sm:px-6 md:py-12 lg:py-14">
        <div className="max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#D93829] sm:text-xs">
            PEMILIHAN RESMI &mdash; SATU ORANG, SATU SUARA
          </p>

          <h1 className="mt-2.5 text-[30px] font-extrabold leading-[1.15] tracking-[-0.025em] text-[#0F172A] sm:text-4xl lg:text-[42px]">
            {lead}
            {accent && (
              <>
                {" "}
                <span className="text-[#D93829]">{accent}</span>
              </>
            )}
          </h1>

          <p className="mt-3.5 text-sm leading-relaxed text-[#475569] sm:text-base">
            {description ||
              "Kenali calon ketua sebelum menentukan pilihan. Suara kamu dijaga kerahasiaannya dan hanya bisa digunakan satu kali."}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="min-h-[48px] w-full rounded-[12px] bg-[#D93829] px-6 text-[15px] font-semibold text-white shadow-[0_6px_16px_-4px_rgba(217,56,41,0.35)] hover:bg-[#B8281B] sm:w-auto"
            >
              <Link href="/login">
                <Inbox className="h-5 w-5" aria-hidden="true" />
                <span>Masuk untuk memilih</span>
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              size="lg"
              className="min-h-[48px] w-full rounded-[12px] border-[#FECACA] bg-white px-6 text-[15px] font-semibold text-[#D93829] hover:border-[#FCA5A5] hover:bg-[#FFF0EE] hover:text-[#B8281B] sm:w-auto"
            >
              <Link href="/admin/login">
                <Users className="h-5 w-5" aria-hidden="true" />
                <span>Masuk sebagai panitia</span>
              </Link>
            </Button>
          </div>

          <div className="mt-6 flex items-start gap-3.5 rounded-[16px] border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:max-w-md sm:p-5">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF0EE] text-[#D93829]">
              <Users className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-extrabold leading-none text-[#0F172A] tabular-nums sm:text-[28px]">
                {candidateCount}
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
      </div>
    </section>
  );
}
