"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Vote,
  Shield,
  Check,
  CheckCircle2,
  LogOut,
  Loader2,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";

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
    status: string;
  } | null;
}

interface Candidate {
  id: string;
  candidateNumber: number;
  name: string;
  classOrUnit: string;
  motto: string;
  photoUrl: string | null;
  themeColor: string;
  isActive: boolean;
}

export default function DigitalBallotPage() {
  const router = useRouter();
  const [selectedCandidateId, setSelectedCandidateId] = React.useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);

  // 1. Ambil sesi pemilih aktif
  const { data: sessionData, isLoading: isSessionLoading } = useQuery<VoterSessionData>({
    queryKey: ["voter", "session"],
    queryFn: async () => {
      const res = await fetch("/api/voter/session");
      if (!res.ok) throw new Error("Gagal memeriksa sesi.");
      return res.json();
    },
  });

  // 2. Ambil daftar kandidat aktif
  const { data: electionData, isLoading: isElectionLoading } = useQuery({
    queryKey: queryKeys.election.active(),
    queryFn: async () => {
      const res = await fetch("/api/public/election");
      if (!res.ok) throw new Error("Gagal memuat kandidat.");
      return res.json();
    },
  });

  // Redirect jika belum login atau sudah memilih
  React.useEffect(() => {
    if (!isSessionLoading && sessionData) {
      if (!sessionData.authenticated || !sessionData.voter) {
        router.push("/login");
      } else if (sessionData.voter.hasVoted) {
        router.push("/vote/thanks");
      }
    }
  }, [sessionData, isSessionLoading, router]);

  // Logout handler
  const handleLogout = async () => {
    try {
      await fetch("/api/voter/logout", { method: "POST" });
      router.push("/login");
    } catch {
      router.push("/login");
    }
  };

  // Mutation kirim suara
  const voteMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      const res = await fetch("/api/voter/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Gagal mencatat suara.");
      }
      return json;
    },
    onSuccess: (res) => {
      toast.success("Suara Berhasil Dikirim!", {
        description: "Pilihan kamu telah tercatat secara aman dan rahasia.",
      });
      window.location.href = res.redirectUrl || "/vote/thanks";
    },
    onError: (err: Error) => {
      toast.error("Gagal Mengirim Suara", { description: err.message });
      setIsConfirmOpen(false);
    },
  });

  if (isSessionLoading || isElectionLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
        <p className="text-xs text-slate-500 font-medium">Mempersiapkan bilik suara digital...</p>
      </div>
    );
  }

  const voter = sessionData?.voter;
  const election = electionData?.data?.election;
  const candidates: Candidate[] = (electionData?.data?.candidates || []).filter(
    (c: Candidate) => c.isActive
  );
  const selectedCandidate = candidates.find((c) => c.id === selectedCandidateId);

  return (
    <div className="min-h-screen text-slate-800 flex flex-col antialiased bg-[#F8FAFC]">
      {/* Top Navbar (Matching Stitch Screen 07) */}
      <header className="sticky top-0 z-30 w-full bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-[72px] flex items-center justify-between">
          {/* Brand Logo & School Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border border-amber-300 bg-amber-50 p-1 flex items-center justify-center shadow-xs">
              <Shield className="w-5 h-5 text-amber-600" />
            </div>
            <div className="leading-tight">
              <h1 className="text-base font-extrabold tracking-tight text-slate-900 flex items-center gap-1.5">
                {election?.shortName || "PILKETOS"}{" "}
                <span className="text-primary">2026</span>
              </h1>
              <p className="text-xs font-medium text-slate-500">
                {election?.organizationName || "SMA Bojong Gede"}
              </p>
            </div>
          </div>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#ECFDF5] border border-[#A7F3D0] text-[#047857]">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              Pemungutan suara dibuka
            </div>

            <div className="flex items-center gap-2.5 pl-2">
              <div className="w-9 h-9 rounded-full bg-[#FCE8E6] text-primary flex items-center justify-center font-bold text-sm border border-red-100 shadow-xs">
                {voter?.name?.[0]?.toUpperCase() || "P"}
              </div>
              <div className="hidden md:block text-left text-xs leading-snug">
                <p className="font-bold text-slate-800">{voter?.name}</p>
                <p className="text-slate-500 font-medium">{voter?.groupName || "DPT Terdaftar"}</p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-1.5 text-xs font-semibold text-slate-700 h-9"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" />
              <span>Keluar</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Ballot Content */}
      <main className="flex-1 pb-32">
        {/* Hero Ballot Header with Indonesian Flag Backdrop */}
        <section className="relative w-full overflow-hidden border-b border-slate-200 bg-white">
          <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 py-8 sm:py-12 z-10">
            <div className="max-w-xl">
              <span className="inline-block text-xs font-extrabold uppercase tracking-widest text-primary mb-2">
                SURAT SUARA RESMI
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
                Pilih Satu <br />
                <span className="text-primary">Calon Ketua</span>
              </h2>
              <p className="mt-3 text-sm md:text-base text-slate-600 leading-relaxed font-normal">
                Ketuk salah satu kartu kandidat pilihan kamu. Setelah suara dikirim, pilihan{" "}
                <strong className="text-slate-900 font-bold">bersifat final dan tidak dapat diubah</strong>.
              </p>
            </div>
          </div>
        </section>

        {/* Candidate Selection Cards Grid */}
        <section className="max-w-[1440px] mx-auto px-4 sm:px-6 mt-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {candidates.map((c) => {
              const isSelected = selectedCandidateId === c.id;

              return (
                <article
                  key={c.id}
                  onClick={() => setSelectedCandidateId(c.id)}
                  className={`group relative bg-white rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col overflow-hidden select-none ${
                    isSelected
                      ? "border-primary ring-2 ring-primary shadow-xl shadow-red-500/10 -translate-y-1"
                      : "border-slate-200 hover:border-slate-300 hover:shadow-md"
                  }`}
                >
                  {/* Photo Canvas */}
                  <div className="relative aspect-[4/4.5] bg-slate-100 flex items-center justify-center overflow-hidden border-b border-slate-100">
                    {/* Ballot Number Badge */}
                    <div className="absolute top-3.5 left-3.5 z-10">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-primary text-white text-xs font-black rounded-lg shadow-sm">
                        #{c.candidateNumber}
                      </span>
                    </div>

                    {/* Radio Selection Indicator */}
                    <div className="absolute top-3.5 right-3.5 z-10">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                          isSelected
                            ? "bg-primary text-white shadow-md ring-2 ring-white"
                            : "bg-white/90 backdrop-blur-sm border-2 border-slate-300 group-hover:border-slate-400"
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                      </div>
                    </div>

                    {/* Portrait Image */}
                    {c.photoUrl ? (
                      <img
                        src={c.photoUrl}
                        alt={c.name}
                        className="w-full h-full object-cover object-top pt-2 group-hover:scale-102 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-4xl text-slate-300">
                        #{c.candidateNumber}
                      </div>
                    )}
                  </div>

                  {/* Card Description */}
                  <div className="p-4 flex-1 flex flex-col justify-between bg-white">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                          {c.classOrUnit}
                        </span>
                      </div>
                      <h3 className="font-bold text-base text-slate-900 tracking-tight leading-snug group-hover:text-primary transition-colors">
                        {c.name}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 leading-normal line-clamp-2 italic">
                        "{c.motto}"
                      </p>
                    </div>

                    {isSelected && (
                      <div className="mt-3 pt-2 border-t border-red-100 text-xs font-semibold text-primary flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Pilihan Terpilih
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      {/* Sticky Bottom Confirmation Bar (Matching Stitch Screen 07) */}
      <aside className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] z-40 py-3.5">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs sm:text-sm font-medium text-slate-500 shrink-0">
              Kandidat Terpilih:
            </span>
            {selectedCandidate ? (
              <span className="text-xs sm:text-sm font-bold text-slate-900 truncate flex items-center gap-1.5">
                <Badge variant="outline" className="bg-red-50 text-primary border-red-200 font-mono text-xs">
                  No. {selectedCandidate.candidateNumber}
                </Badge>
                {selectedCandidate.name}
              </span>
            ) : (
              <span className="text-xs sm:text-sm font-medium text-slate-400 italic">
                (Ketuk salah satu kartu kandidat di atas)
              </span>
            )}
          </div>

          <Button
            size="lg"
            disabled={!selectedCandidateId || voteMutation.isPending}
            onClick={() => setIsConfirmOpen(true)}
            className="h-11 sm:h-12 px-6 sm:px-8 bg-primary hover:bg-primary-hover text-white font-bold text-sm rounded-xl shadow-md transition-all shrink-0"
          >
            Kirim Suara
          </Button>
        </div>
      </aside>

      {/* Confirmation Alert Dialog */}
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="w-12 h-12 rounded-full bg-red-100 text-primary flex items-center justify-center mx-auto mb-2 border border-red-200">
              <Vote className="w-6 h-6" />
            </div>
            <AlertDialogTitle className="text-center text-lg font-bold">
              Konfirmasi Pilihan Suara
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-xs text-slate-600 space-y-2 pt-1">
              <div>
                Kamu memilih kandidat nomor <strong>#{selectedCandidate?.candidateNumber}</strong>:
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900">
                {selectedCandidate?.name}
              </div>
              <p className="text-[11px] text-red-600 font-medium">
                Peringatan: Pilihan ini bersifat final dan tidak dapat diubah kembali setelah dikirimkan.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-2 pt-2">
            <AlertDialogCancel disabled={voteMutation.isPending} className="text-xs h-10">
              Periksa Kembali
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={voteMutation.isPending}
              onClick={() => selectedCandidateId && voteMutation.mutate(selectedCandidateId)}
              className="bg-primary hover:bg-primary-hover text-white font-bold text-xs h-10 gap-1.5"
            >
              {voteMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Mengirim Suara...
                </>
              ) : (
                "Ya, Kirim Suara Sekarang"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
