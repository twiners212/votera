"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Shield,
  Check,
  LogOut,
  Users,
  Lock,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface VoterSessionData {
  authenticated: boolean;
  voter: {
    id: string;
    name: string;
    voterIdentity: string;
    hasVoted: boolean;
    groupName: string | null;
  } | null;
  election: {
    id: string;
    title: string;
    shortName: string;
    organizationName: string;
  } | null;
}

export default function VoteThanksPage() {
  const router = useRouter();

  const { data: sessionData, isLoading } = useQuery<VoterSessionData>({
    queryKey: ["voter", "session"],
    queryFn: async () => {
      const res = await fetch("/api/voter/session");
      if (!res.ok) throw new Error("Gagal mengambil status sesi.");
      return res.json();
    },
  });

  const handleLogout = async () => {
    try {
      await fetch("/api/voter/logout", { method: "POST" });
      window.location.href = "/";
    } catch {
      window.location.href = "/";
    }
  };

  const voter = sessionData?.voter;
  const election = sessionData?.election;

  return (
    <div className="bg-white text-slate-900 font-sans min-h-screen flex flex-col justify-between overflow-x-hidden antialiased">
      {/* Top Navbar (Matching Stitch Screen 03) */}
      <header className="w-full bg-white border-b border-slate-100 z-30 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border border-amber-300 bg-amber-50 flex items-center justify-center shadow-xs">
              <Shield className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="font-extrabold text-base tracking-tight leading-tight text-slate-900">
                {election?.shortName || "PILKETOS"}{" "}
                <span className="text-primary">2026</span>
              </div>
              <div className="text-xs font-semibold text-slate-500 leading-none mt-0.5">
                {election?.organizationName || "SMA Bojong Gede"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:inline-flex items-center gap-2 bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] rounded-full px-3.5 py-1 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              <span>Pemungutan suara dibuka</span>
            </div>

            {voter && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#FCE8E6] text-primary text-xs font-extrabold flex items-center justify-center shadow-xs">
                  {voter.name[0]?.toUpperCase()}
                </div>
                <div className="text-left hidden md:block">
                  <div className="text-xs font-bold text-slate-800 leading-tight">
                    {voter.name}
                  </div>
                  <div className="text-[11px] font-medium text-slate-400 leading-none mt-0.5">
                    {voter.groupName || "DPT"}
                  </div>
                </div>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-1.5 text-xs font-bold text-slate-700 h-9"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" />
              <span>Keluar</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Confirmation Content (Matching Stitch Screen 03) */}
      <main className="relative flex-1 flex flex-col justify-center items-center overflow-hidden py-14 px-4 sm:px-6">
        <div className="relative z-20 max-w-xl mx-auto flex flex-col items-center text-center">
          {/* Success Checkmark Seal Badge */}
          <div className="w-16 h-16 rounded-full bg-[#1F7A4C] flex items-center justify-center shadow-xl shadow-emerald-700/25 mb-5 transform transition-transform hover:scale-105 duration-200">
            <Check className="w-8 h-8 text-white stroke-[3.5]" />
          </div>

          {/* Eyebrow */}
          <p className="text-xs font-extrabold uppercase tracking-widest text-primary mb-2.5">
            Suara Tercatat
          </p>

          {/* Main Confirmation Heading */}
          <h1 className="text-3xl md:text-4xl lg:text-[42px] font-black tracking-tight text-slate-900 leading-tight mb-4">
            Terima kasih,
            <br />
            <span className="text-primary">{voter?.name || "Pemilih Hebat"}!</span>
          </h1>

          {/* Description */}
          <p className="text-slate-600 text-sm md:text-base font-normal max-w-md mx-auto leading-relaxed mb-8">
            Suara kamu sudah tersimpan dan dijaga kerahasiaannya secara anonim. Hasil resmi pemilihan akan diumumkan oleh panitia setelah pemungutan suara berakhir.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-sm">
            <Button
              onClick={handleLogout}
              className="w-full sm:w-auto bg-primary hover:bg-primary-hover text-white text-sm font-bold py-3.5 px-8 rounded-xl shadow-md shadow-red-500/25 transition h-12"
            >
              Selesai & Keluar
            </Button>

            <Link href="/candidates" className="w-full sm:w-auto">
              <Button
                variant="outline"
                className="w-full sm:w-auto border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-bold py-3.5 px-7 rounded-xl shadow-xs transition h-12 gap-1.5"
              >
                <Users className="w-4 h-4 text-primary" />
                Lihat Kandidat
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Curved Crimson Footer (Matching Stitch Screen 03) */}
      <footer className="w-full relative z-20">
        <div className="w-full overflow-hidden leading-none">
          <svg
            className="relative block w-full h-12 md:h-16 text-primary"
            fill="currentColor"
            preserveAspectRatio="none"
            viewBox="0 0 1440 80"
          >
            <path d="M0,32L80,37.3C160,43,320,53,480,48C640,43,800,21,960,16C1120,11,1280,21,1360,26.7L1440,32L1440,80L1360,80C1280,80,1120,80,960,80C800,80,640,80,480,80C320,80,160,80,80,80L0,80Z" />
          </svg>
        </div>
        <div className="bg-primary pb-8 pt-2 px-6 sm:px-8 text-white">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center text-white">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider">
                  {election?.shortName || "PILKETOS 2026"}
                </div>
                <div className="text-[11px] text-white/80 font-medium">
                  {election?.organizationName || "SMA Bojong Gede"}
                </div>
              </div>
            </div>

            <div className="text-center md:text-right text-xs text-white/90">
              <p>Sistem Pemilihan Terpadu & Rahasia — Votera © 2026</p>
              <p className="text-[11px] text-white/70 mt-0.5">
                Audit log immutable & kerahasiaan suara terjamin.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
