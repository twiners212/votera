# Votera

> Platform E-Voting & Pemilihan Online Multi-Instansi dengan Jaminan Kerahasiaan Suara (*Unlinkable Anonymous Ballot*) dan Keamanan Atomik 1 Pemilih 1 Suara.

Votera dirancang untuk menyediakan proses pemilihan elektronik yang transparan, aman, dan mudah diakses dari berbagai perangkat (mobile, tablet, bilik suara desktop). Dikonfigurasi secara default untuk pemilihan institusi sekolah/kampus/komunitas dengan performa serverless tinggi.

---

## Arsitektur & Keunggulan Utama

- **Kerahasiaan Suara Mutlak (*Unlinkable Anonymous Ballot*):** Catatan pencoblosan pada tabel suara tidak menyimpan relasi ke identitas pemilih atau alamat IP.
- **Integritas Atomik (1 Pemilih 1 Suara):** Transaksi database terisolasi mencegah *double-voting* dan *race condition* pada pemungutan suara serentak.
- **Dual-Driver Database:** Menggunakan Neon WebSocket Connection Pooler untuk API serverless berkonkurensi tinggi dan direct unpooled connection untuk DDL/migrasi.
- **Audit Anti-Curang (*Append-Only*):** Setiap tindakan administratif dan perubahan status dicatat dalam log audit terlindungi trigger database.
- **Optimasi Bulk Ingestion DPT:** Impor ribuan daftar pemilih tetap (DPT) berbasis batch in-memory dictionary caching untuk mencegah lonjakan koneksi database.

---

## Teknologi

- **Aplikasi:** [Next.js 15 (App Router)](https://nextjs.org), React 19, TypeScript
- **Database & ORM:** [Neon Serverless PostgreSQL](https://neon.tech), [Drizzle ORM](https://orm.drizzle.team)
- **Autentikasi:** Better Auth (Panel Admin/Panitia) & Custom Encrypted Voter Token Authentication (AES-256-GCM + HMAC-SHA256)
- **State Management:** TanStack Query v5
- **UI & Komponen:** Tailwind CSS, Radix UI primitives, Lucide Icons
- **Pengujian:** Vitest (Unit & Integrasi), Playwright (End-to-End)

---

## Panduan Memulai Cepat

### 1. Prasyarat
- Node.js 20.x atau 22.x LTS
- `pnpm` v9+
- Database PostgreSQL (disarankan Neon)

### 2. Instalasi
```bash
git clone <repository-url>
cd votera
pnpm install
```

### 3. Konfigurasi Environment
Salin template konfigurasi ke `.env.local`:
```bash
cp .env.example .env.local
```
Sesuaikan parameter koneksi database (`DATABASE_URL`, `DIRECT_DATABASE_URL`) dan kunci kriptografi pada `.env.local`.

### 4. Migrasi & Seeding
```bash
# Jalankan migrasi skema database
pnpm db:migrate

# Inisialisasi data akun awal dan contoh kandidat
pnpm db:seed
```

### 5. Menjalankan Server Development
```bash
pnpm dev
```
- **Portal Pemilih:** `http://localhost:3000`
- **Panel Admin/Panitia:** `http://localhost:3000/admin/login`

---

## Perintah Pengujian & Kualitas

```bash
# Pemeriksaan tipe TypeScript
pnpm typecheck

# Linting ESLint
pnpm lint

# Pengujian unit
pnpm test:unit

# Pengujian integrasi (database)
pnpm test:integration

# Pengujian end-to-end
pnpm test:e2e

# Build produksi
pnpm build
```

---

## Dokumentasi Teknis Terperinci

Dokumentasi lengkap sistem tersedia di folder `docs/`:
- [Arsitektur Sistem](docs/architecture.md) — Desain skema database, ERD, dan aliran data.
- [Model Keamanan](docs/security.md) — Analisis ancaman, enkripsi token, dan integritas audit.
- [Spesifikasi API](docs/API.md) — Kontrak endpoint Route Handlers dan skema validasi.
- [Prosedur Pengujian](docs/TESTING.md) — Matriks pengujian konkurensi dan skenario uji.
- [Deployment & Operasional](docs/DEPLOYMENT.md) — Panduan rilis Vercel dan checklist hari pelaksanaan.

---

## Lisensi

Didistribusikan di bawah lisensi MIT. Lihat file `LICENSE` untuk informasi selengkapnya.
