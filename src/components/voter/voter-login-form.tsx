"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  User,
} from "lucide-react";
import { BrandHeader } from "@/components/shared/brand-header";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ApiResponse, ElectionStatus } from "@/types/votera";

const TOKEN_REGEX = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/;

export interface VoterLoginFormProps {
  electionId?: string;
  idLabel?: string;
  shortName?: string;
  title?: string;
  organizationName?: string;
  status?: ElectionStatus;
  logoUrl?: string | null;
  heroBannerUrl?: string | null;
}

interface LoginFormValues {
  voterIdentity: string;
  token: string;
}

interface VoterLoginSuccessPayload {
  voter?: {
    id: string;
    name: string;
    voterIdentity: string;
    groupName: string;
    hasVoted: boolean;
  };
  redirectTo?: string;
}

function splitHeroTitle(title: string): {
  prefix: string;
  highlight: string | null;
} {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    return { prefix: title.trim(), highlight: null };
  }
  const splitCount = words.length >= 4 ? 2 : 1;
  return {
    prefix: words.slice(0, words.length - splitCount).join(" "),
    highlight: words.slice(words.length - splitCount).join(" "),
  };
}

function createLoginSchema(idLabel: string) {
  return z.object({
    voterIdentity: z
      .string()
      .trim()
      .min(3, `${idLabel} minimal 3 karakter`)
      .max(50, `${idLabel} maksimal 50 karakter`),
    token: z
      .string()
      .trim()
      .toUpperCase()
      .length(8, "Token harus terdiri dari 8 karakter")
      .regex(
        TOKEN_REGEX,
        "Format token tidak valid (gunakan 8 karakter huruf/angka dari panitia)"
      ),
  });
}

