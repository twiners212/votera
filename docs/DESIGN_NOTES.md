# Design System Integration Notes (Tailwind CSS & shadcn/ui) — Votera

**Nama Aplikasi:** Votera  
**Acuan Utama:** Spesifikasi Desain Visual & Pemetaan Token Tailwind CSS / shadcn/ui  
**Versi Dokumen:** 1.0.0  

---

## 1. Pemetaan Token Visual ke CSS Variables (`src/app/globals.css`)

Komponen `shadcn/ui` menggunakan variabel CSS berbasis HSL/HEX di `globals.css`. Berikut adalah pemetaan langsung dari palet warna **Civic Trust** pada `DESIGN_NOTES.md` ke dalam arsitektur variabel `shadcn/ui` dan custom utility classes:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Mapping Token Utama ke shadcn/ui */
    --background: 210 40% 98%;          /* #F8FAFC - --bg-canvas */
    --foreground: 222 47% 11%;          /* #0F172A - --text-primary */

    --card: 0 0% 100%;                  /* #FFFFFF - --bg-surface */
    --card-foreground: 222 47% 11%;     /* #0F172A - --text-primary */

    --popover: 0 0% 100%;               /* #FFFFFF */
    --popover-foreground: 222 47% 11%;  /* #0F172A */

    --primary: 5 70% 51%;               /* #D93829 - --color-primary (Crimson Red) */
    --primary-foreground: 0 0% 100%;    /* #FFFFFF - --text-on-primary */

    --secondary: 210 40% 96.1%;         /* #F1F5F9 - --bg-muted */
    --secondary-foreground: 215 25% 27%;/* #334155 - --text-secondary */

    --muted: 210 40% 96.1%;             /* #F1F5F9 - --bg-muted */
    --muted-foreground: 215 16% 47%;    /* #64748B - --text-tertiary */

    --accent: 7 100% 97%;               /* #FFF0EE - --color-primary-soft */
    --accent-foreground: 5 70% 51%;     /* #D93829 - --color-primary */

    --destructive: 0 72% 51%;           /* #DC2626 - --status-danger-text */
    --destructive-foreground: 0 0% 100%;/* #FFFFFF */

    --border: 214 32% 91%;              /* #E2E8F0 - --border-subtle */
    --input: 213 27% 84%;               /* #CBD5E1 - --border-strong */
    --ring: 5 70% 51%;                  /* #D93829 - Focus Ring Primary */

    --radius: 0.75rem;                  /* 12px default card/input radius */

    /* Custom Token Tambahan Votera */
    --bg-warm-tint: #FFF5F3;
    --primary-hover: #B8281B;
    
    /* Candidate Mission Pill Accent Colors */
    --cand-red-border: #C84B31;
    --cand-red-text: #A83820;
    --cand-red-bg: #FFFBFB;

    --cand-green-border: #2F6F5E;
    --cand-green-text: #1F5748;
    --cand-green-bg: #F7FCFA;

    --cand-blue-border: #2E6F9E;
    --cand-blue-text: #1D5680;
    --cand-blue-bg: #F7FAFC;

    --cand-amber-border: #B45309;
    --cand-amber-text: #92400E;
    --cand-amber-bg: #FFFBEB;

    /* Semantic Status Pills */
    --status-success-bg: #DCFCE7;
    --status-success-text: #15803D;
    --status-success-dot: #16A34A;

    --status-warning-bg: #FEF3C7;
    --status-warning-text: #B45309;
    --status-warning-dot: #D97706;

    --status-danger-bg: #FEE2E2;
    --status-danger-text: #DC2626;
  }
}

