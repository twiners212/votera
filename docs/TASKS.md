# Implementation Roadmap & Task Breakdown — Votera

**Nama Aplikasi:** Votera  
**Versi Dokumen:** 1.0.0  
**Status Implementasi:** 100% Selesai & Terverifikasi (Fase 1 s/d Fase 12)  
**Prinsip Pengerjaan:** Setiap task dirancang berukuran modular (1 sesi kerja AI coding agent) dengan *Definition of Done (DoD)* yang terukur. Kerjakan secara berurutan dari Fase 1 hingga Fase 12.

---

## Fase 1: Inisialisasi Proyek, Konfigurasi Stack & Design Tokens
Tujuan: Menyiapkan fondasi Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, dan TanStack Query sesuai `tech-stack.md` dan `DESIGN_NOTES.md`.

- [x] **Task 1.1: Inisialisasi Next.js & Dependensi Utama**
  * Setup proyek Next.js (App Router, TypeScript, Tailwind CSS) menggunakan `pnpm`.
  * Instal paket wajib: `drizzle-orm`, `@neondatabase/serverless`, `ws`, `better-auth`, `@tanstack/react-query`, `react-hook-form`, `zod`, `@hookform/resolvers`, `lucide-react`, `papaparse`, `xlsx`, `@vercel/blob`, `jspdf`, `jspdf-autotable`, `recharts`.
  * Instal devDependencies: `drizzle-kit`, `@types/ws`, `@types/papaparse`, `vitest`, `@playwright/test`, `tsx`.
  * **Kriteria Selesai (DoD):** `package.json` lengkap, `pnpm install` berhasil tanpa konflik, dan `pnpm typecheck` lolos.

- [x] **Task 1.2: Konfigurasi Font, CSS Variables (`DESIGN_NOTES.md`) & Komponen Dasar `shadcn/ui`**
  * Konfigurasi `Plus_Jakarta_Sans` (`--font-sans`) dan `JetBrains_Mono` (`--font-mono`) di `src/app/layout.tsx`.
  * Terapkan seluruh CSS Variables warna (`#D93829`, `#F8FAFC`, status badges, warna tema kandidat) dan class `.tabular-nums` di `src/app/globals.css` sesuai `DESIGN_NOTES.md`.
  * Inisialisasi dan sesuaikan komponen `shadcn/ui`: `button`, `input`, `select`, `card`, `table`, `dialog`, `alert-dialog`, `badge`, `progress`, `checkbox`, `sheet`, `sonner` (toast).
  * **Kriteria Selesai (DoD):** Halaman sampel merender font, tombol merah utama (`#D93829`), dan kartu sesuai spesifikasi visual `DESIGN_NOTES.md`.

- [x] **Task 1.3: Setup `QueryClientProvider` & Factory Query Keys**
  * Buat `src/lib/query-keys.ts` berisi struktur query key terpusat (`election`, `candidates`, `voters`, `logs`, `master`).
  * Buat `QueryProvider` di `src/components/shared/query-provider.tsx` dan pasang di `src/app/layout.tsx`.
  * **Kriteria Selesai (DoD):** Aplikasi terbungkus `QueryClientProvider` dengan konfigurasi `staleTime` dan `refetchOnWindowFocus` default yang stabil.

---

## Fase 2: Database Neon, Skema Drizzle ORM & Seeding
Tujuan: Membangun lapisan persistensi data, koneksi dual-driver Neon, trigger keamanan audit log, dan data awal PILKETOS 2026 sesuai `architecture.md`.

- [x] **Task 2.1: Konfigurasi Dual-Driver Neon (`db` & `dbPool`)**
  * Buat `src/db/index.ts` yang mengekspor `db` (`drizzle-orm/neon-http`) dan `dbPool` (`drizzle-orm/neon-serverless` + `ws`).
  * Buat `drizzle.config.ts` yang membaca `DIRECT_DATABASE_URL`.
  * **Kriteria Selesai (DoD):** Koneksi ke Neon PostgreSQL berhasil diuji baik melalui HTTP maupun WebSocket Pool.

