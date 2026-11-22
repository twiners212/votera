# Changelog — Votera

Seluruh perubahan penting pada proyek **Votera** (*Voting Terpadu & Rahasia*) didokumentasikan dalam berkas ini. Format changelog mengacu pada [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan mematuhi prinsip [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-11-22

### ⚡ Performa & Optimasi Dev Server
- **Turbopack Dev Server:** Mengaktifkan `next dev --turbopack` di `package.json`, memangkas waktu startup lokal dari ~3 detik menjadi **1,8 detik** dan mempercepat kompilasi rute *on-demand*.
- **Package Tree-Shaking:** Menambahkan `experimental.optimizePackageImports` di `next.config.ts` untuk `lucide-react`, `recharts`, `zod`, dan seluruh komponen `@radix-ui/*`, mencegah pemrosesan *barrel file* ribuan modul.
- **Deduplikasi Request Server Components:** Membungkus `getAdminSession()` dan `getVoterSession()` dengan `React.cache()` sehingga kueri sesi basis data hanya dieksekusi 1 kali per siklus request lifecycle.
- **Cache Data Publik Cepat:** Mengimplementasikan `unstable_cache` (15 detik) dengan sinkronisasi invalidasi instan (`revalidateTag` & `revalidatePath`) untuk data beranda dan daftar kandidat di `/` dan `/candidates`.
- **Eliminasi Database Waterfall:**
  - Menggabungkan kueri profil kandidat di `/candidates/[id]` menjadi single round-trip (`innerJoin(elections)` + `leftJoin(electionSettings)`).
  - Memparalelkan pemuatan sesi dan branding di layout panel admin via `Promise.all()`.
  - Mempercepat rute submit suara `/api/voter/vote` dengan invalidasi instan tag `"election-dashboard"` dan `"election-results"`.

### 📦 Code-Splitting & Pengurangan Ukuran Bundle (First Load JS)
- **Lazy Dynamic Import Library Berat:**
  - Mengonversi `xlsx` (SheetJS ~1 MB) dan `jspdf` / `jspdf-autotable` (~400 KB) menjadi `await import(...)` dinamis hanya saat tombol ekspor di `/admin/results` diklik (**First Load JS turun dari 544 kB menjadi 147 kB, hemat -73,0%**).
  - Mengonversi `DptImportDialog` di `/admin/voters` menjadi `next/dynamic` dengan guard mounting (**First Load JS turun dari 389 kB menjadi 215 kB, hemat -44,7%**).
  - Mengekstrak fungsi manipulasi string `escapeSpreadsheetCell` ke `src/lib/importers/csv-sanitizer.ts`, membebaskan rute `/admin/logs` dari modul SheetJS (**First Load JS turun dari 347 kB menjadi 176 kB, hemat -49,3%**).
  - Mengonversi parser `parseDptBuffer` di `dpt-parser.ts` untuk memuat `papaparse` dan `xlsx` secara lazy *on-demand*.

### 🎨 Antarmuka Visual & Aksesibilitas (Impeccable UI)
- **Instant Navigation Streaming Skeletons:** Menambahkan `src/app/(public)/loading.tsx` dan `src/app/admin/(panel)/loading.tsx` dengan palet warna `#FFF5F3` dan atribut semantik ARIA (`role="status"`, `aria-label`, `<span className="sr-only">`), menghasilkan **0ms perceived latency** saat navigasi antar-halaman.
- **Desain Kapsul Misi Kandidat:** Penyesuaian kapsul misi kandidat dengan palet warna tema spesifik (`red`, `green`, `blue`, `amber`) serta proteksi teks `break-words`.
- **Desktop Split-View & Hero Polish:** Penyempurnaan tata letak responsif desktop (1440x900 & 1280x800) dan target sentuhan mobile (minimal 44px) di seluruh kartu kandidat dan tombol aksi.

### 🛡️ Keamanan & Reliabilitas
- **Rate Limiting Berlapis:** Sliding-window rate limiter in-memory dengan auto-cleanup TTL untuk proteksi brute-force login pemilih, voting paralel, dan ekspor data admin.
- **Safeguards Operasional Hari-H:** Proteksi bertingkat paslon berbasis suara masuk (mengunci nomor urut dan status aktif jika sudah ada suara masuk) serta sinkronisasi jadwal kedaluwarsa.
- **Suite Pengujian Baru:** Penambahan 12 pengujian unit untuk lapisan optimasi cache dan dynamic parser (`tests/unit/performance-optimizations.test.ts`), menjadikan total suite pengujian **184 tests (100% PASS)** dan 2 skenario E2E Playwright.

---

## [1.0.0] - 2026-11-12

### 🚀 Initial Full-Stack Release
- **Fondasi E-Voting:** Sistem pemilihan multi-instansi dengan jaminan 1 Orang 1 Suara atomik via transaksi WebSocket Pool Neon Serverless PostgreSQL (`dbPool.transaction`).
- **Unlinkable Anonymous Ballot:** Pemisahan mutlak tabel `voters` dan `votes` tanpa kolom `voter_id` atau alamat IP pada tabel suara.
- **Autentikasi Ganda:** Panel Admin berbasis Better Auth (RBAC: `super_admin` & `committee`) dan Sesi Pemilih independen dengan cookie HttpOnly (`votera_voter_session`).
- **Kriptografi Token:** Dual-column cryptography (`token_hash` HMAC-SHA256 untuk verifikasi login dan `token_encrypted` AES-256-GCM berbatas waktu untuk fitur Salin Token panitia).
- **Manajemen DPT & Impor Massal:** Dukungan impor file CSV (PapaParse) dan Excel XLSX (SheetJS) hingga 5.000 baris dengan sanitasi formula injection (CWE-1236).
- **Hasil Real-Time & Laporan:** Smart HTTP Polling TanStack Query v5 + cache server, serta generator laporan resmi Berita Acara PDF (`jspdf`) dan rekapitulasi multi-sheet Excel (`xlsx`).
- **Audit Logs Append-Only:** Jejak audit keamanan anti-curang yang dilindungi oleh trigger PostgreSQL `trg_protect_audit_logs`.
- **10 Layar Referensi Google Stitch:** Beranda Publik, Login Pemilih, Daftar Kandidat, Profil Kandidat, Surat Suara Digital, Bukti Terima Kasih, Login Admin, Dashboard KPI, Manajemen Kandidat, dan Manajemen DPT.