/* Utilitas Angka Tabular Wajib untuk Perhitungan Suara, NIS, & Timer */
.tabular-nums {
  font-variant-numeric: tabular-nums;
}
2. Konfigurasi Font (src/app/layout.tsx)Sesuai spesifikasi desain, aplikasi menggunakan Plus Jakarta Sans untuk teks utama/heading dan JetBrains Mono untuk kode token (JUFT88TF), event key log (vote_cast), dan alamat IP (::1):   TypeScriptimport { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-mono",
  display: "swap",
});
3. Kustomisasi Komponen Dasar shadcn/uiKetika menginstal komponen shadcn/ui (pnpm dlx shadcn@latest add ...), sesuaikan varian default-nya agar selaras dengan spesifikasi desain:Komponen shadcn/uiPenyesuaian Varian & StylingButton (ui/button.tsx)- default (Primary): bg-[#D93829] hover:bg-[#B8281B] text-white font-semibold rounded-[10px] shadow-sm- outline (Secondary): bg-white border-[#CBD5E1] text-[#0F172A] hover:bg-[#F8FAFC] rounded-[10px]- softDanger (Tombol Hapus Tabel): bg-[#FEE2E2] text-[#DC2626] hover:bg-[#FECACA] font-semibold rounded-[8px] h-8 px-3 text-xsInput (ui/input.tsx)Tinggi h-10 (Admin) dan h-12 (Login Pemilih), rounded-[10px], border-[#CBD5E1], focus-visible:ring-[#D93829]/20 focus-visible:border-[#D93829]. Mendukung slot ikon di sisi kiri (User, Lock, Search) dan tombol toggle mata (Eye/EyeOff) di sisi kanan.   Select (ui/select.tsx)Tinggi h-10, rounded-[10px], border-[#CBD5E1], digunakan pada bar filter Status, Rombel, Tingkat, Jurusan, Pelaku, dan Aksi.   Card (ui/card.tsx)bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_2px_rgba(15,23,42,0.04)].Table (ui/table.tsx)Header TH menggunakan text-[11px] font-bold uppercase tracking-wider text-[#64748B] bg-[#F8FAFC]/60. Baris TR menggunakan border-b border-[#F1F5F9] hover:bg-[#F8FAFC].Dialog / AlertDialogrounded-[16px], backdrop bg-slate-900/45 backdrop-blur-[2px], dipakai untuk konfirmasi "Kirim suara", "Reset token", "Atur jadwal", dan "Import DPT".Progress (ui/progress.tsx)Track bg-[#F1F5F9] h-2 rounded-full. Indicator menggunakan bg-[#D93829] untuk perolehan suara kandidat unggul & partisipasi kelas, atau bg-[#16A34A] untuk kartu KPI Partisipasi.   4. Daftar Komponen Custom yang Wajib DibangunSelain komponen dasar shadcn/ui, AI coding agent wajib membuat komponen spesifik domain berikut di src/components/:4.1. Komponen Sisi Pemilih (src/components/voter/)PublicNavbar (public-navbar.tsx):Menampilkan logo sekolah + nama acara (PILKETOS 2026 - SMA Bojong Gede) di kiri.   Di kanan: menampilkan StatusPill (• Dibuka / • Pemungutan suara dibuka), serta jika pemilih sudah login menampilkan avatar inisial merah muda (P), nama & kelas (Putri Ayu Lestari - Rombel 2), dan tombol Keluar.   CandidateProfileCard (candidate-profile-card.tsx):Dipakai di halaman /candidates.Layout horizontal (foto potret 3:4 di kiri dengan badge #1 merah di pojok kiri atas; konten nama, motto, 3 outline mission pills berwarna sesuai themeColor kandidat, dan tombol Lihat Profil -> di kanan).   BallotCandidateCard (ballot-candidate-card.tsx):Dipakai di halaman /vote.Kartu interaktif role="radio". State unselected: border #E2E8F0 dan lingkaran radio kosong di kanan atas foto. State selected: border 2px solid #D93829, lingkaran merah dengan centang putih di kanan atas foto, dan bayangan halus merah.   StickyBallotBar (sticky-ballot-bar.tsx):Bar bawah yang menempel (sticky bottom-0 z-30 bg-white/95 backdrop-blur border-t border-[#E2E8F0]) di halaman /vote.Kiri: menampilkan "Dipilih: No. 1 — Raka Aditya Pratama" (atau "Belum ada kandidat dipilih"). Kanan: tombol utama "Kirim suara" (disabled jika belum memilih).   4.2. Komponen Sisi Panel Admin (src/components/admin/)AdminSidebar (admin-sidebar.tsx):Lebar tetap 240px di desktop (hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0), berubah menjadi Sheet (drawer) di layar mobile/tablet.Menampilkan 4 grup menu: UTAMA (Dashboard), PEMILIHAN (Kandidat, Pemilih/DPT, Hasil & Laporan), DATA MASTER (Tingkat Kelas, Jurusan), dan SISTEM (Pengaturan, Log Aktivitas, Kelola Admin), serta tombol Keluar di bagian bawah.   KpiStatCard (kpi-stat-card.tsx):Kartu metrik 4 kolom yang konsisten di halaman Dashboard, Pemilih (DPT), Hasil, dan Log Aktivitas.   Mendukung varian dengan ikon lingkaran berwarna di atas angka (untuk /admin/dashboard) dan varian angka besar langsung di atas label (untuk /admin/voters, /admin/results, /admin/logs), serta slot opsional progress bar di bagian bawah (untuk kartu % Partisipasi).   TokenCopyBadge (token-copy-badge.tsx):Menampilkan string token dengan font monospace (font-mono text-xs font-semibold bg-[#F1F5F9] px-2.5 py-1 rounded-md tracking-wider) didampingi tombol link merah "Salin".   Saat diklik, menyalin kode token ke clipboard dan mengubah teks menjadi "Tersalin ✓" selama 2 detik. Jika hasVoted === true, menampilkan strip "—" (token sudah hangus).CandidateLiveResultCard (candidate-live-result-card.tsx):Dipakai di /admin/results.Jika kandidat berada di peringkat 1 (dan voteCount > 0), kartu otomatis menggunakan border merah border-[#D93829] dan progress bar merah. Menampilkan badge peringkat bulat, inisial kandidat, nomor urut, kelas, jumlah suara (tabular-nums), dan persentase (100,0%).   ElectionReadinessCard (election-readiness-card.tsx):Kartu checklist 4 syarat kesiapan pemilihan di /admin/dashboard dengan badge status Siap / Belum Siap di sudut kanan atas.   DptImportDialog (dpt-import-dialog.tsx):Modal drag-and-drop CSV/XLSX yang menampilkan preview jumlah baris valid, tabel daftar baris error (jika ada NIS duplikat atau Rombel tidak ditemukan), dan tombol unduh template CSV/XLSX.5. Panduan Responsif & BreakpointsMobile (< 640px):Layar Pemilih (/, /login, /candidates, /candidates/[id], /vote, /vote/thanks) dirender satu kolom penuh (px-4), dengan ukuran tinggi tombol minimal 44px–48px agar nyaman disentuh jari.Grid surat suara /vote berubah dari 4 kolom menjadi 1 kolom vertikal (atau 2 kolom kompak), dengan StickyBallotBar tetap menempel di bawah layar HP.Tablet (640px – 1024px):Grid surat suara /vote dan kartu hasil /admin/results dirender menjadi 2 kolom.Sidebar Admin disembunyikan ke dalam tombol Hamburger (Sheet kiri).Desktop (>= 1024px):Panel Admin menampilkan AdminSidebar tetap (240px) di kiri dan area konten utama (pl-60) dengan grid 4 kartu KPI dalam 1 baris, grid hasil 3 kolom, dan grid surat suara 4 kolom sejajar.
