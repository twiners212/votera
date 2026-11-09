# AI Coding Agent Guidelines & Rules — Votera

**Nama Aplikasi:** Votera (Platform E-Voting & Pemilihan Online Multi-Instansi)  
**Target Pembaca:** AI Coding Agents (Claude Code, Cursor, Gemini CLI, Windsurf, Copilot) & Developer  
**Versi Dokumen:** 1.0.0

---

## 1. Ringkasan Proyek (Project Overview)

**Votera** adalah aplikasi web pemungutan suara elektronik (*e-voting*) yang modern, bersih, transparan, dan rahasia. Secara default dikonfigurasi untuk **Pemilihan Ketua OSIS (PILKETOS 2026 — SMA Bojong Gede)**, namun arsitekturnya bersifat *multi-election* dan dapat dikustomisasi untuk pemilihan Ketua RT/RW, Kades, BEM/HMJ Kampus, Koperasi, maupun Organisasi.

### Prinsip Inti yang Wajib Dijaga oleh Agent:
1. **Unlinkable Ballot Secrecy:** Identitas pemilih (`voters`) dan pilihan suara (`votes`) dipisahkan secara mutlak di database.
2. **Atomic 1-Person-1-Vote:** Jaminan 1 orang 1 suara dieksekusi di dalam transaksi database interaktif (`dbPool.transaction`) dengan syarat `WHERE has_voted = false`.
3. **Locked Tech Stack:** Seluruh library, ORM, driver database, dan strategi polling telah dikunci. Jangan mengganti stack tanpa instruksi eksplisit.
4. **Strict Visual Consistency:** Seluruh warna, tipografi, radius sudut, dan tata letak wajib mengacu penuh pada `DESIGN_NOTES.md`.

---

## 2. Daftar Perintah Proyek (Standard Commands)

Seluruh operasi manajemen paket dan eksekusi skrip **WAJIB** menggunakan **`pnpm`**:

```bash
# 1. Instalasi dependensi
pnpm install

# 2. Menjalankan server development (http://localhost:3000)
pnpm dev

# 3. Pemeriksaan tipe TypeScript & Linting
pnpm typecheck
pnpm lint

# 4. Operasi Database (Drizzle ORM + Neon)
pnpm db:generate    # Generate file migrasi SQL dari src/db/schema.ts
pnpm db:migrate     # Jalankan migrasi ke database (memakai DIRECT_DATABASE_URL)
pnpm db:push        # Push skema langsung saat prototyping
pnpm db:seed        # Isi data awal PILKETOS 2026 (Admin, 4 Kandidat, 76 DPT, Rombel)
pnpm db:studio      # Buka Drizzle Studio untuk inspeksi database

# 5. Pengujian (Testing)
pnpm test           # Jalankan unit & integration test (Vitest)
pnpm test:e2e       # Jalankan end-to-end test (Playwright)

# 6. Build Produksi
pnpm build
pnpm start

3. Aturan Kritis: Hal yang DILARANG KERAS (Strict Prohibitions)

AI Coding Agent DILARANG KERAS melakukan hal-hal di bawah ini dalam kondisi apa pun:

    DILARANG menyimpan voter_id, voter_identity (NIS), session_id, atau ip_address di tabel votes:

        Tabel votes hanya boleh berisi id, election_id, candidate_id, dan created_at (yang dibulatkan ke menit date_trunc('minute', now())).

    DILARANG mencatat pilihan kandidat (candidate_id / nama kandidat) atau string token asli di tabel audit_logs:

        Saat aksi vote_cast, deskripsi log hanya boleh berbunyi "Pemilih telah memberikan suara".

        Saat aksi token_reset atau voter_login_failed, jangan pernah menulis string token ke dalam kolom description.

    DILARANG mengirimkan baris tabel votes mentah ke klien (Frontend):

        Perhitungan suara wajib menggunakan query agregasi SQL (COUNT + GROUP BY) di server (/api/admin/results) dan hanya boleh diakses oleh role committee atau super_admin.

    DILARANG menggunakan WebSocket / Supabase Realtime / Pusher pada implementasi MVP:

        Fitur real-time wajib menggunakan TanStack Query v5 HTTP Polling (refetchInterval) yang dikombinasikan dengan server-side cache singkat (revalidate: 3).

    DILARANG mengganti Tech Stack yang telah dikunci:

        Jangan mengganti Neon dengan Supabase/Prisma.

        Jangan mengganti Drizzle ORM dengan Prisma/Kysely.

        Jangan mengganti Better Auth dengan NextAuth/Clerk.

        Jangan menggunakan npm atau yarn (selalu gunakan pnpm).

    DILARANG mengandalkan validasi waktu atau status memilih hanya di sisi klien (UI):

        Setiap endpoint /api/voter/login dan /api/voter/vote wajib memvalidasi ulang waktu server PostgreSQL (now() BETWEEN start_at AND end_at) dan has_voted = false.

    DILARANG membuat fitur Edit atau Hapus untuk Log Aktivitas (audit_logs) maupun Pemilih yang Sudah Memilih (has_voted = true):

        Log aktivitas bersifat append-only.

        Pemilih yang sudah berstatus voted (Sudah memilih) tidak boleh di-reset tokennya atau dihapus dari DPT.

4. Konvensi Kode & Arsitektur (Coding Conventions)
4.1. Penggunaan Driver Database (db vs dbPool)

    Gunakan db (drizzle-orm/neon-http dari src/db/index.ts) untuk:

        Semua operasi SELECT (dashboard, daftar kandidat, daftar DPT, hasil agregat, log aktivitas).

        Operasi INSERT/UPDATE/DELETE tunggal yang tidak membutuhkan transaksi multi-tabel.

    Gunakan dbPool (drizzle-orm/neon-serverless WebSocket Pool dari src/db/index.ts) untuk:

        Transaksi pemungutan suara (castVoteTransaction di src/lib/voting/cast-vote.ts).

        Transaksi impor massal DPT (POST /api/admin/voters/import).

4.2. Penanganan Komponen Server vs Client (Next.js App Router)

    Gunakan React Server Components (RSC) secara default untuk layout dan pengambilan metadata awal halaman.

    Tambahkan direktif "use client" hanya pada komponen interaktif yang menggunakan:

        React Hook Form (login, modal tambah kandidat/pemilih, pengaturan jadwal).

        TanStack Query hooks (useElectionResults, useDashboardStats, useVoters, useAuditLogs).

        State interaksi kartu surat suara (BallotCandidateCard, StickyBallotBar).

4.3. Standar Styling & UI (DESIGN_NOTES.md Compliance)

    Selalu gunakan warna semantik dan variabel yang telah dipetakan di DESIGN_NOTES.md:

        Primary Action: bg-[#D93829] hover:bg-[#B8281B] text-white

        App Canvas: bg-[#F8FAFC], Card Surface: bg-white border border-[#E2E8F0] rounded-[12px]

    Wajib menambahkan class tabular-nums pada setiap elemen teks yang menampilkan:

        Jumlah perolehan suara & persentase (2 suara, 100,0%, 3% Partisipasi).

        Angka pada kartu KPI (76 Total pemilih, 21 Total catatan).

        Nomor Induk Siswa / identitas pemilih (2324001).

    Gunakan class font-mono (JetBrains Mono) untuk:

        Badge token pemilih (JUFT88TF).

        Nama aksi teknis di log aktivitas (vote_cast, voter_login, admin_login).

        Alamat IP (::1 atau IPv4).

4.4. Validasi & Error Handling

    Semua input dari request.json() atau searchParams di Route Handler wajib divalidasi menggunakan skema Zod (safeParse) dari folder src/lib/validations/.

    Jangan pernah membocorkan stack trace database mentah ke response JSON klien. Gunakan format response { success: false, error: { code, message } } sesuai API.md.

5. Urutan Kerja Agent saat Mengimplementasikan Fitur

Saat mengerjakan suatu task dari TASKS.md, ikuti alur kerja berikut:

    Baca Konteks: Periksa skema di architecture.md, kontrak endpoint di API.md, dan aturan keamanan di security.md.

    Skema & Validasi: Pastikan skema Drizzle dan skema Zod untuk fitur tersebut sudah tersedia dan bebas dari error TypeScript.

    Backend / Route Handler: Implementasikan logika server, otorisasi role (voter, committee, super_admin), pencatatan audit_logs, dan caching/invalidasi.

    Frontend / UI Component: Bangun komponen menggunakan shadcn/ui dan token dari DESIGN_NOTES.md. Hubungkan dengan hook TanStack Query.

    Verifikasi Mandiri: Jalankan pnpm typecheck dan pnpm lint untuk memastikan tidak ada regresi.

6. Pre-Commit Checklist (Wajib Diperiksa Sebelum Menyelesaikan Task)

Sebelum menandai sebuah task selesai atau melakukan commit, pastikan seluruh poin berikut terpenuhi:

    [ ] pnpm typecheck berjalan dengan 0 error (tidak ada penggunaan any secara sembarangan).

    [ ] pnpm lint berjalan bersih tanpa peringatan kritis.

    [ ] Tidak ada relasi atau kolom yang menghubungkan voters dengan votes.

    [ ] Semua mutasi admin dan aksi pemilih sudah memanggil helper insertAuditLog() tanpa menyertakan data rahasia (token/pilihan kandidat).

    [ ] Endpoint admin sudah memverifikasi sesi Better Auth dan memeriksa role (committee vs super_admin).

    [ ] Angka statistik, suara, dan NIS di UI sudah menggunakan class tabular-nums.

    [ ] Tampilan responsif telah diuji pada ukuran layar mobile (375px) untuk sisi Pemilih dan desktop (1280px+) untuk sisi Panel Panitia.
