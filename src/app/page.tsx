"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Vote,
  Users,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Lock,
  ExternalLink,
  Shield,
  Loader2,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { queryKeys } from "@/lib/query-keys";

interface PublicElectionData {
  election: {
    id: string;
    title: string;
    shortName: string;
    organizationName: string;
    description: string;
    status: string;
    startAt: string | null;
    endAt: string | null;
  };
  settings: {
    idLabel: string;
    groupLabel: string;
  } | null;
  candidates: Array<{
    id: string;
    candidateNumber: number;
    name: string;
    classOrUnit: string;
    motto: string;
    photoUrl: string | null;
    themeColor: string;
    isActive: boolean;
  }>;
  isWithinSchedule: boolean;
}

export default function HomePage() {
  const { data, isLoading } = useQuery<{ success: boolean; data: PublicElectionData }>({
    queryKey: queryKeys.election.active(),
    queryFn: async () => {
      const res = await fetch("/api/public/election");
      if (!res.ok) throw new Error("Gagal memuat pemilihan.");
      return res.json();
    },
  });

  const election = data?.data?.election;
  const candidates = (data?.data?.candidates || []).filter((c) => c.isActive);
  const isWithinSchedule = data?.data?.isWithinSchedule ?? true;

  const getCandidateBadgeColor = (color: string) => {
    switch (color) {
      case "red":
        return "bg-rose-50 text-red-600 border-red-200";
      case "green":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "blue":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "amber":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1E293B] antialiased flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="w-full bg-white/95 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border border-amber-300 bg-amber-50 p-1 flex items-center justify-center shrink-0 shadow-xs">
              <Shield className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-sm font-extrabold tracking-tight text-slate-900 leading-none">
                {election?.shortName || "PILKETOS"}{" "}
                <span className="text-primary">2026</span>
              </h1>
              <span className="text-xs text-slate-500 font-medium mt-0.5">
                {election?.organizationName || "SMA Bojong Gede"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isWithinSchedule ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Pemungutan Dibuka</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span>Pemungutan Ditutup</span>
              </div>
            )}

            <Link
              href="/admin/login"
              className="text-xs text-slate-500 hover:text-primary transition-colors hidden sm:block"
            >
              Panel Panitia →
            </Link>
          </div>
        </div>
      </header>

      {/* Main Hero & Content Container (Responsive Mobile Card + Desktop Center) */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-6 sm:py-10 flex flex-col justify-center">
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
          {/* Hero Banner Header Graphic */}
          <div className="relative w-full h-48 sm:h-56 bg-gradient-to-br from-[#9E1B15] via-[#C8322B] to-[#DB382F] p-6 text-white flex flex-col justify-between overflow-hidden">
            {/* Background Emblem Watermark */}
            <div className="absolute -right-8 -bottom-8 w-56 h-56 opacity-10 pointer-events-none select-none">
              <Vote className="w-full h-full text-white" />
            </div>

            <div className="relative z-10">
              <Badge
                variant="outline"
                className="bg-white/15 text-white border-white/20 text-[10px] font-semibold tracking-wider uppercase mb-2"
              >
                Pemilihan Resmi • Satu Orang, Satu Suara
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
                {election?.title || "Pemilihan Ketua OSIS 2026"}
              </h2>
            </div>

            <p className="relative z-10 text-xs sm:text-sm text-rose-100/90 leading-relaxed max-w-md">
              {election?.description ||
                "Kenali calon ketua sebelum menentukan pilihan. Suara kamu dijaga kerahasiaannya dan hanya bisa digunakan satu kali."}
            </p>
          </div>

          {/* Action & Candidates Section */}
          <div className="p-6 sm:p-8 space-y-6 bg-[#FAF9F7]/60">
            {/* Primary Action Buttons */}
            <div className="flex flex-col gap-3">
              <Link href="/login" className="w-full">
                <Button
                  className="w-full h-12 bg-primary hover:bg-primary-hover text-white font-semibold text-sm shadow-md transition-all gap-2"
                  size="lg"
                >
                  <Vote className="w-5 h-5" />
                  Masuk untuk Memilih
                </Button>
              </Link>

              <Link href="/candidates" className="w-full">
                <Button
                  variant="outline"
                  className="w-full h-12 border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm transition-all gap-2"
                  size="lg"
                >
                  <Users className="w-5 h-5 text-primary" />
                  Lihat Profil & Visi Misi Kandidat
                </Button>
              </Link>
            </div>

            {/* Candidates Quick Overview Card */}
            <Card className="border-border shadow-xs bg-white">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Kandidat Paslon ({candidates.length})
                  </span>
                  <Link
                    href="/candidates"
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    Eksplorasi
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {candidates.map((c) => (
                    <Link
                      key={c.id}
                      href={`/candidates/${c.candidateNumber}`}
                      className="p-2.5 rounded-xl border border-border bg-slate-50/70 hover:bg-white hover:border-primary/40 hover:shadow-xs transition-all flex flex-col items-center text-center group"
                    >
                      <div className="w-12 h-12 rounded-lg bg-slate-200 overflow-hidden mb-2 relative border border-slate-200">
                        {c.photoUrl ? (
                          <img
                            src={c.photoUrl}
                            alt={c.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-xs text-slate-500">
                            #{c.candidateNumber}
                          </div>
                        )}
                        <span
                          className={`absolute top-0 left-0 text-[10px] font-bold px-1.5 py-0.5 rounded-br-md border-r border-b ${getCandidateBadgeColor(
                            c.themeColor
                          )}`}
                        >
                          #{c.candidateNumber}
                        </span>
                      </div>
                      <p className="font-bold text-slate-800 text-xs line-clamp-1 group-hover:text-primary transition-colors">
                        {c.name}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{c.classOrUnit}</p>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Civic Trust Security Guarantee */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-primary" />
                Jaminan Kerahasiaan & Keamanan Suara
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Pilihan suara kamu disimpan secara anonim tanpa mencatat nomor identitas, NIS, atau alamat IP. Setiap pemilih hanya dapat mengirim 1 kali suara digital.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-400 border-t border-slate-200/60 bg-white">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Votera © 2026 • Platform E-Voting Terpadu & Rahasia</span>
          <div className="flex items-center gap-4 text-[11px]">
            <Link href="/candidates" className="hover:text-slate-600 transition-colors">
              Kandidat
            </Link>
            <Link href="/login" className="hover:text-slate-600 transition-colors">
              Bilik Suara
            </Link>
            <Link href="/admin/login" className="hover:text-slate-600 transition-colors">
              Panel Pengawas
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
