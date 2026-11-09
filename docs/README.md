# Votera — Platform E-Voting & Pemilihan Online Multi-Instansi

**Votera** (*Voting Terpadu & Rahasia*) adalah aplikasi web pemungutan suara elektronik (*e-voting*) modern yang dirancang dengan jaminan **1 Orang 1 Suara (Atomik)** dan **Kerahasiaan Suara Mutlak (*Unlinkable Anonymous Ballot*)**.

Secara bawaan (*default preset*), Votera dikonfigurasi untuk **Pemilihan Ketua OSIS (PILKETOS 2026 — SMA Bojong Gede)**, namun arsitektur *multi-election* di dalamnya memungkinkan aplikasi ini dikustomisasi dengan mudah untuk:
* Pemilihan Ketua & Pengurus OSIS / MPK (SMP/SMA/SMK)
* Pemilihan Ketua BEM / HMJ / UKM Kampus
* Pemilihan Ketua RT / RW / Kepala Desa (Kades) / Karang Taruna
* Pemilihan Ketua Koperasi, Komunitas, Ikatan Alumni, atau Ketua Kelas

---

## ✨ Fitur Utama

### Sisi Pemilih (Public & Voter Portal)
* **Responsif & Mobile-First:** Nyaman diakses dari browser smartphone pemilih maupun tablet/PC bilik suara.
* **Eksplorasi Kandidat Lengkap:** Menampilkan foto potret kandidat, nomor urut, motto, visi, misi berwarna, program kerja, dan daftar pendukung.
* **Login Cepat (ID/NIS + Token Unik):** Masuk menggunakan Nomor Identitas (NIS/NIM/NIK) dan token alfanumerik 8 karakter tanpa karakter ambigu.
* **Surat Suara Digital Atomik:** Antarmuka pencoblosan satu ketukan dengan dialog konfirmasi dan transaksi database atomik yang mencegah *double-voting*.
* **100% Rahasia (*Unlinkable Ballot*):** Tabel `votes` sama sekali tidak menyimpan `voter_id` atau alamat IP pemilih.

### Sisi Panitia & Super Admin (Committee Panel)
* **Dashboard Kesiapan & Monitoring Real-Time:** Kartu KPI partisipasi, progress bar partisipasi per kelas/rombel, dan indikator 4 syarat kesiapan pemilihan.
* **Manajemen DPT & Impor Massal (CSV/XLSX):** Tambah/edit pemilih, filter 5 kolom (Cari, Status, Rombel, Tingkat, Jurusan), serta impor ribuan baris DPT dengan validasi per baris.
* **Manajemen Token Praktis:** Fitur **Salin Token** sekali klik dari tabel DPT dan **Reset Token** bagi pemilih yang lupa token (selama belum memilih).
* **Hasil Pemilihan Real-Time (Polling Ter-cache):** Perhitungan suara langsung menggunakan TanStack Query v5 polling dengan caching agregasi server yang hemat beban database.
* **Log Aktivitas Anti-Curang (*Append-Only*):** Jejak audit lengkap (*read-only*) untuk seluruh aktivitas admin dan pemilih yang dilindungi oleh trigger PostgreSQL.
* **Ekspor Berita Acara (PDF & Excel):** Unduh laporan resmi hasil pemilihan dan rekapitulasi partisipasi siap cetak.

---

## 🛠️ Tech Stack

* **Framework:** Next.js 15 (App Router) + React 19 + TypeScript (Node.js Runtime)
* **UI & Styling:** Tailwind CSS + `shadcn/ui` + Lucide Icons (`DESIGN_NOTES.md` compliant)
* **Database:** Neon Serverless PostgreSQL (`@neondatabase/serverless`)
* **ORM & Migrations:** Drizzle ORM + `drizzle-kit`
* **Authentication:** Better Auth (Admin/Panitia Multi-Role) + Custom Encrypted Voter Session
* **State & Real-Time Polling:** TanStack Query v5 (`useQuery` polling + Next.js Server Cache)
* **Form & Validation:** React Hook Form + Zod
* **File Parsing & Export:** PapaParse (CSV), SheetJS/`xlsx` (Excel), jsPDF + AutoTable (PDF)
* **Object Storage:** Vercel Blob (Upload Foto Kandidat)
* **Testing:** Vitest (Unit/Integration) + Playwright (E2E)
* **Package Manager:** `pnpm`

