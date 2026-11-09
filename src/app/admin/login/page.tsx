"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Lock, User, Eye, EyeOff, Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/admin-client";

export default function AdminLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [rememberMe, setRememberMe] = React.useState(true);
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      setErrorMessage("Username atau Email wajib diisi.");
      return;
    }

    if (!password) {
      setErrorMessage("Kata sandi wajib diisi.");
      return;
    }

    setIsLoading(true);

    try {
      const isEmail = cleanIdentifier.includes("@");
      let res;

      if (isEmail) {
        res = await authClient.signIn.email({
          email: cleanIdentifier,
          password,
          rememberMe,
        });
      } else {
        res = await authClient.signIn.username({
          username: cleanIdentifier,
          password,
          rememberMe,
        });
      }

      if (res.error) {
        const msg = res.error.message || "Username, email, atau kata sandi tidak valid.";
        setErrorMessage(msg);
        toast.error("Gagal Masuk", { description: msg });
        setIsLoading(false);
        return;
      }

      toast.success("Login Berhasil", {
        description: "Mengalihkan ke panel administrator...",
      });

      // Force full reload or push to ensure server cookies are read fresh
      window.location.href = "/admin/dashboard";
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Terjadi kesalahan sistem saat mencoba masuk.";
      setErrorMessage(errorMsg);
      toast.error("Kesalahan", { description: errorMsg });
      setIsLoading(false);
    }
  };

  const fillCredentials = (user: string, pass: string) => {
    setIdentifier(user);
    setPassword(pass);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between py-2">
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5 transition-transform group-hover:-translate-x-0.5" />
          Kembali ke Portal Pemilih
        </Link>
        <Badge variant="outline" className="bg-white/80 border-border font-mono text-xs">
          Votera v1.0 • Civic Trust
        </Badge>
      </header>

      {/* Main Login Card */}
      <main className="max-w-md w-full mx-auto my-auto py-8">
        <Card className="border-border shadow-sm bg-white">
          <CardHeader className="space-y-3 pb-6 text-center">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mx-auto border border-primary/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
                Panel Pengawas & Admin
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground mt-1">
                PILKETOS 2026 • SMA Bojong Gede
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {errorMessage && (
              <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 mt-0.5 text-red-600 shrink-0" />
                <span className="leading-snug">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="identifier"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Username atau Email
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="identifier"
                    type="text"
                    autoComplete="username"
                    required
                    placeholder="Contoh: admin atau panitia"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    disabled={isLoading}
                    className="pl-10 h-11 text-sm bg-slate-50/50 border-input focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Kata Sandi
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="pl-10 pr-10 h-11 text-sm bg-slate-50/50 border-input focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                    disabled={isLoading}
                  />
                  <label
                    htmlFor="remember"
                    className="text-xs font-medium text-muted-foreground cursor-pointer select-none"
                  >
                    Ingat sesi saya
                  </label>
                </div>
                <span className="text-xs text-muted-foreground">Otentikasi Aman</span>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-primary hover:bg-primary-hover text-white font-medium shadow-sm transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Memverifikasi...
                  </>
                ) : (
                  "Masuk ke Panel Pengawas"
                )}
              </Button>
            </form>

            {/* Quick Demo Preset Helper */}
            <div className="pt-2 border-t border-dashed border-border/80">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 text-center">
                Akun Demo Terdaftar
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => fillCredentials("admin", "AdminPilketos2026!Secure")}
                  className="p-2 rounded-lg border border-border bg-slate-50/70 hover:bg-slate-100 text-left transition-colors"
                >
                  <p className="font-semibold text-foreground">Super Admin</p>
                  <p className="font-mono text-[11px] text-muted-foreground">admin</p>
                </button>
                <button
                  type="button"
                  onClick={() => fillCredentials("panitia", "PanitiaPilketos2026!")}
                  className="p-2 rounded-lg border border-border bg-slate-50/70 hover:bg-slate-100 text-left transition-colors"
                >
                  <p className="font-semibold text-foreground">Panitia</p>
                  <p className="font-mono text-[11px] text-muted-foreground">panitia</p>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto py-3 text-center text-xs text-muted-foreground">
        Votera © 2026 • Platform E-Voting Terpadu & Rahasia. Semua aktivitas administrator diaudit secara append-only.
      </footer>
    </div>
  );
}
