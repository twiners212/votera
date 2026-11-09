"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Vote,
  Shield,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { queryKeys } from "@/lib/query-keys";

interface PublicCandidate {
  id: string;
  candidateNumber: number;
  name: string;
  classOrUnit: string;
  motto: string;
  vision: string;
  missions: string[];
  programs: string[];
  photoUrl: string | null;
  themeColor: "red" | "green" | "blue" | "amber";
  isActive: boolean;
}

export default function CandidatesListPage() {
  const { data, isLoading, error } = useQuery<{ success: boolean; data: { candidates: PublicCandidate[]; election: any } }>({
    queryKey: queryKeys.election.active(),
    queryFn: async () => {
      const res = await fetch("/api/public/election");
      if (!res.ok) throw new Error("Gagal memuat kandidat.");
      return res.json();
    },
  });

  const candidates = (data?.data?.candidates || []).filter((c) => c.isActive);
  const election = data?.data?.election;

  const getThemeStyles = (color: string) => {
    switch (color) {
      case "red":
        return {
          badge: "bg-[#D6362C] text-white",
          pill: "border-[#B9382C] text-[#B9382C] bg-[#FFF5F4]",
        };
      case "green":
        return {
          badge: "bg-[#10B981] text-white",
          pill: "border-emerald-600 text-emerald-700 bg-emerald-50",
        };
      case "blue":
        return {
          badge: "bg-[#2563EB] text-white",
          pill: "border-blue-600 text-blue-700 bg-blue-50",
        };
      case "amber":
        return {
          badge: "bg-[#F59E0B] text-white",
          pill: "border-amber-600 text-amber-800 bg-amber-50",
        };
      default:
        return {
          badge: "bg-slate-700 text-white",
          pill: "border-slate-300 text-slate-700 bg-slate-50",
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

  return (
    <div className="min-h-screen bg-[#FAF9F7] text-slate-900 antialiased flex flex-col justify-between">
      {/* Top Navbar (Matching Stitch Screen 10) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 py-3 shadow-xs">
        <div className="max-w-2xl w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="w-9 h-9 rounded-full border border-yellow-400 bg-yellow-50 flex items-center justify-center p-0.5 shrink-0 shadow-inner group"
              title="Beranda"
            >
              <Shield className="w-5 h-5 text-amber-600 group-hover:scale-105 transition-transform" />
            </Link>
            <div>
              <h1 className="text-sm font-extrabold tracking-tight text-slate-900 leading-tight">
                {election?.shortName || "PILKETOS"}{" "}
                <span className="text-[#D6362C]">2026</span>
              </h1>
              <p className="text-[11px] font-medium text-slate-500 leading-tight">
                {election?.organizationName || "SMA Bojong Gede"}
              </p>
            </div>
          </div>

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

      {/* Main Candidate List */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
              Daftar Pasangan Calon
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pelajari visi, misi, dan gagasan setiap kandidat sebelum memberikan suara.
            </p>
          </div>
          <Badge variant="outline" className="text-xs font-mono">
            {candidates.length} Paslon
          </Badge>
        </div>

        {/* Candidate Cards (Matching Stitch Screen 10) */}
        <div className="space-y-4">
          {candidates.map((c) => {
            const styles = getThemeStyles(c.themeColor);

            return (
              <article
                key={c.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col sm:flex-row relative transition-shadow hover:shadow-md"
              >
                {/* Candidate Photo (Left ~38%) */}
                <div className="w-full sm:w-[38%] relative bg-slate-100 flex items-end justify-center overflow-hidden shrink-0 min-h-[220px]">
                  {/* Ballot Number Badge */}
                  <div
                    className={`absolute top-0 left-0 ${styles.badge} text-xs font-black px-3 py-1 rounded-br-xl z-20 shadow-xs tracking-wider`}
                  >
                    #{c.candidateNumber}
                  </div>

                  {/* Candidate Portrait */}
                  {c.photoUrl ? (
                    <img
                      src={c.photoUrl}
                      alt={`Foto ${c.name}`}
                      className="relative z-10 w-full h-full object-cover object-top"
                    />
                  ) : (
                    <div className="relative z-10 w-full h-full min-h-[220px] flex items-center justify-center font-bold text-3xl text-slate-400 bg-slate-100">
                      #{c.candidateNumber}
                    </div>
                  )}
                </div>

                {/* Candidate Information (Right ~62%) */}
                <div className="w-full sm:w-[62%] p-4 sm:p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-bold text-slate-900 leading-snug">
                        {c.name}
                      </h3>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                        {c.classOrUnit}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 font-medium mt-1 mb-3 italic">
                      "{c.motto}"
                    </p>

                    {/* Mission Points (Matching Stitch Pills) */}
                    <div className="space-y-1.5">
                      {c.missions.slice(0, 3).map((m, idx) => (
                        <div
                          key={idx}
                          className={`border text-[11px] font-medium rounded-full px-3 py-1 leading-snug text-left truncate ${styles.pill}`}
                          title={m}
                        >
                          • {m}
                        </div>
                      ))}
                      {c.missions.length > 3 && (
                        <p className="text-[10px] text-slate-400 pl-2">
                          +{c.missions.length - 3} program lainnya di profil lengkap
                        </p>
                      )}
                    </div>
                  </div>

                  {/* View Profile Action */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <Link href={`/candidates/${c.candidateNumber}`} className="w-full block">
                      <Button
                        variant="outline"
                        className="w-full h-10 border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                      >
                        <span>Lihat Profil Lengkap</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
        Votera © 2026 • Platform E-Voting Terpadu & Rahasia
      </footer>
    </div>
  );
}
