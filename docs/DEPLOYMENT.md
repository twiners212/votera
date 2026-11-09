# Production Deployment & Operations Guide — Votera

**Nama Aplikasi:** Votera  
**Versi Dokumen:** 1.0.0  
**Target Infrastruktur:** Vercel (Compute & Blob Storage) + Neon (Serverless PostgreSQL 16)

---

## 1. Arsitektur Infrastruktur Produksi & Branching

Votera dirancang untuk berjalan sepenuhnya di atas infrastruktur *serverless* modern dengan pemisahan lingkungan (*environment isolation*) antara **Production** dan **Staging/Preview**:

```text
[ Pengguna / Pemilih (HP & Laptop) ]
                 │
                 ▼ (HTTPS / TLS 1.3)
      ┌─────────────────────┐
      │   Vercel Edge CDN   │ ──► [ Vercel Blob CDN (Foto Kandidat) ]
      └──────────┬──────────┘
                 │
                 ▼
      ┌─────────────────────┐
      │   Next.js Server    │ (App Router, Route Handlers, Server Cache 3-5s)
      └────┬───────────┬────┘
           │           │
  (HTTP)   │           │ (WebSocket Pool - Transaksi Voting)
           ▼           ▼
      ┌─────────────────────┐
      │  Neon PgBouncer     │ (DATABASE_URL - Pooled Connection)
      │  Connection Pooler  │
      └──────────┬──────────┘
                 │
                 ▼
      ┌─────────────────────┐
      │  Neon PostgreSQL 16 │ (DIRECT_DATABASE_URL - Hanya untuk Migrasi DDL)
      │   [main branch]     │ ──► Point-in-Time Restore (PITR) & Automated Backups
      └─────────────────────┘
```

### Strategi Branching Neon (Database Branching):
1. **`main` (Production Branch):** Terhubung ke deployment Production di Vercel (`main` Git branch). Hanya menyimpan data pemilihan resmi.
2. **`staging` (Preview/Simulation Branch):** Dibuat sebagai *child branch* dari `main` di Neon Dashboard. Digunakan oleh panitia untuk melakukan **Simulasi / Gladi Bersih Pemilihan** H-1 tanpa mengotori data produksi.
3. **`dev` / `test` (Development Branch):** Digunakan untuk pengembangan lokal dan eksekusi automated test (`pnpm test`).

---

## 2. Langkah-Langkah Setup Neon & Vercel

### 2.1. Persiapan Database di Neon (`console.neon.tech`)
1. Buat proyek baru di Neon dengan nama `votera-db`, pilih **PostgreSQL 16**, dan pilih **Region: Singapore (`aws-ap-southeast-1`)** agar latensi dari Indonesia minimal (< 30ms).
2. Di halaman **Connection Details**, salin dua *connection string*:
   - **Pooled Connection** (centang *Pooled connection*, memiliki `-pooler` pada hostname) -> Simpan sebagai `DATABASE_URL`.
   - **Direct Connection** (tanpa centang *Pooled connection*) -> Simpan sebagai `DIRECT_DATABASE_URL`.

### 2.2. Persiapan Project & Blob Storage di Vercel
1. Hubungkan repositori Git proyek Votera ke Vercel.
2. Pada pengaturan project Vercel:
   - **Framework Preset:** Next.js
   - **Package Manager:** `pnpm`
   - **Function Region:** `sin1` (Singapore) — **WAJIB** disamakan dengan region database Neon agar transaksi WebSocket `castVoteTransaction` berjalan di *data center* yang berdekatan.
3. Buka tab **Storage** di Vercel Dashboard -> Klik **Create Database / Storage** -> Pilih **Vercel Blob** -> Hubungkan ke project Votera. Variabel `BLOB_READ_WRITE_TOKEN` akan otomatis ditambahkan ke project.

---

## 3. Konfigurasi Environment Variables Produksi

Tambahkan seluruh variabel berikut di **Vercel Dashboard -> Settings -> Environment Variables** (untuk *Production* dan *Preview*):

