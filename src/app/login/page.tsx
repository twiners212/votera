"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Vote,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
  AlertCircle,
  Shield,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function VoterLoginPage() {
  const router = useRouter();
  const [voterIdentity, setVoterIdentity] = React.useState("");
  const [token, setToken] = React.useState("");
  const [showToken, setShowToken] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = React.useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanNis = voterIdentity.trim();
    const cleanToken = token.trim().toUpperCase();

    if (!cleanNis || !cleanToken) {
      setErrorMessage("Nomor identitas (NIS) dan Token wajib diisi.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/voter/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voterIdentity: cleanNis,
          token: cleanToken,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorMessage(json.message || "Gagal masuk ke sistem pemilihan.");
        if (json.remainingAttempts !== undefined) {
          setRemainingAttempts(json.remainingAttempts);
        }
        toast.error("Gagal Masuk", { description: json.message });
        setIsLoading(false);
        return;
      }

      toast.success("Login Berhasil", {
        description: `Selamat datang, ${json.voter.name}!`,
      });

      // Redirect ke surat suara atau bukti suara jika sudah memilih
      window.location.href = json.redirectUrl || "/vote";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan sistem saat mencoba masuk.";
      setErrorMessage(msg);
      toast.error("Kesalahan", { description: msg });
      setIsLoading(false);
    }
  };

  const fillQuickAccount = (nis: string, tkn: string) => {
    setVoterIdentity(nis);
    setToken(tkn);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-[#ECEBE9] flex items-center justify-center p-0 sm:py-6">
      <main className="w-full max-w-[430px] min-h-screen sm:min-h-[820px] bg-[#FAF9F7] sm:rounded-[36px] overflow-hidden shadow-2xl relative flex flex-col justify-between">
        {/* Top Header Banner with Red Gradient (Matching Stitch Screen 06) */}
        <header className="relative bg-gradient-to-br from-[#9E1B15] via-[#C52B22] to-[#DB382F] pt-7 pb-12 px-6 text-white overflow-hidden select-none">
          {/* Decorative Ballot Watermark */}
          <div className="absolute -right-6 top-6 w-52 h-52 pointer-events-none opacity-15 select-none">
            <Vote className="w-full h-full text-white" />
          </div>

          {/* School Crest & Event Title */}
          <div className="relative z-10 flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 border-2 border-amber-300 p-1 flex items-center justify-center shrink-0 shadow-xs">
                <Shield className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="text-sm font-extrabold tracking-wide uppercase flex items-center gap-1.5 leading-none">
                  <span>PILKETOS</span>
                  <span className="text-[#FDE047]">2026</span>
                </div>
                <div className="text-xs text-rose-100 font-medium mt-0.5 opacity-90">
                  SMA Bojong Gede
                </div>
              </div>
            </div>

            <Link
              href="/"
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
              title="Kembali ke Beranda"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>

          {/* Display Heading */}
          <div className="relative z-10 mt-2">
            <h1 className="text-2xl font-extrabold leading-tight text-white tracking-tight">
              Pemilihan Ketua<br />
              <span className="text-[#FDE047]">OSIS 2026</span>
            </h1>
          </div>
        </header>

        {/* Form Card Section (-mt-7 rounded-t-[28px]) */}
        <section className="flex-1 bg-white rounded-t-[28px] -mt-7 relative z-20 px-6 pt-6 pb-6 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] flex flex-col justify-between">
          <div>
            {/* Poll Status Pill */}
            <div className="inline-flex items-center gap-2 bg-[#ECFDF5] border border-emerald-200/80 text-[#047857] text-[11px] font-semibold px-3 py-1 rounded-full mb-4">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              <span>Pemungutan suara dibuka</span>
            </div>

            <div className="mb-5">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Masuk untuk memilih
              </h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Gunakan nomor identitas (NIS) dan token akses 8 karakter yang dibagikan panitia kepada kamu.
              </p>
            </div>

            {/* Error Message Alert */}
            {errorMessage && (
              <div className="p-3.5 mb-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">{errorMessage}</p>
                  {remainingAttempts !== null && remainingAttempts > 0 && (
                    <p className="text-[11px] text-red-700">
                      Sisa percobaan: <strong>{remainingAttempts} kali</strong> sebelum akun dikunci sementara.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* NIS Field */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  NIS / Nomor Identitas
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="Masukkan NIS kamu"
                    value={voterIdentity}
                    onChange={(e) => setVoterIdentity(e.target.value)}
                    disabled={isLoading}
                    className="pl-10 h-12 text-sm bg-slate-50/60 border-slate-200 focus:bg-white rounded-xl"
                  />
                </div>
              </div>

              {/* Token Field */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  Token Akses (8 Karakter)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type={showToken ? "text" : "password"}
                    required
                    placeholder="Contoh: JUFT88TF"
                    value={token}
                    onChange={(e) => setToken(e.target.value.toUpperCase())}
                    disabled={isLoading}
                    className="pl-10 pr-10 h-12 text-sm uppercase font-mono tracking-wider bg-slate-50/60 border-slate-200 focus:bg-white rounded-xl"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit CTA */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-primary hover:bg-primary-hover text-white font-bold text-sm rounded-xl shadow-md transition-all gap-2 mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Memverifikasi...
                  </>
                ) : (
                  <>
                    <Vote className="w-4 h-4" />
                    Masuk ke Bilik Suara
                  </>
                )}
              </Button>
            </form>

            {/* Quick Demo DPT Preset Helper */}
            <div className="mt-5 pt-4 border-t border-dashed border-slate-200">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center mb-2">
                Akun Demo Pemilih DPT
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => fillQuickAccount("2324001", "JUFT88TF")}
                  className="p-2 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-left transition-colors"
                >
                  <p className="font-semibold text-slate-800 text-[11px] truncate">Aditya Pratama</p>
                  <p className="font-mono text-[10px] text-slate-500">2324001 • JUFT88TF</p>
                </button>
                <button
                  type="button"
                  onClick={() => fillQuickAccount("2324011", "P8TYM5KR")}
                  className="p-2 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-left transition-colors"
                >
                  <p className="font-semibold text-slate-800 text-[11px] truncate">Anisa Rahmawati</p>
                  <p className="font-mono text-[10px] text-slate-500">2324011 • P8TYM5KR</p>
                </button>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="pt-4 text-center text-[11px] text-slate-400 border-t border-slate-100">
            Kerahasiaan pilihan kamu terjamin penuh secara anonim.
          </div>
        </section>
      </main>
    </div>
  );
}
