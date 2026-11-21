"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Activity,
  AlertCircle,
  Database,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { BrandHeader } from "@/components/shared/brand-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/admin-client";
import { cn } from "@/lib/utils";

const adminLoginFormSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(3, "Username atau email minimal 3 karakter")
    .max(120, "Username atau email terlalu panjang"),
  password: z.string().min(1, "Password wajib diisi"),
});

type AdminLoginFormValues = z.infer<typeof adminLoginFormSchema>;

export interface AdminLoginFormProps {
  shortName?: string;
  organizationName?: string;
  logoUrl?: string | null;
}

export function AdminLoginForm({
  shortName = "PILKETOS 2026",
  organizationName = "SMA Bojong Gede",
  logoUrl,
}: AdminLoginFormProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AdminLoginFormValues>({
    resolver: zodResolver(adminLoginFormSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  async function onSubmit(values: AdminLoginFormValues) {
    setServerError(null);
    const trimmedIdentifier = values.identifier.trim();

    try {
      const result = trimmedIdentifier.includes("@")
        ? await authClient.signIn.email({
            email: trimmedIdentifier,
            password: values.password,
          })
        : await authClient.signIn.username({
            username: trimmedIdentifier.replace(/^@+/, ""),
            password: values.password,
          });

      if (result.error) {
        const status = result.error.status;
        const code = result.error.code;

        if (status === 429) {
          setServerError(
            "Terlalu banyak percobaan login. Silakan tunggu beberapa menit sebelum mencoba lagi."
          );
          return;
        }

        if (status === 403 || code === "BANNED_USER") {
          setServerError(
            "Akun panitia ini sedang dinonaktifkan. Hubungi Super Admin."
          );
          return;
        }

        setServerError(
          "Username/email atau password salah. Silakan periksa kembali."
        );
        return;
      }

      router.push("/admin/dashboard");
      router.refresh();
    } catch {
      setServerError(
        "Tidak dapat terhubung ke server. Periksa koneksi internet kamu dan coba lagi."
      );
    }
  }

  return (
    <section
      aria-label="Halaman masuk panel panitia"
      className="w-full max-w-[440px] overflow-hidden rounded-[20px] border border-[#E2E8F0] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.08)] lg:max-w-5xl lg:grid lg:grid-cols-12 lg:items-stretch lg:rounded-[24px] lg:shadow-[0_25px_60px_-15px_rgba(15,23,42,0.12)]"
    >
      {/* Mobile Top Branding Bar (< 1024px) */}
      <div className="border-b border-[#E2E8F0] bg-[#FFF5F3] px-6 py-5 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <BrandHeader
            shortName={shortName}
            organizationName={organizationName}
            logoUrl={logoUrl}
            size="md"
          />
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#FECACA] bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#D93829]">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Panel</span>
          </span>
        </div>
      </div>

      {/* Left Column: Institutional Command Panel (Desktop >= 1024px) */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] p-8 text-white lg:col-span-7 lg:flex xl:p-10">
        {/* Subtle Crimson Red #D93829 ambient glow accents */}
        <div
          className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-[#D93829]/15 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-[#D93829]/10 blur-3xl"
          aria-hidden="true"
        />
        {/* Micro-dot institutional pattern overlay */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(#475569_1px,transparent_1px)] [background-size:20px_20px] opacity-25"
          aria-hidden="true"
        />

        {/* Top: Branding & Title */}
        <div className="relative z-10 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <BrandHeader
              shortName={shortName}
              organizationName={organizationName}
              logoUrl={logoUrl}
              variant="onDark"
              size="md"
            />
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-rose-100 backdrop-blur-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-[#F87171]" aria-hidden="true" />
              <span>PANEL PANITIA PELAKSANA — KONTROL RESMI</span>
            </div>
          </div>

          <div className="pt-2">
            <h2 className="text-2xl font-extrabold leading-tight tracking-tight text-white lg:text-3xl">
              Pusat Komando &amp; Audit Pemilihan Digital
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Panel administrasi terpadu untuk pengawasan integritas suara, pengelolaan DPT, dan pencatatan audit log mutasi secara permanen.
            </p>
          </div>
        </div>

        {/* Middle: 3 Key Institutional Security Highlights */}
        <div className="relative z-10 my-6 space-y-3">
          <div className="rounded-[14px] border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-white/[0.07]">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#D93829]/40 bg-[#D93829]/20 text-rose-300">
                <Database className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-rose-300/80 tabular-nums">01.</span>
                  <h3 className="text-sm font-bold text-white">Audit Trail Append-Only</h3>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-300">
                  Seluruh mutasi DPT, login, dan aktivitas dicatat ke log permanen dengan stempel waktu detik &amp; alamat IP.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[14px] border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-white/[0.07]">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#D93829]/40 bg-[#D93829]/20 text-rose-300">
                <Activity className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-rose-300/80 tabular-nums">02.</span>
                  <h3 className="text-sm font-bold text-white">Real-Time Polling Engine</h3>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-300">
                  Hasil agregasi suara terhitung otomatis dengan polling berkala tanpa membebani server.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[14px] border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-white/[0.07]">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#D93829]/40 bg-[#D93829]/20 text-rose-300">
                <Users className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-rose-300/80 tabular-nums">03.</span>
                  <h3 className="text-sm font-bold text-white">Multi-Role RBAC</h3>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-300">
                  Pemisahan hak akses granular antara Super Admin dan Panitia Pelaksana.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: Institutional status badge */}
        <div className="relative z-10 pt-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/60 px-3.5 py-1.5 text-xs font-semibold text-emerald-300 backdrop-blur-sm">
            <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span>● Sistem Kriptografi &amp; Sesi Aktif</span>
          </div>
        </div>
      </div>

      {/* Right Column: Authentication Form */}
      <div className="flex flex-col justify-between bg-white px-6 py-7 sm:px-8 sm:py-8 lg:col-span-5 lg:p-10">
        <div>
          <div className="mb-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#D93829]">
              AUTENTIKASI PETUGAS
            </p>
            <h1 className="mt-1 text-xl font-extrabold tracking-tight text-[#0F172A] sm:text-2xl">
              Masuk Panel Panitia
            </h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#64748B]">
              Masuk menggunakan akun Super Admin atau Panitia Pelaksana untuk
              mengelola pemilihan.
            </p>
          </div>

          {serverError && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-[12px] border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-3 text-[13px] font-medium text-[#DC2626]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
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
                htmlFor="identifier"
                className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#334155]"
              >
                Username atau Email
              </label>
              <Input
                id="identifier"
                type="text"
                inputSize="lg"
                autoComplete="username"
                placeholder="Contoh: admin atau admin@sekolah.sch.id"
                leftIcon={<User className="h-[18px] w-[18px]" />}
                aria-invalid={Boolean(errors.identifier)}
                className={cn(
                  "rounded-[12px] tabular-nums",
                  errors.identifier &&
                    "border-[#DC2626] bg-[#FEF2F2]/40 focus-visible:border-[#DC2626] focus-visible:ring-[#DC2626]/20"
                )}
                {...register("identifier", {
                  onChange: () => {
                    if (serverError) setServerError(null);
                  },
                })}
              />
              {errors.identifier && (
                <p className="mt-1.5 text-xs font-medium text-[#DC2626] tabular-nums">
                  {errors.identifier.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#334155]"
              >
                Password
              </label>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                inputSize="lg"
                autoComplete="current-password"
                placeholder="Masukkan password"
                leftIcon={<Lock className="h-[18px] w-[18px]" />}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword ? "Sembunyikan password" : "Tampilkan password"
                    }
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[#64748B] transition-colors hover:text-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]/30"
                  >
                    {showPassword ? (
                      <EyeOff className="h-[18px] w-[18px]" />
                    ) : (
                      <Eye className="h-[18px] w-[18px]" />
                    )}
                  </button>
                }
                aria-invalid={Boolean(errors.password)}
                className={cn(
                  "rounded-[12px] tabular-nums",
                  errors.password &&
                    "border-[#DC2626] bg-[#FEF2F2]/40 focus-visible:border-[#DC2626] focus-visible:ring-[#DC2626]/20"
                )}
                {...register("password", {
                  onChange: () => {
                    if (serverError) setServerError(null);
                  },
                })}
              />
              {errors.password && (
                <p className="mt-1.5 text-xs font-medium text-[#DC2626] tabular-nums">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                className="h-12 w-full rounded-[12px] bg-[#D93829] text-sm font-bold tracking-wide text-white shadow-md shadow-[#D93829]/20 hover:bg-[#B8281B]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Memverifikasi...</span>
                  </>
                ) : (
                  <span>Masuk ke Panel</span>
                )}
              </Button>
            </div>
          </form>
        </div>

        <footer className="mt-6 border-t border-[#F1F5F9] pt-4 text-center">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg px-3 text-xs font-semibold text-[#334155] transition-colors hover:text-[#D93829] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]/30"
          >
            ← Kembali ke beranda pemilih
          </Link>
        </footer>
      </div>
    </section>
  );
}