| Nama Variabel | Contoh / Cara Generate | Keterangan |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://user:pass@ep-xyz-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` | Koneksi **Pooled** Neon untuk runtime aplikasi (`db` & `dbPool`). |
| `DIRECT_DATABASE_URL` | `postgresql://user:pass@ep-xyz.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` | Koneksi **Unpooled** Neon khusus untuk `drizzle-kit migrate`. |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` | Kunci rahasia penandatanganan sesi Admin Better Auth (minimal 32 karakter). |
| `BETTER_AUTH_URL` | `https://pilketos.smabojonggede.sch.id` | URL publik utama aplikasi produksi (tanpa *trailing slash*). |
| `NEXT_PUBLIC_APP_URL` | `https://pilketos.smabojonggede.sch.id` | URL publik untuk validasi Origin CSRF dan metadata klien. |
| `TOKEN_HMAC_SECRET` | `openssl rand -hex 32` | Secret server 32-byte untuk hashing `token_hash` (HMAC-SHA256). **Dilarang diubah saat pemilihan sudah berjalan!** |
| `TOKEN_ENCRYPTION_KEY` | `openssl rand -hex 32` | Kunci 32-byte (64 karakter hex) untuk enkripsi `token_encrypted` (AES-256-GCM). **Dilarang diubah saat pemilihan sudah berjalan!** |
| `VOTER_SESSION_SECRET` | `openssl rand -base64 32` | Secret untuk menandatangani cookie sesi pemilih (`votera_voter_session`). |
| `BLOB_READ_WRITE_TOKEN` | `vercel_blob_rw_...` | Otomatis diinjeksikan saat menghubungkan Vercel Blob. |
| `INITIAL_ADMIN_PASSWORD` | `PanitiaPilketos2026!Strong` | Password awal untuk akun `super_admin` saat menjalankan seeding pertama kali. |

---

## 4. Alur Migrasi Database di Produksi

Jangan pernah menggunakan `drizzle-kit push` langsung ke database produksi. Gunakan alur migrasi berbasis file SQL yang terkontrol:

1. **Generate File Migrasi di Lokal (Saat Ada Perubahan Skema):**
   ```bash
   pnpm db:generate
   ```
   Pastikan file SQL di dalam folder `drizzle/migrations/` sudah menyertakan trigger `trg_protect_audit_logs` untuk proteksi *append-only* pada tabel `audit_logs`.

2. **Konfigurasi Build Command di Vercel (`package.json`):**
   Agar setiap deployment produksi otomatis menjalankan migrasi sebelum mem-build aplikasi Next.js:
   ```json
   {
     "scripts": {
       "build": "next build",
       "build:prod": "pnpm db:migrate && next build",
       "db:generate": "drizzle-kit generate",
       "db:migrate": "drizzle-kit migrate",
       "db:seed": "tsx src/db/seed.ts"
     }
   }
   ```
   Di Vercel Dashboard -> **Build & Development Settings**, arahkan *Build Command* ke `pnpm build:prod` (atau jalankan `pnpm db:migrate` melalui pipeline CI/CD GitHub Actions sebelum deploy).

3. **Inisialisasi Akun Super Admin Pertama Kali:**
   Setelah tabel terbentuk di produksi, jalankan seeding awal satu kali dari terminal lokal menggunakan `DIRECT_DATABASE_URL` produksi (atau buat hanya akun Super Admin & data master):
   ```bash
   pnpm db:seed
   ```
   Segera login ke `/admin/login` dan ganti password default Super Admin.

---

## 5. Backup, Point-in-Time Restore (PITR) & Disaster Recovery

1. **Neon Point-in-Time Restore (PITR):**
   - Neon menyimpan *history log* perubahan database secara kontinu (24 jam terakhir pada paket Free/Launch, hingga 7–30 hari pada paket Scale).
   - **Cara Pemulihan Darurat:** Jika terjadi kesalahan fatal sebelum pemilihan dibuka (misal panitia salah mengimpor data DPT), buka **Neon Console -> Restore**, pilih *timestamp* tepat sebelum kesalahan terjadi, lalu pulihkan branch `main`.