export function VoterLoginForm({
  electionId,
  idLabel = "NIS",
  shortName = "PILKETOS 2026",
  title = "Pemilihan Ketua OSIS 2026",
  organizationName = "SMA Bojong Gede",
  status = "open",
  logoUrl,
  heroBannerUrl,
}: VoterLoginFormProps) {
  const router = useRouter();
  const [showToken, setShowToken] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const schema = React.useMemo(() => createLoginSchema(idLabel), [idLabel]);
  const { prefix: titlePrefix, highlight: titleHighlight } = React.useMemo(
    () => splitHeroTitle(title),
    [title]
  );

  const resolvedHeroBanner = heroBannerUrl || "/images/hero-flag-ballot.jpg";
  const resolvedLogo = logoUrl || "/images/logo-default.png";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      voterIdentity: "",
      token: "",
    },
  });

  const tokenField = register("token", {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      e.target.value = e.target.value.replace(/\s+/g, "").toUpperCase();
      if (serverError) setServerError(null);
    },
  });

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);

    try {
      const response = await fetch("/api/voter/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(electionId ? { electionId } : {}),
          voterIdentity: values.voterIdentity.trim(),
          token: values.token.trim().toUpperCase(),
        }),
      });

      let payload: ApiResponse<VoterLoginSuccessPayload> | null = null;
      try {
        payload =
          (await response.json()) as ApiResponse<VoterLoginSuccessPayload>;
      } catch {
        payload = null;
      }

      if (!response.ok || !payload || !payload.success) {
        const message =
          payload && !payload.success && payload.error?.message
            ? payload.error.message
            : `${idLabel} atau token tidak valid, atau sudah digunakan untuk memilih.`;
        setServerError(message);
        return;
      }

      const destination = payload.data?.redirectTo || "/vote";
      router.push(destination);
      router.refresh();
    } catch {
      setServerError(
        "Tidak dapat terhubung ke server. Periksa koneksi internet kamu dan coba lagi."
      );
    }
  }

  return (
    <section
      aria-label="Halaman masuk pemilih"
      className="flex min-h-screen w-full max-w-[440px] flex-col overflow-hidden bg-white sm:min-h-0 sm:rounded-[28px] sm:border sm:border-[#E2E8F0] sm:shadow-[0_20px_50px_rgba(15,23,42,0.10)]"
    >
      {/* Red Gradient Hero Header over Flag & Ballot Illustration */}
      <header className="relative overflow-hidden px-6 pb-14 pt-8 text-white">
        <Image
          src={resolvedHeroBanner}
          alt="Latar belakang pemilihan"
          fill
          priority
          sizes="440px"
          className="object-cover object-center"
          unoptimized
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-[#A8201A]/95 via-[#BF2921]/88 to-[#D6362C]/90"
        />

        {/* Subtle decorative ballot box motif */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-5 top-6 h-48 w-48 select-none opacity-15"
        >
          <svg
            className="h-full w-full fill-current text-white"
            viewBox="0 0 200 200"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M40 90 L160 90 L145 180 L55 180 Z" opacity="0.45" />
            <path d="M30 85 L170 85 L160 100 L40 100 Z" opacity="0.65" />
            <path d="M75 40 L125 40 L125 80 L75 80 Z" opacity="0.85" />
            <circle
              cx="100"
              cy="130"
              r="16"
              fill="none"
              stroke="white"
              strokeWidth="3"
              opacity="0.7"
            />
            <path
              d="M93 130 L100 123 L107 130 L100 137 Z"
              fill="white"
              opacity="0.85"
            />
          </svg>
        </div>

        <div className="relative z-10">
          <BrandHeader
            shortName={shortName}
            organizationName={organizationName}
            logoUrl={resolvedLogo}
            variant="onDark"
            size="md"
          />

          <div className="mt-6">
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-[26px]">
              {titlePrefix}
              {titleHighlight && (
                <>
                  <br />
                  <span className="text-[#FDE047]">{titleHighlight}</span>
                </>
              )}
            </h1>
          </div>
        </div>
      </header>

      {/* Overlapping White Form Card */}
      <div className="relative z-20 -mt-7 flex flex-1 flex-col justify-between rounded-t-[24px] bg-white px-6 pb-8 pt-6 shadow-[0_-8px_30px_rgba(15,23,42,0.08)]">
        <div>
          <StatusPill
            status={status}
            label={status === "open" ? "Pemungutan suara dibuka" : undefined}
            bordered
            className="mb-4"
          />

          <div className="mb-5">
            <h2 className="text-xl font-extrabold tracking-tight text-[#0F172A]">
              Masuk untuk memilih
            </h2>
            <p className="mt-1 text-[13px] leading-snug text-[#64748B]">
              Gunakan {idLabel} dan token yang dibagikan panitia kepada kamu.
            </p>
          </div>

          {serverError && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded-[12px] border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-3 text-[13px] font-medium text-[#DC2626]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="voterIdentity"
                className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#334155]"
              >
                {idLabel}
              </label>
              <Input
                id="voterIdentity"
                type="text"
                inputSize="lg"
                autoComplete="username"
                placeholder={`Masukkan ${idLabel} kamu`}
                leftIcon={<User className="h-[18px] w-[18px]" />}
                aria-invalid={Boolean(errors.voterIdentity)}
                className={cn(
                  "tabular-nums rounded-[12px]",
                  errors.voterIdentity &&
                    "border-[#DC2626] bg-[#FEF2F2]/40 focus-visible:border-[#DC2626] focus-visible:ring-[#DC2626]/20"
                )}
                {...register("voterIdentity", {
                  onChange: () => {
                    if (serverError) setServerError(null);
                  },
                })}
              />
              {errors.voterIdentity && (
                <p className="mt-1.5 text-xs font-medium text-[#DC2626]">
                  {errors.voterIdentity.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="token"
                className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#334155]"
              >
                Token
              </label>
              <Input
                id="token"
                type={showToken ? "text" : "password"}
                inputSize="lg"
                maxLength={8}
                autoComplete="current-password"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="Contoh: JUFT88TF"
                leftIcon={<Lock className="h-[18px] w-[18px]" />}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowToken((prev) => !prev)}
                    aria-label={
                      showToken ? "Sembunyikan token" : "Tampilkan token"
                    }
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[#64748B] transition-colors hover:text-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]/30"
                  >
                    {showToken ? (
                      <EyeOff className="h-[18px] w-[18px]" />
                    ) : (
                      <Eye className="h-[18px] w-[18px]" />
                    )}
                  </button>
                }
                aria-invalid={Boolean(errors.token)}
                className={cn(
                  "rounded-[12px] font-mono uppercase tracking-wider placeholder:font-sans placeholder:normal-case placeholder:tracking-normal",
                  errors.token &&
                    "border-[#DC2626] bg-[#FEF2F2]/40 focus-visible:border-[#DC2626] focus-visible:ring-[#DC2626]/20"
                )}
                {...tokenField}
              />
              {errors.token && (
                <p className="mt-1.5 text-xs font-medium text-[#DC2626]">
                  {errors.token.message}
                </p>
              )}
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                className="min-h-[48px] w-full rounded-[12px] bg-[#D93829] text-sm font-bold tracking-wide text-white shadow-md shadow-[#D93829]/20 hover:bg-[#B8281B]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Memverifikasi...</span>
                  </>
                ) : (
                  <span>Masuk</span>
                )}
              </Button>
            </div>
          </form>
        </div>

        <footer className="mt-8 border-t border-[#F1F5F9] pt-4 text-center">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg px-3 text-xs font-semibold text-[#334155] transition-colors hover:text-[#D93829] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]/30"
          >
            ← Kembali ke beranda
          </Link>
          <p className="mt-1 text-xs text-[#64748B]">
            Lupa token? Hubungi panitia.
          </p>
        </footer>
      </div>
    </section>
  );
}