- [x] **Task 2.2: Implementasi Skema Drizzle & Migrasi + Trigger Append-Only**
  * Implementasikan `src/db/schema.ts` secara utuh (`users`, `sessions`, `accounts`, `verifications`, `elections`, `election_settings`, `grade_levels`, `majors`, `voter_groups`, `candidates`, `voters`, `voter_sessions`, `votes`, `audit_logs`).
  * Pastikan tabel `votes` **tidak** memiliki kolom `voter_id` dan menggunakan default `date_trunc('minute', now())`.
  * Generate migrasi dengan `pnpm db:generate`, tambahkan SQL trigger `prevent_audit_log_modification()` pada file migrasi untuk memblokir `UPDATE`/`DELETE` di tabel `audit_logs`, lalu jalankan `pnpm db:migrate`.
  * **Kriteria Selesai (DoD):** Seluruh 14 tabel dan index terbentuk di Neon; percobaan `DELETE FROM audit_logs` ditolak oleh PostgreSQL.

- [x] **Task 2.3: Utilitas Kriptografi Token & Seeding Data Awal (`PILKETOS 2026`)**
  * Buat `src/lib/crypto/token.ts` berisi fungsi `generateVoterToken()` (8 karakter alfabet tanpa karakter ambigu), `hashVoterToken()` (HMAC-SHA256 + `timingSafeEqual`), `encryptVoterToken()`, dan `decryptVoterToken()` (AES-256-GCM).
  * Buat `src/lib/audit.ts` berisi helper `insertAuditLog()` yang otomatis memfilter key sensitif (`token`, `password`, `candidateId`).
  * Buat `src/db/seed.ts` untuk mengisi akun Super Admin (`@admin`), pemilihan `PILKETOS 2026 — SMA Bojong Gede`, Tingkat Kelas (`X, XI, XII`), Jurusan (`IPA, IPS`), Rombel (`Rombel 1–7`), 4 Kandidat aktif (#1 Raka, #2 Alya, #3 Dimas, #4 Nadia), dan sampel DPT.
  * **Kriteria Selesai (DoD):** `pnpm db:seed` berjalan sukses dan idempotent.

---

## Fase 3: Sistem Autentikasi Ganda & Middleware Proteksi Route
Tujuan: Mengamankan akses Panel Admin (Better Auth) dan akses Pemilih (Sesi NIS + Token) beserta *rate limiting* dan *lockout*.

- [x] **Task 3.1: Setup Better Auth untuk Admin & Panitia (`super_admin` & `committee`)**
  * Buat `src/lib/auth/admin-auth.ts` dengan Drizzle adapter, plugin `username()` dan `admin()`, serta rate limiter bawaan.
  * Buat Route Handler `src/app/api/auth/[...all]/route.ts` dan client helper `src/lib/auth/admin-client.ts`.
  * Bangun halaman Login Panitia `/admin/login` lengkap dengan pencatatan log `admin_login`.
  * **Kriteria Selesai (DoD):** Super Admin dan Panitia dapat login dengan username/email + password dan diarahkan ke `/admin/dashboard`.

- [x] **Task 3.2: Sistem Sesi Pemilih (NIS + Token), Rate Limit & Lockout**
  * Buat `src/lib/auth/voter-session.ts` untuk mengelola pembuatan, verifikasi, dan penghapusan cookie `HttpOnly` `votera_voter_session`.
  * Buat endpoint `POST /api/voter/login` dan `POST /api/voter/logout` sesuai `API.md` dan `security.md` (termasuk mekanisme lockout 15 menit setelah 5 kali gagal login berturut-turut dan pencatatan `voter_login` / `voter_login_failed`).
  * **Kriteria Selesai (DoD):** Pemilih valid dapat login dan statusnya berubah menjadi `logged_in` (`Sudah login`); percobaan salah ke-5 mengunci akun pemilih dan menambah counter `Login gagal` di log.

- [x] **Task 3.3: Middleware & Guard Otorisasi Role**
  * Buat `src/middleware.ts` dan helper otorisasi server untuk melindungi `/admin/*` (hanya `committee` & `super_admin`) serta `/vote/*` (hanya pemilih bersesi aktif).
  * Jika pemilih dengan `has_voted = true` mengakses `/vote` atau `/login`, otomatis redirect ke `/vote/thanks`.
  * **Kriteria Selesai (DoD):** Pemilih atau pengunjung anonim yang mengakses `/admin/*` atau `/api/admin/*` ditolak dengan redirect atau `403 FORBIDDEN`.

---

## Fase 4: Shell Panel Admin, Data Master & Pengaturan Jadwal
Tujuan: Membangun kerangka navigasi Admin, pengelolaan Tingkat/Jurusan/Rombel, dan pengaturan jadwal pemilihan.

- [x] **Task 4.1: Layout Shell Panel Admin (`AdminSidebar` & `AdminTopbar`)**
  * Bangun `src/app/admin/(panel)/layout.tsx` dengan sidebar kiri tetap `240px` di desktop dan drawer `Sheet` di mobile.
  * Kelompokkan menu sesuai desain: `UTAMA` (Dashboard), `PEMILIHAN` (Kandidat, Pemilih/DPT, Hasil & Laporan), `DATA MASTER` (Tingkat Kelas, Jurusan), dan `SISTEM` (Pengaturan, Log Aktivitas, Kelola Admin). Sembunyikan menu khusus `super_admin` jika yang login adalah `committee`.
  * **Kriteria Selesai (DoD):** Navigasi antar halaman admin berjalan mulus dengan indikator menu aktif berwarna merah (`#D93829`).

- [x] **Task 4.2: Halaman Data Master (`/admin/classes` & `/admin/majors`)**
  * Buat endpoint `/api/admin/master` dan halaman pengelolaan Tingkat Kelas (`grade_levels`), Jurusan (`majors`), serta Rombel (`voter_groups`).
  * **Kriteria Selesai (DoD):** Super Admin dapat menambah, mengubah, dan menghapus Tingkat Kelas, Jurusan, serta Rombel; Panitia dapat melihat daftar tersebut.

- [x] **Task 4.3: Pengaturan Pemilihan, Jadwal Buka-Tutup & Multi-Admin (`/admin/settings` & `/admin/users`)**
  * Buat endpoint `/api/admin/settings` dan halaman `/admin/settings` (plus modal cepat `"Atur jadwal"` dari Dashboard) untuk mengatur nama sekolah/instansi, judul pemilihan, waktu `start_at` & `end_at`, serta label dinamis (`NIS`, `Rombel`, `Tingkat`, `Jurusan`).
  * Buat endpoint `/api/admin/users` dan halaman `/admin/users` bagi `super_admin` untuk menambah/menonaktifkan akun panitia (`committee`).
  * **Kriteria Selesai (DoD):** Perubahan jadwal dan identitas langsung tersimpan, tercatat di `audit_logs`, dan memperbarui status kesiapan pemilihan.

---

## Fase 5: Manajemen Kandidat & Upload Foto (Vercel Blob)
Tujuan: Memungkinkan Super Admin mengelola daftar kandidat beserta foto, visi, misi, program, dan pendukung.

- [x] **Task 5.1: API CRUD Kandidat & Upload Foto ke Vercel Blob**
  * Buat endpoint `POST /api/admin/upload` yang memvalidasi MIME type (`jpeg/png/webp`, maks. 2 MB) dan mengunggah file ke `@vercel/blob` (dengan fallback upload storage lokal).
  * Buat endpoint `GET/POST /api/admin/candidates` dan `PATCH/DELETE /api/admin/candidates/[id]`.
  * **Kriteria Selesai (DoD):** Foto berhasil diunggah dan data kandidat tersimpan dengan validasi Zod.

- [x] **Task 5.2: Halaman Manajemen Kandidat (`/admin/candidates`)**
  * Bangun tabel daftar kandidat sesuai screenshot referensi: menampilkan badge nomor urut (`#1`–`#4`), avatar foto bulat, nama & motto, kelas (`XI IPA`), info kelengkapan (`4 misi, 3 program, 3 pendukung`), badge status `Aktif` hijau, serta tombol `Edit` dan `Hapus`.
  * Bangun form tambah/edit kandidat dengan input dinamis untuk daftar Misi, Program Kerja, dan Pendukung, serta pilihan `themeColor` (`red`, `green`, `blue`, `amber`).
  * **Kriteria Selesai (DoD):** Penambahan/perubahan kandidat langsung meng-invalidate cache kandidat dan dashboard.

---

## Fase 6: Manajemen DPT, Impor Massal CSV/XLSX & Manajemen Token
Tujuan: Membangun fitur operasional utama panitia untuk mengelola pemilih dan mendistribusikan/mereset token.

- [x] **Task 6.1: API DPT (Filter, Paginasi, Salin Token, Reset Token & Impor Massal)**
  * Buat `GET/POST /api/admin/voters` dan `PATCH/DELETE /api/admin/voters/[id]` (tolak `DELETE` jika `has_voted = true`).
  * Buat `POST /api/admin/voters/[id]/reset-token` dan `GET /api/admin/voters/[id]/copy-token`.
  * Buat `POST /api/admin/voters/import` yang memproses batch impor pemilih secara transaksional, mencegah CSV Injection, dan mengembalikan daftar baris yang gagal beserta alasannya.
  * **Kriteria Selesai (DoD):** Impor batch pemilih selesai dengan cepat; reset token menghanguskan token & sesi lama pemilih.

- [x] **Task 6.2: Halaman Manajemen Pemilih / DPT (`/admin/voters`)**
  * Bangun 4 kartu KPI di bagian atas (`Total pemilih`, `Sudah memilih`, `Belum memilih`, `% Partisipasi` dengan progress bar hijau tipis).
  * Bangun bar filter 5 kolom (`Cari pemilih`, `Status`, `Rombel`, `Tingkat`, `Jurusan`).
  * Bangun tabel DPT dengan kolom: `NIS`, `NAMA`, `KELAS`, `TOKEN` (komponen `TokenCopyBadge` monospace + tombol `Salin`), `STATUS` (`Belum memilih`, `Sudah login`, `Sudah memilih` + tanggal), dan `AKSI` (`Reset token`, `Hapus` — otomatis disabled jika `Sudah memilih`).
  * Bangun modal `DptImportDialog` menggunakan PapaParse (CSV) dan SheetJS (XLSX) lengkap dengan laporan validasi per baris dan tombol unduh file template.
  * **Kriteria Selesai (DoD):** Panitia dapat memfilter pemilih, menyalin token dengan 1 klik, mereset token pemilih yang lupa, dan mengimpor file CSV/XLSX.

---

## Fase 7: Layar Publik & Eksplorasi Kandidat
Tujuan: Membangun antarmuka publik dan pemilih yang cepat, responsif (mobile-first), dan sesuai `DESIGN_NOTES.md`.

- [x] **Task 7.1: Beranda Utama (`/`) & Halaman Login Pemilih (`/login`)**
  * Bangun Landing Page (`/`) dengan `PublicNavbar`, badge status `Dibuka` / `Ditutup`, hero banner bendera & kotak suara, teks pengantar di atas background hangat (`#FFF5F3`), tombol `"Masuk untuk memilih"` & `"Masuk sebagai panitia"`, serta kartu info `"4 CALON TERDAFTAR"`.
  * Bangun halaman Login Pemilih (`/login`) dengan header merah bergradasi, kartu putih mengambang (`rounded-[20px]`), form input NIS & Token (dengan toggle mata password), dan pesan error yang ramah pengguna.
  * **Kriteria Selesai (DoD):** Tampilan mobile dan desktop presisi sesuai screenshot referensi.

- [x] **Task 7.2: Halaman Daftar Kandidat (`/candidates`) & Detail Profil (`/candidates/[id]`)**
  * Bangun `/candidates` yang menampilkan kartu horizontal kandidat (`CandidateProfileCard`): foto potret 3:4 dengan badge `#1` merah di sudut kiri atas, nama, motto, 3 *outline mission pills* berwarna sesuai `themeColor` kandidat, dan tombol `"Lihat Profil ->"`.
  * Bangun `/candidates/[id]` dengan tautan kembali `"<- Semua kandidat"`, label merah `"KANDIDAT NOMOR 1"`, judul nama & motto, foto kandidat, serta kartu-kartu putih beraksen garis merah (`— Visi`, `— Misi`, `— Program Kerja`, `— Pendukung`).
  * **Kriteria Selesai (DoD):** Pemilih dapat membaca profil lengkap seluruh kandidat aktif dengan nyaman di HP maupun laptop.

---

## Fase 8: Surat Suara Digital Atomik & Konfirmasi Memilih
Tujuan: Mengimplementasikan inti transaksi pemungutan suara yang menjamin 1 orang 1 suara dan kerahasiaan mutlak.

- [x] **Task 8.1: Transaksi Server `castVoteTransaction` & Endpoint `POST /api/voter/vote`**
  * Implementasikan `src/lib/voting/cast-vote.ts` menggunakan `dbPool.transaction` sesuai `security.md` (cek jadwal server, cek kandidat aktif, atomic conditional update `WHERE id = ? AND has_voted = false`, insert ke `votes` tanpa `voter_id`, insert ke `audit_logs` tanpa `candidate_id`).
  * Hubungkan ke Route Handler `POST /api/voter/vote` dan panggil invalidasi cache hasil.
  * **Kriteria Selesai (DoD):** Dua request paralel dari pemilih yang sama dijamin hanya menghasilkan tepat 1 baris suara di `votes`.

- [x] **Task 8.2: Halaman Surat Suara (`/vote`) & Bukti Memilih (`/vote/thanks`)**
  * Bangun `/vote` dengan grid 4 kolom di desktop (1 kolom di mobile) berisi `BallotCandidateCard` interaktif, bar bawah `StickyBallotBar`, dan modal konfirmasi (`AlertDialog`) sebelum benar-benar mengirim suara.
  * Bangun `/vote/thanks` dengan ikon lingkaran centang hijau (`64px`), label `"SUARA TERCATAT"`, ucapan `"Terima kasih, [Nama Pemilih]!"`, serta tombol `"Keluar"` dan `"Lihat kandidat"`.
  * **Kriteria Selesai (DoD):** Alur memilih dari ketuk kartu -> konfirmasi -> layar terima kasih berjalan dalam < 2 detik dan mengunci akses kembali ke `/vote`.

---

## Fase 9: Dashboard Admin & Hasil Pemilihan Real-Time (Polling)
Tujuan: Menyajikan metrik pemantauan langsung dan perolehan suara kepada panitia menggunakan TanStack Query Polling + Server Cache.

- [x] **Task 9.1: Endpoint Agregasi Ter-cache & Halaman Dashboard (`/admin/dashboard`)**
  * Buat `GET /api/admin/dashboard` dengan query agregasi `COUNT`.
  * Bangun `/admin/dashboard`: banner sambutan (tombol `"Lihat beranda"` & `"Atur jadwal"`), kartu status jadwal aktif, 4 kartu KPI berikon, kartu `"Partisipasi per kelas"` (progress bar merah per Rombel), dan kartu `"Kesiapan pemilihan"` (4 syarat dengan status `Siap`).
  * **Kriteria Selesai (DoD):** Dashboard memperbarui angka partisipasi secara otomatis lewat polling tanpa membebani database.

- [x] **Task 9.2: Endpoint Hasil & Halaman Hasil Pemilihan Real-Time (`/admin/results`)**
  * Buat `GET /api/admin/results` (hanya untuk `committee` dan `super_admin`).
  * Bangun `/admin/results`: kartu info periode pemilihan, 4 kartu KPI, bagian `"Perolehan suara"` dengan badge hijau `"Unggul: No. 1 Raka Aditya Pratama"`, grid 4 kolom kandidat (kandidat peringkat 1 memiliki border & progress bar merah), visualisasi distribusi komparatif, dan checkbox `"Segarkan otomatis tiap 30 detik"` (mode hemat).
  * **Kriteria Selesai (DoD):** Angka suara dan persentase tampil dengan `tabular-nums` dan ter-update otomatis sesuai interval polling.

---

## Fase 10: Log Aktivitas (*Append-Only*) & Ekspor Laporan (PDF / Excel)
Tujuan: Menyediakan transparansi jejak audit dan fitur unduh laporan berita acara pemilihan.

- [x] **Task 10.1: Halaman Log Aktivitas Read-Only (`/admin/logs`)**
  * Buat `GET /api/admin/logs` dan halaman `/admin/logs` dengan 4 kartu KPI (`Total catatan`, `Aktivitas panitia`, `Aktivitas pemilih`, `Percobaan gagal`), bar filter 5 kolom (`Cari`, `Pelaku`, `Aksi`, `Dari tanggal`, `Sampai tanggal`), dan tabel *read-only* dengan badge pelaku (`Panitia` merah / `Pemilih` hijau), badge aksi monospace (`vote_cast`, `voter_login`), dan alamat IP (`::1`).
  * **Kriteria Selesai (DoD):** Seluruh aktivitas sistem tercatat secara kronologis dan tidak ada tombol edit/hapus di UI maupun API.

- [x] **Task 10.2: Generator Laporan Resmi PDF & Excel (`src/lib/reports/`)**
  * Buat `export-pdf.ts` (`jspdf` + `jspdf-autotable`) untuk menghasilkan dokumen Berita Acara Rekapitulasi Hasil Pemilihan (berisi ringkasan DPT, tabel perolehan suara kandidat, tabel partisipasi per kelas/rombel, dan kolom tanda tangan panitia/saksi).
  * Buat `export-excel.ts` (`xlsx`) untuk mengekspor rekapitulasi multi-sheet (Sheet 1: Ringkasan, Sheet 2: Hasil Kandidat, Sheet 3: Partisipasi Rombel, Sheet 4: Audit Log Ledger).
  * Hubungkan ke tombol `"Ekspor Excel"` dan `"Berita Acara PDF"` di `/admin/results` dan `/admin/logs`.
  * **Kriteria Selesai (DoD):** File PDF dan `.xlsx` berhasil diunduh dengan format rapi dan angka yang akurat.

---

## Fase 11: Pengujian Otomatis (Unit, Integrasi & E2E)
Tujuan: Memastikan seluruh skenario keamanan dan bisnis di `TESTING.md` lulus uji sebelum produksi.

- [x] **Task 11.1: Unit & Integration Tests (Vitest)**
  * Tulis pengujian untuk generator/enkripsi token, laporan PDF/Excel, autentikasi Better Auth & sesi pemilih, serta pengujian konkurensi `castVoteTransaction` (simulasi race condition dari pemilih yang sama).
  * **Kriteria Selesai (DoD):** `pnpm test` lulus 100% (24/24 tests lolos di 5 test files); pengujian race condition membuktikan hanya 1 suara yang masuk.

- [x] **Task 11.2: End-to-End Tests (Vitest Integration Suite)**
  * Tulis pengujian E2E siklus pemilu utuh (`tests/integration/e2e-voting-lifecycle.test.ts`): Kesiapan Pemilihan -> Dekripsi Token -> Voting Atomik -> Double-Voting Immunity -> Audit Trail Anonim -> Ekspor Berita Acara PDF & Excel.
  * **Kriteria Selesai (DoD):** Seluruh pengujian siklus hidup e-voting lulus tanpa error.

---

## Fase 12: Polishing, Dokumentasi & Persiapan Deployment
Tujuan: Menyelesaikan pengecekan akhir aksesibilitas, responsivitas, dan kesiapan produksi Vercel + Neon.

- [x] **Task 12.1: Audit UI/UX, Aksesibilitas & Build Produksi**
  * Periksa fokus keyboard (`focus-visible:ring`), ukuran tap target mobile (`min-h-[44px]`), empty states, dan loading skeletons di seluruh layar.
  * Jalankan `pnpm typecheck`, `pnpm lint`, dan `pnpm build`.
  * **Kriteria Selesai (DoD):** Build produksi Next.js sukses (34/34 routes terkompilasi) dengan 0 error dan siap di-deploy ke Vercel sesuai `DEPLOYMENT.md`.
