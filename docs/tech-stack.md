# Technology Stack & Project Structure — Votera

**Nama Aplikasi:** Votera  
**Versi Dokumen:** 1.0.0  
**Status Stack:** Locked (Tidak Boleh Diganti)  

---

## 1. Daftar Teknologi & Versi (Locked Stack)

Seluruh teknologi di bawah ini telah dikunci untuk menjamin kompatibilitas dengan lingkungan *Serverless* Vercel dan Neon PostgreSQL:

| Kategori | Teknologi / Package | Versi Target | Alasan Pemilihan & Peran Utama |
| :--- | :--- | :--- | :--- |
| **Framework** | `next` (App Router) + `react` | `^15.x` / `^19.x` | Mendukung React Server Components (RSC), Route Handlers, Server Actions, dan *built-in caching* pada runtime Node.js. |
| **Language** | `typescript` | `^5.7.x` | *Strict type-safety* dari skema database (Drizzle) hingga validasi form di klien (Zod). |
| **Package Manager** | `pnpm` | `^9.x` | Cepat, hemat ruang disk via *content-addressable store*, dan deterministik dengan `pnpm-lock.yaml`. |
| **Styling & UI** | `tailwindcss` + `shadcn/ui` + `lucide-react` | `^3.4.x` / `latest` | Komponen berbasis Radix UI yang aksesibel, mudah dikustomisasi sesuai token `DESIGN_NOTES.md`. |
| **Database** | **Neon Serverless PostgreSQL** | PostgreSQL 16 | *Serverless Postgres* dengan *connection pooling* bawaan (PgBouncer), *database branching*, dan *point-in-time restore*. (Tanpa Supabase). |
| **ORM & Migrasi** | `drizzle-orm` + `drizzle-kit` | `^0.39.x` / `^0.30.x` | *Zero-overhead TypeScript ORM* yang mendukung dual-driver (`neon-http` & `neon-serverless`). |
| **Database Driver** | `@neondatabase/serverless` + `ws` | `^0.10.x` | Menyediakan fungsi `neon()` (HTTP cepat) dan `Pool` (WebSocket untuk transaksi atomik submit suara). |
| **Authentication** | `better-auth` | `^1.2.x` | Sistem autentikasi TypeScript modern dengan Drizzle adapter, plugin `username`, `admin` (RBAC), dan *rate-limiting* bawaan. |
| **Client State & Polling**| `@tanstack/react-query` | `^5.66.x` | Mengelola *data fetching*, mutasi, invalidasi cache, dan *real-time HTTP polling* (5–10 detik, default 8 detik) yang hemat sumber daya. |
| **Form & Validasi** | `react-hook-form` + `zod` + `@hookform/resolvers` | `^7.54.x` / `^3.24.x` | Validasi skema tunggal (*shared schema*) yang dipakai bersama di sisi klien maupun server. |
| **Grafik & Visualisasi**| `recharts` (via `shadcn/ui` chart) | `^2.15.x` | Visualisasi grafik hasil pemilihan dan distribusi partisipasi per kelas yang responsif. |
| **Impor DPT (CSV/XLSX)**| `papaparse` + `xlsx` (SheetJS) | `^5.5.x` / `^0.18.5` | Parsing cepat file CSV dan Excel untuk impor DPT massal beserta validasi baris gagal. |
| **Object Storage** | `@vercel/blob` (**Dipilih**) | `^0.27.x` | Penyimpanan foto kandidat terintegrasi langsung dengan hosting Vercel tanpa konfigurasi bucket S3/CORS manual. |
| **Ekspor Laporan** | `jspdf` + `jspdf-autotable` + `xlsx` | `^2.5.x` / `^3.8.x` | Pembuatan dokumen laporan resmi hasil pemilihan berformat PDF siap cetak dan Excel (`.xlsx`). |
| **Testing** | `vitest` + `@playwright/test` | `^3.x` / `^1.50.x` | Unit & integration testing logika bisnis/transaksi serta E2E browser testing alur pemilih & admin. |

---

## 2. Keputusan Teknis Spesifik