2. **Backup Eksternal Pra-Pemilihan & Pasca-Pemilihan (`pg_dump`):**
   - Sebelum jadwal pemungutan suara dibuka (H-1) dan segera setelah jadwal ditutup, administrator IT wajib mencadangkan snapshot database:
     ```bash
     pg_dump "$DIRECT_DATABASE_URL" --format=custom --file="backup_pilketos_$(date +%Y%m%d_%H%M).dump"
     ```
3. **Ekspor Bukti Fisik & Berita Acara:**
   - Segera setelah waktu pemilihan berakhir (`status = 'closed'`), Super Admin wajib mengunduh **Laporan PDF & Excel** dari halaman `/admin/results` sebagai arsip resmi yang sah.

---

## 6. Monitoring & Observability Selama Hari Pemilihan

Selama pemungutan suara berlangsung, pantau 3 indikator berikut:

1. **Panel Admin Votera (`/admin/dashboard` & `/admin/logs`):**
   - Pantau progres **Partisipasi per Kelas** dan kartu KPI **Login gagal** di `/admin/logs`. Jika angka *Login gagal* melonjak tajam dari satu IP, periksa apakah ada kendala salah ketik massal di bilik suara atau indikasi percobaan *brute-force*.
2. **Vercel Analytics & Logs (Real-Time Function Logs):**
   - Pantau waktu eksekusi endpoint `POST /api/voter/vote` dan `GET /api/admin/results`.
   - Pastikan `GET /api/admin/results` mengembalikan status cache `HIT` pada mayoritas request polling (waktu respons < 50ms).
3. **Neon Monitoring Dashboard:**
   - Pantau penggunaan *Active Connections* pada PgBouncer dan penggunaan CPU/RAM compute Neon. Pastikan *Autoscaling* atau ukuran compute aktif (tidak *scale-to-zero* selama jam pemilihan aktif).

---

## 7. Checklist Go-Live Hari Pemilihan (Election Day Runbook)

### H-1: Persiapan & Gladi Bersih
- [ ] Seluruh foto, nama, kelas, visi, misi, program, dan pendukung kandidat telah diverifikasi di `/admin/candidates` (minimal 2 kandidat berstatus **Aktif**).
- [ ] Seluruh data DPT telah diimpor ke `/admin/voters`, jumlah total DPT sesuai dengan data resmi sekolah/instansi, dan tidak ada data simulasi/dummy yang tersisa di tabel `votes` (`Suara masuk = 0`).
- [ ] Kartu **Kesiapan pemilihan** di `/admin/dashboard` sudah menampilkan status hijau **Siap** (4 centang hijau terpenuhi).
- [ ] Daftar token pemilih per kelas/rombel sudah disiapkan/dicetak oleh panitia untuk dibagikan di meja registrasi.
- [ ] Variabel `TOKEN_HMAC_SECRET` dan `TOKEN_ENCRYPTION_KEY` di Vercel sudah dikunci dan **dilarang diubah lagi**.

### Hari-H (30 Menit Sebelum Pemungutan Suara Dibuka)
- [ ] Pastikan jadwal `start_at` dan `end_at` di `/admin/settings` sudah benar sesuai zona waktu lokal (WIB/WITA/WIT).
- [ ] Buka satu halaman `/admin/dashboard` atau `/admin/results` di laptop panitia pusat untuk menjaga instance serverless Neon tetap *warm* (aktif).
- [ ] Siapkan minimal 1 operator panitia (role `committee`) yang membuka menu `/admin/voters` sebagai meja *Helpdesk* untuk melayani pencarian NIS, fitur **Salin Token**, atau **Reset Token** jika ada pemilih yang kehilangan token.

### Hari-H (Saat Pemungutan Suara Ditutup)
- [ ] Pastikan waktu saat ini sudah melewati `end_at` dan badge status pemilihan telah berubah menjadi **Ditutup**.
- [ ] Buka `/admin/results`, klik **Segarkan** untuk memastikan angka final termuat, lalu klik **Lihat laporan** dan unduh hasil akhir dalam format **PDF** dan **Excel (XLSX)**.
- [ ] Periksa `/admin/logs` untuk memastikan tidak ada anomali aktivitas selama jendela pemilihan.
- [ ] Lakukan `pg_dump` arsip akhir database dan simpan di penyimpanan aman penyelenggara.

C