---

## 📋 Prasyarat (Prerequisites)

Pastikan perangkat Anda telah terinstal:
1. **Node.js** versi `20.x` atau `22.x` LTS
2. **pnpm** versi `9.x` (`npm install -g pnpm`)
3. Akun dan proyek database **Neon PostgreSQL** (https://neon.tech)

---

## ⚙️ Konfigurasi Environment Variables (`.env.example`)

Salin file `.env.example` menjadi `.env.local` dan lengkapi seluruh variabel berikut:

```dotenv
# ==============================================================================
# 1. APPLICATION URL & ENVIRONMENT
# ==============================================================================
# URL dasar aplikasi (tanpa trailing slash). Gunakan URL produksi saat di Vercel.
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"

# ==============================================================================
# 2. NEON SERVERLESS POSTGRESQL (WAJIB PISAHKAN POOLED VS DIRECT!)
# ==============================================================================
# A. DATABASE_URL (POOLED CONNECTION - Memakai "-pooler" pada hostname Neon)
# Digunakan oleh runtime aplikasi Next.js (baik driver neon-http maupun neon-serverless Pool).
# Mampu menangani ratusan koneksi konkuren dari Serverless Functions.
DATABASE_URL="postgresql://neondb_owner:password@ep-cool-name-123456-pooler.ap-southeast-1.aws.neon.tech/votera?sslmode=require"

# B. DIRECT_DATABASE_URL (UNPOOLED CONNECTION - TANPA "-pooler" pada hostname Neon)
# Digunakan HANYA oleh drizzle-kit (db:migrate / db:push) dan script db:seed untuk operasi DDL/migrasi.
DIRECT_DATABASE_URL="postgresql://neondb_owner:password@ep-cool-name-123456.ap-southeast-1.aws.neon.tech/votera?sslmode=require"

# ==============================================================================
# 3. BETTER AUTH (AUTENTIKASI PANEL ADMIN & PANITIA)
# ==============================================================================
# Secret acak minimal 32 karakter untuk menandatangani sesi Better Auth.
# Generate dengan: openssl rand -base64 32
BETTER_AUTH_SECRET="ganti_dengan_secret_acak_32_karakter_minimal_disini"
BETTER_AUTH_URL="http://localhost:3000"

# ==============================================================================
# 4. KRIPTOGRAFI TOKEN & SESI PEMILIH (SECURITY-CRITICAL)
# ==============================================================================
# Secret untuk HMAC-SHA256 hashing token pemilih saat verifikasi login cepat.
# Generate dengan: openssl rand -hex 32
TOKEN_HMAC_SECRET="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

# Kunci enkripsi AES-256-GCM (WAJIB tepat 64 karakter hex = 32 bytes) untuk mendekripsi
# token pemilih pada fitur "Salin Token" di tabel DPT Admin.
# Generate dengan: openssl rand -hex 32
TOKEN_ENCRYPTION_KEY="fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"

# Secret untuk menandatangani cookie sesi pemilih (votera_voter_session).
VOTER_SESSION_SECRET="ganti_dengan_secret_sesi_pemilih_acak_32_karakter"

# ==============================================================================
# 5. STORAGE FOTO KANDIDAT (VERCEL BLOB)
# ==============================================================================
# Token Read/Write dari Vercel Dashboard -> Storage -> Blob.
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_xxxxxxxxxxxxxxxxxxxxxxxx"

# ==============================================================================
# 6. SEEDING DATA AWAL (OPSIONAL - HANYA UNTUK pnpm db:seed)
# ==============================================================================
INITIAL_ADMIN_USERNAME="admin"
INITIAL_ADMIN_EMAIL="admin@smabojonggede.sch.id"
INITIAL_ADMIN_PASSWORD="AdminPilketos2026!Secure"

🚀 Cara Instalasi & Menjalankan Proyek
1. Clone & Instal Dependensi
Bash

git clone <repository-url> votera
cd votera
pnpm install

2. Siapkan Environment Variables
Bash

cp .env.example .env.local
# Edit .env.local dan masukkan connection string Neon serta secret key Anda

3. Jalankan Migrasi Database & Seeding Data Awal
Bash

# Generate dan jalankan migrasi skema ke Neon PostgreSQL
pnpm db:migrate

# Isi data demo awal PILKETOS 2026 (Super Admin, 4 Kandidat, Rombel, & DPT contoh)
pnpm db:seed

4. Jalankan Server Development
Bash

pnpm dev

    Portal Publik & Pemilih: Buka http://localhost:3000

    Panel Admin & Panitia: Buka http://localhost:3000/admin/login

        Login menggunakan username admin dan password sesuai INITIAL_ADMIN_PASSWORD di .env.local.

        Buka menu Pemilih (DPT) (/admin/voters), klik tombol Salin pada salah satu baris pemilih, lalu uji login pemilih di /login.

📁 Struktur Ringkas Proyek
Plaintext

votera/
├── drizzle/               # File migrasi SQL & snapshot skema Drizzle
├── public/                # Aset statis (logo default, banner bendera/kotak suara)
├── src/
│   ├── app/
│   │   ├── (public)/      # Layar Pemilih: /, /login, /candidates, /vote, /vote/thanks
│   │   ├── admin/         # Layar Panitia: /admin/login, /admin/dashboard, candidates, voters, results, logs
│   │   └── api/           # Route Handlers: /api/auth, /api/voter/*, /api/admin/*
│   ├── components/
│   │   ├── ui/            # Komponen dasar shadcn/ui
│   │   ├── voter/         # Komponen surat suara, kartu kandidat, sticky bar
│   │   └── admin/         # Sidebar, kartu KPI, badge salin token, dialog impor DPT
│   ├── db/                # Konfigurasi dual-driver Neon (index.ts), schema.ts, & seed.ts
│   ├── hooks/             # Custom hooks TanStack Query v5 (polling hasil & dashboard)
│   └── lib/               # Helper auth, enkripsi token, transaksi voting atomik, parser CSV/XLSX, PDF/Excel
├── drizzle.config.ts      # Konfigurasi Drizzle Kit (memakai DIRECT_DATABASE_URL)
└── package.json

📚 Dokumentasi Arsitektur Lengkap

Repositori ini dilengkapi spesifikasi teknis menyeluruh untuk pengembang maupun AI Coding Agent:

    PRD.md — Spesifikasi kebutuhan produk, persona, dan cakupan fitur.

    user-flow.md — Matriks RBAC, diagram alur pemilih/panitia, dan state machine pemilih.

    architecture.md — ERD, skema Drizzle lengkap, dan strategi dual-driver Neon.

    security.md — Model ancaman, transaksi 1 orang 1 suara, enkripsi token, & proteksi audit log.

    tech-stack.md — Rincian stack terkunci, struktur folder, dan pola polling TanStack Query.

    DESIGN_NOTES.md — Pemetaan token visual ke Tailwind CSS & shadcn/ui.

    API.md — Kontrak endpoint Route Handler, validasi Zod, dan kode error.

    AGENTS.md — Panduan dan larangan wajib bagi AI Coding Agent.

    TASKS.md — Breakdown implementasi bertahap dari Fase 1 hingga Fase 12.

    TESTING.md — Skenario pengujian keamanan, konkurensi, dan E2E.

    DEPLOYMENT.md — Panduan produksi Vercel + Neon & checklist Hari-H pemilihan.

    CUSTOMIZATION.md — Panduan mengubah branding untuk RT/RW, Kampus, atau Koperasi.