### 2.1. Penyimpanan Foto Kandidat: Mengapa Memilih **Vercel Blob** (Bukan Cloudflare R2)
Karena aplikasi di-host di **Vercel**, pemilihan `@vercel/blob` memberikan keunggulan arsitektural langsung untuk skala foto kandidat (biasanya hanya 2–10 foto per pemilihan):
1. **Zero-Config Integration:** Cukup satu variabel `BLOB_READ_WRITE_TOKEN` yang otomatis diinjeksikan oleh Vercel Dashboard tanpa perlu membuat akun AWS/Cloudflare terpisah, mengatur IAM policy, Access Key, Secret Key, maupun aturan CORS S3.
2. **Global CDN Otomatis:** URL foto kandidat yang dikembalikan oleh fungsi `put()` sudah otomatis didistribusikan melalui Edge Network dan langsung kompatibel dengan komponen `<Image />` Next.js.

### 2.2. Arsitektur Autentikasi Ganda (Better Auth Admin vs Custom Voter Session)
Terdapat perbedaan mendasar antara karakteristik akun **Panitia/Admin** dan **Pemilih (Voter)**:
- **Admin & Panitia (`super_admin` & `committee`):** Merupakan akun jangka panjang, memiliki email, username, password, dan manajemen peran. Oleh karena itu, Admin menggunakan **Better Auth** penuh dengan plugin `username()` dan `admin()` yang disimpan di tabel `users`, `sessions`, dan `accounts`.
- **Pemilih (`voter`):** Terikat pada satu acara pemilihan (`election_id`), login menggunakan `NIS + Token 8 karakter`, jumlahnya mencapai ribuan baris hasil impor Excel, dan sesinya bersifat sekali pakai hingga suara dikirim.
  - **Rekomendasi yang Dipilih:** Menggunakan **Sesi Terpisah Khusus Pemilih (`voter_sessions` + Cookie `votera_voter_session` HttpOnly)** yang terisolasi dari sesi Better Auth (`better-auth.session_token`).
  - **Alasan:**
    1. **Keamanan & Isolasi Konteks:** Seorang panitia yang sedang menguji tampilan di browser yang sama tidak akan mengalami bentrok sesi (*session collision*) antara sesi Admin dan sesi Pemilih.
    2. **Efisiensi Impor Massal:** Mengimpor 2.000 baris siswa ke tabel `voters` tidak akan mengotori tabel `users` dan `accounts` milik Better Auth.
    3. **Kontrol Penuh Siklus Hidup Token:** Saat panitia menekan **"Reset token"**, sistem cukup menghapus baris di `voter_sessions` berdasarkan `voter_id` tanpa menyentuh tabel sesi admin.

### 2.3. Konfigurasi Dual-Connection Neon (Pooled vs Direct)
Neon menyediakan dua jenis *connection string*:
1. **`DATABASE_URL` (Pooled — memakai `-pooler` di hostname):**
   - Mengarah ke PgBouncer Neon (mendukung hingga ribuan koneksi konkuren).
   - **Wajib dipakai oleh runtime aplikasi Next.js** baik pada `drizzle-orm/neon-http` maupun `drizzle-orm/neon-serverless` (`Pool`).
2. **`DIRECT_DATABASE_URL` (Unpooled — tanpa `-pooler`):**
   - Koneksi langsung ke instance PostgreSQL.
   - **Wajib dipakai hanya oleh `drizzle-kit` (`pnpm db:migrate` / `pnpm db:push`)** dan script seeding (`pnpm db:seed`).

### 2.4. Strategi Real-Time via TanStack Query v5 (HTTP Polling + Server Cache)
Untuk menjaga kesederhanaan arsitektur tanpa ketergantungan pada layanan WebSocket pihak ketiga, pembaruan data *real-time* pada **Dashboard Admin (`/admin/dashboard`)** dan **Hasil Pemilihan (`/admin/results`)** menggunakan mekanisme **Smart HTTP Polling**:

1. **Di Sisi Klien (TanStack Query v5):**
   - `refetchInterval`: `8000` (default 8 detik) saat pemungutan suara sedang berlangsung (`status === 'open'`), atau `30000` (30 detik sebagai mode hemat) ketika checkbox *"Segarkan otomatis tiap 30 detik"* diaktifkan pada layar hasil.
   - `refetchIntervalInBackground: false`: Polling otomatis berhenti saat tab browser diminimalkan atau tidak aktif, menghemat kuota request secara drastis.
   - `staleTime: 4000`: Mencegah *duplicate refetch* di antara komponen yang memakai *query key* yang sama.
2. **Di Sisi Server (Endpoint Agregat Ter-cache):**
   - Route Handler `/api/admin/results` dan `/api/admin/dashboard-stats` menggunakan `unstable_cache` Next.js (atau `Cache-Control: private, max-age=3, stale-while-revalidate=2`) dengan masa berlaku **3–5 detik**.
   - Artinya, walaupun ada **50 panitia** membuka layar hasil secara bersamaan, database Neon hanya akan menerima **maksimal 1 query agregat `COUNT` setiap 3–5 detik**.
3. **Opsi Upgrade Masa Depan (Post-MVP):**
   - Jika di masa depan aplikasi digunakan untuk pemilihan tingkat nasional/universitas raksasa dengan ratusan ribu pengamat publik serentak, lapisan transport dapat di-upgrade ke **Server-Sent Events (SSE)** atau **Pusher / Ably** cukup dengan mengganti *fetcher* di dalam custom hook `useElectionResults()` tanpa mengubah skema database maupun komponen UI.

---

## 3. Struktur Folder Proyek Lengkap

