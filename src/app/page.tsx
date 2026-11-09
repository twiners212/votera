import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Vote, ShieldCheck, Users, CheckCircle2 } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#FAF9F7] flex flex-col justify-center items-center p-6">
      <div className="w-full max-w-xl space-y-6">
        <header className="text-center space-y-2">
          <Badge variant="success" className="gap-1.5 py-1 px-3 text-xs">
            <span className="w-2 h-2 rounded-full bg-[#047857] animate-pulse" />
            Pemungutan Suara Dibuka
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Votera — <span className="text-[#D6362C]">PILKETOS 2026</span>
          </h1>
          <p className="text-slate-600 text-sm font-medium">
            Platform E-Voting & Pemilihan Online Multi-Instansi (SMA Bojong Gede)
          </p>
        </header>

        <Card className="shadow-lg border-slate-200/80 bg-white">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#D6362C]" />
              Integritas & Kerahasiaan Suara
            </CardTitle>
            <CardDescription className="text-slate-500">
              1 Orang 1 Suara Atomik dan Kerahasiaan Surat Suara Tanpa Identitas (Unlinkable Ballot).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-800">4 Kandidat</div>
                  <div className="text-xs text-slate-500">Calon Ketua Terdaftar</div>
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5">
                <Users className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-800">7 Rombel</div>
                  <div className="text-xs text-slate-500">DPT Terdistribusi</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button asChild variant="brand" className="w-full flex-1 gap-2">
                <Link href="/login">
                  <Vote className="h-4 w-4" />
                  Masuk untuk Memilih
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full sm:w-auto border-slate-200">
                <Link href="/admin/login">
                  Panel Panitia
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <footer className="text-center text-xs text-slate-400">
          Votera &copy; 2026 &bull; Voting Terpadu & Rahasia
        </footer>
      </div>
    </main>
  );
}
