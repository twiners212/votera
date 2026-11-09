"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Vote,
  Shield,
  CheckCircle2,
  Sparkles,
  Target,
  Award,
  Loader2,
  AlertCircle,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { queryKeys } from "@/lib/query-keys";

interface CandidateDetail {
  id: string;
  candidateNumber: number;
  name: string;
  classOrUnit: string;
  motto: string;
  vision: string;
  missions: string[];
  programs: string[];
  supporters: string[];
  photoUrl: string | null;
  themeColor: "red" | "green" | "blue" | "amber";
  isActive: boolean;
}

export default function CandidateDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const { data, isLoading, error } = useQuery<{ success: boolean; data: CandidateDetail }>({
    queryKey: queryKeys.candidates.detail(id),
    queryFn: async () => {
      const res = await fetch(`/api/public/candidates/${id}`);
      if (!res.ok) throw new Error("Gagal memuat profil kandidat.");
      return res.json();
    },
    enabled: !!id,
  });

  const candidate = data?.data;

  const getThemeStyles = (color?: string) => {
    switch (color) {
      case "red":
        return {
          badge: "bg-[#D6362C] text-white",
          accentText: "text-[#D6362C]",
          sweep: "from-transparent via-[#D6362C]/60 to-[#D6362C]",
          border: "border-red-200",
        };
      case "green":
        return {
          badge: "bg-[#10B981] text-white",
          accentText: "text-emerald-700",
          sweep: "from-transparent via-emerald-600/60 to-emerald-700",
          border: "border-emerald-200",
        };
      case "blue":
        return {
          badge: "bg-[#2563EB] text-white",
          accentText: "text-blue-700",
          sweep: "from-transparent via-blue-600/60 to-blue-700",
          border: "border-blue-200",
        };
      case "amber":
        return {
          badge: "bg-[#F59E0B] text-white",
          accentText: "text-amber-700",
          sweep: "from-transparent via-amber-600/60 to-amber-700",
          border: "border-amber-200",
        };
      default:
        return {
          badge: "bg-slate-700 text-white",
          accentText: "text-slate-800",
          sweep: "from-transparent via-slate-600/60 to-slate-700",
          border: "border-slate-200",
        };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex flex-col items-center justify-center p-4">
        <div className="p-6 rounded-2xl bg-white border border-red-200 text-center max-w-sm w-full space-y-3">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto" />
          <h3 className="font-bold text-slate-800 text-base">Kandidat Tidak Ditemukan</h3>
          <p className="text-xs text-slate-500">
            Profil kandidat nomor {id} tidak terdaftar atau belum dipublikasikan.
          </p>
          <Link href="/candidates">
            <Button variant="outline" size="sm" className="w-full text-xs">
              Kembali ke Daftar Kandidat
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const styles = getThemeStyles(candidate.themeColor);

  return (
    <div className="min-h-screen bg-[#FAF9F7] text-slate-900 antialiased flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 py-3 shadow-xs">
        <div className="max-w-2xl w-full mx-auto flex items-center justify-between">
          <Link
            href="/candidates"
            className="inline-flex items-center text-xs font-semibold text-slate-600 hover:text-primary transition-colors gap-1.5 group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Semua Kandidat</span>
          </Link>

          <Link href="/login">
            <Button
              size="sm"
              className="bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-xl gap-1.5 shadow-xs"
            >
              <Vote className="w-3.5 h-3.5" />
              Bilik Suara
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content (Matching Stitch Screen 05) */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 space-y-5">
        {/* Title Header */}
        <div className="space-y-1">
          <p className={`text-[11px] font-extrabold uppercase tracking-wider ${styles.accentText}`}>
            KANDIDAT NOMOR {candidate.candidateNumber}
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {candidate.name}
          </h1>
          <p className="text-sm text-slate-500 font-medium italic">
            "{candidate.motto}"
          </p>
        </div>

        {/* Candidate Portrait Card (Matching Stitch Screen 05 Hero Card) */}
        <Card className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="flex flex-col sm:flex-row items-stretch">
            {/* Left: Photo Portrait Container */}
            <div className="relative w-full sm:w-48 bg-slate-100 shrink-0 overflow-hidden flex items-end justify-center min-h-[220px]">
              <div
                className={`absolute top-0 left-0 ${styles.badge} text-xs font-black px-3 py-1 rounded-br-lg z-20 shadow-xs tracking-wider`}
              >
                #{candidate.candidateNumber}
              </div>

              {candidate.photoUrl ? (
                <img
                  src={candidate.photoUrl}
                  alt={candidate.name}
                  className="relative z-10 w-full h-full object-cover object-top"
                />
              ) : (
                <div className="w-full h-full min-h-[220px] flex items-center justify-center font-bold text-4xl text-slate-300">
                  #{candidate.candidateNumber}
                </div>
              )}
            </div>

            {/* Right: Quick Bio */}
            <div className="flex-1 p-5 flex flex-col justify-between">
              <div className="space-y-3">
                <div>
                  <Badge variant="outline" className="text-xs font-bold uppercase tracking-wider bg-slate-100">
                    Kelas / Asal: {candidate.classOrUnit}
                  </Badge>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Motto Kepemimpinan
                  </h3>
                  <p className="text-sm font-medium text-slate-700 mt-0.5">
                    "{candidate.motto}"
                  </p>
                </div>
                {candidate.supporters && candidate.supporters.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Didukung Oleh
                    </h3>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {candidate.supporters.map((s, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Status Calon: Terverifikasi</span>
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Resmi
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Visi Section */}
        <Card className="bg-white rounded-2xl border border-slate-200 shadow-xs">
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <Target className="w-4 h-4" />
              <span>Visi Utama</span>
            </div>
            <p className="text-sm sm:text-base text-slate-800 leading-relaxed font-medium">
              {candidate.vision}
            </p>
          </CardContent>
        </Card>

        {/* Misi Section */}
        <Card className="bg-white rounded-2xl border border-slate-200 shadow-xs">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Poin-Poin Misi ({candidate.missions.length})</span>
            </div>
            <div className="space-y-2.5">
              {candidate.missions.map((m, idx) => (
                <div key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-slate-700">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{m}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Program Kerja Unggulan */}
        <Card className="bg-white rounded-2xl border border-slate-200 shadow-xs">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              <Award className="w-4 h-4 text-primary" />
              <span>Program Kerja Unggulan</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {candidate.programs.map((p, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-800 font-medium flex items-center gap-2.5"
                >
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  <span>{p}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Bottom Vote CTA */}
        <div className="pt-2">
          <Link href="/login" className="w-full block">
            <Button
              className="w-full h-12 bg-primary hover:bg-primary-hover text-white font-bold text-sm rounded-xl shadow-md gap-2"
              size="lg"
            >
              <Vote className="w-5 h-5" />
              Pilih Kandidat #{candidate.candidateNumber} di Bilik Suara
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
        Votera © 2026 • Platform E-Voting Terpadu & Rahasia
      </footer>
    </div>
  );
}