```text
votera/
├── drizzle/
│   └── migrations/                  # File SQL hasil generate drizzle-kit
├── public/
│   ├── images/
│   │   ├── logo-default.png         # Logo default sekolah/instansi
│   │   └── hero-flag-ballot.jpg     # Ilustrasi bendera & kotak suara merah putih
├── src/
│   ├── app/
│   │   ├── (public)/                # Route Group: Layar Publik & Pemilih
│   │   │   ├── page.tsx             # Landing Page PILKETOS (/)
│   │   │   ├── login/
│   │   │   │   └── page.tsx         # Halaman Login Pemilih (/login)
│   │   │   ├── candidates/
│   │   │   │   ├── page.tsx         # Daftar Kandidat & Misi (/candidates)
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx     # Detail Profil & Visi Kandidat (/candidates/[id])
│   │   │   └── vote/
│   │   │       ├── page.tsx         # Surat Suara Digital (/vote)
│   │   │       └── thanks/
│   │   │           └── page.tsx     # Konfirmasi Suara Tercatat (/vote/thanks)
│   │   ├── admin/                   # Route Group: Panel Panitia & Super Admin
│   │   │   ├── login/
│   │   │   │   └── page.tsx         # Login Panitia (/admin/login)
│   │   │   └── (panel)/             # Layout bersidebar tetap (240px)
│   │   │       ├── layout.tsx       # Sidebar + Topbar Shell
│   │   │       ├── dashboard/
│   │   │       │   └── page.tsx     # Dashboard Ringkasan & Kesiapan (/admin/dashboard)
│   │   │       ├── candidates/
│   │   │       │   └── page.tsx     # Manajemen Kandidat (/admin/candidates)
│   │   │       ├── voters/
│   │   │       │   └── page.tsx     # Manajemen DPT, Impor & Token (/admin/voters)
│   │   │       ├── results/
│   │   │       │   └── page.tsx     # Hasil Real-Time & Laporan (/admin/results)
│   │   │       ├── classes/
│   │   │       │   └── page.tsx     # Data Master Tingkat & Rombel (/admin/classes)
│   │   │       ├── majors/
│   │   │       │   └── page.tsx     # Data Master Jurusan (/admin/majors)
│   │   │       ├── settings/
│   │   │       │   └── page.tsx     # Pengaturan Jadwal & Instansi (/admin/settings)
│   │   │       ├── logs/
│   │   │       │   └── page.tsx     # Log Aktivitas Read-Only (/admin/logs)
│   │   │       └── users/
│   │   │           └── page.tsx     # Kelola Admin Multi-Role (/admin/users)
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── [...all]/
│   │   │   │       └── route.ts     # Handler Better Auth (Admin)
│   │   │   ├── voter/
│   │   │   │   ├── login/route.ts   # POST login NIS + Token
│   │   │   │   ├── logout/route.ts  # POST logout pemilih
│   │   │   │   └── vote/route.ts    # POST submit suara atomik
│   │   │   └── admin/
│   │   │       ├── dashboard/route.ts       # GET metrik dashboard & kesiapan (Cached)
│   │   │       ├── results/route.ts         # GET agregat hasil real-time (Cached)
│   │   │       ├── candidates/route.ts      # GET, POST kandidat
│   │   │       ├── candidates/[id]/route.ts # PATCH, DELETE kandidat
│   │   │       ├── upload/route.ts          # POST upload foto ke Vercel Blob
│   │   │       ├── voters/route.ts          # GET (paginated + filter), POST pemilih
│   │   │       ├── voters/[id]/route.ts     # PATCH, DELETE pemilih
│   │   │       ├── voters/[id]/reset-token/route.ts # POST reset token pemilih
│   │   │       ├── voters/[id]/copy-token/route.ts  # GET dekripsi token untuk disalin
│   │   │       ├── voters/import/route.ts   # POST batch import CSV/XLSX
│   │   │       ├── master/route.ts          # CRUD tingkat kelas, jurusan, rombel
│   │   │       ├── settings/route.ts        # GET, PUT jadwal & konfigurasi pemilihan
│   │   │       ├── logs/route.ts            # GET audit logs (paginated + filter)
│   │   │       └── users/route.ts           # CRUD akun panitia (khusus super_admin)
│   │   ├── globals.css              # CSS Variables (Token DESIGN_NOTES.md) & Tailwind
│   │   ├── layout.tsx               # Root Layout + QueryProvider + Toaster
│   ├── components/
│   │   ├── ui/                      # Komponen dasar shadcn/ui
│   │   ├── voter/                   # Komponen khusus sisi pemilih (BallotCard, MissionPill, dll.)
│   │   ├── admin/                   # Komponen khusus admin (Sidebar, StatCard, TokenBadge, dll.)
│   │   └── shared/                  # Komponen bersama (StatusBadge, BrandHeader, EmptyState)
│   ├── db/
│   │   ├── index.ts                 # Inisialisasi db (neon-http) & dbPool (neon-serverless)
│   │   ├── schema.ts                # Skema tabel & relasi Drizzle ORM
│   │   └── seed.ts                  # Script seeding data awal PILKETOS 2026
│   ├── hooks/
│   │   ├── use-election-results.ts  # Hook polling hasil pemilihan (TanStack Query)
│   │   ├── use-dashboard-stats.ts   # Hook polling statistik dashboard
│   │   ├── use-voters.ts            # Hook query & mutasi DPT + invalidasi cache
│   │   └── use-audit-logs.ts        # Hook query log aktivitas
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── admin-auth.ts        # Konfigurasi Better Auth + Drizzle Adapter
│   │   │   ├── admin-client.ts      # Client helper Better Auth
│   │   │   └── voter-session.ts     # Manajemen cookie & verifikasi sesi pemilih
│   │   ├── crypto/
│   │   │   └── token.ts             # Generator token 8-char, HMAC-SHA256, AES-256-GCM
│   │   ├── voting/
│   │   │   └── cast-vote.ts         # Transaksi atomik submit suara (dbPool)
│   │   ├── importers/
│   │   │   └── dpt-parser.ts        # Parser & validator baris CSV (PapaParse) / XLSX (SheetJS)
│   │   ├── exporters/
│   │   │   ├── export-pdf.ts        # Generator laporan berita acara PDF
│   │   │   └── export-excel.ts      # Generator laporan Excel
│   │   ├── audit.ts                 # Helper pencatat append-only audit_logs
│   │   ├── query-keys.ts            # Factory terpusat untuk TanStack Query Keys
│   │   ├── validations/             # Skema Zod (voter, candidate, settings, import)
│   │   └── utils.ts                 # Helper cn(), format tanggal WIB, format persentase
│   └── middleware.ts                # Proteksi route /admin/* dan /vote/*
├── .env.example
├── drizzle.config.ts
├── next.config.ts
├── package.json
├── tailwind.config.ts
└── tsconfig.json
4. Arsitektur TanStack Query v5: Query Keys, Polling & Invalidasi
4.1. Struktur Query Key Terpusat (src/lib/query-keys.ts)
TypeScript
export const queryKeys = {
  election: {
    all: ["election"] as const,
    settings: (electionId: string) => ["election", electionId, "settings"] as const,
    dashboard: (electionId: string) => ["election", electionId, "dashboard"] as const,
    results: (electionId: string) => ["election", electionId, "results"] as const,
  },
  candidates: {
    all: (electionId: string) => ["candidates", electionId] as const,
    detail: (electionId: string, id: string) => ["candidates", electionId, id] as const,
  },
  voters: {
    all: (electionId: string) => ["voters", electionId] as const,
    list: (electionId: string, filters: Record<string, unknown>) =>
      ["voters", electionId, "list", filters] as const,
  },
  logs: {
    list: (electionId: string, filters: Record<string, unknown>) =>
      ["logs", electionId, "list", filters] as const,
  },
  master: {
    groups: (electionId: string) => ["master", electionId, "groups"] as const,
  },
};
4.2. Contoh Implementasi Hook Polling Hasil (src/hooks/use-election-results.ts)
TypeScript
"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

export function useElectionResults(electionId: string, autoRefresh = true) {
  return useQuery({
    queryKey: queryKeys.election.results(electionId),
    queryFn: async () => {
      const res = await fetch(`/api/admin/results?electionId=${electionId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Gagal memuat hasil pemilihan");
      }
      return res.json();
    },
    staleTime: 4_000, // Data dianggap segar selama 4 detik
    refetchInterval: autoRefresh ? 8_000 : false, // Polling setiap 8 detik jika aktif
    refetchIntervalInBackground: false, // Berhenti polling saat tab tidak aktif
    retry: 2,
  });
}
4.3. Pola Invalidasi Cache Setelah Mutasi Admin
Setiap kali panitia melakukan perubahan data, queryClient.invalidateQueries() wajib dipanggil pada callback onSuccess:

Setelah Reset Token / Tambah Pemilih / Hapus Pemilih / Impor DPT:

Invalidate queryKeys.voters.all(electionId)

Invalidate queryKeys.election.dashboard(electionId) (agar angka Total Pemilih & Kesiapan Pemilihan langsung ter-update)

Invalidate queryKeys.logs.list(electionId, {})

Setelah Tambah / Edit / Hapus Kandidat:

Invalidate queryKeys.candidates.all(electionId)

Invalidate queryKeys.election.dashboard(electionId)

Invalidate queryKeys.election.results(electionId)

5. Konfigurasi Better Auth (src/lib/auth/admin-auth.ts)
TypeScript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username, admin } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  plugins: [
    username(), // Mengizinkan login menggunakan username (misal: @admin)
    admin({
      defaultRole: "committee",
      adminRoles: ["super_admin"],
    }),
  ],
  rateLimit: {
    enabled: true,
    window: 600, // 10 menit (600 detik)
    max: 5,      // Maks 5 percobaan gagal per 10 menit pada endpoint auth
  },
});
6. Konvensi Penamaan (Naming Conventions)
File & Folder: kebab-case (contoh: cast-vote.ts, voter-session.ts, ballot-card.tsx).

Komponen React: PascalCase (contoh: CandidateResultCard, VoterFilterBar).

Variabel & Fungsi TypeScript: camelCase (contoh: getAggregatedElectionResults, hasVoted).

Tabel & Kolom Database PostgreSQL: snake_case di level SQL (voter_identity, has_voted), dipetakan ke camelCase di properti Drizzle (voterIdentity, hasVoted).

Konstanta & Environment Variables: SCREAMING_SNAKE_CASE (contoh: TOKEN_HMAC_SECRET, DIRECT_DATABASE_URL).
