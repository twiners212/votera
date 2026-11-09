# API & Server Endpoints Specification — Votera

**Nama Aplikasi:** Votera  
**Framework:** Next.js App Router (Route Handlers `src/app/api/**`)  
**Validasi Input:** Zod (`src/lib/validations/**`)  
**Versi Dokumen:** 1.0.0

---

## 1. Standar Format Response & Error Handling

Seluruh endpoint API di `src/app/api/**` mengembalikan format JSON yang konsisten agar mudah dikonsumsi oleh TanStack Query v5 dan ditangani oleh komponen UI.

### 1.1. Format Response Sukses (`200 OK` / `201 Created`)
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 25,
    "total": 76,
    "totalPages": 4
  }
}
(Objek meta hanya disertakan pada endpoint yang memiliki fitur paginasi seperti /api/admin/voters dan /api/admin/logs).1.2. Format Response Error (4xx / 5xx)JSON{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "NIS atau Token yang kamu masukkan salah. Silakan periksa kembali.",
    "details": {}
  }
}
1.3. Kamus Kode Error Standar (Error Codes)HTTP StatusError CodeKeterangan & Penggunaan400VALIDATION_ERRORPayload tidak lolos validasi skema Zod (mis. NIS kosong, format tanggal salah).401UNAUTHORIZEDBelum login atau cookie sesi kedaluwarsa/tidak valid.401INVALID_CREDENTIALSNIS/Token pemilih salah atau username/password admin salah.403FORBIDDENRole tidak memiliki hak akses (mis. committee mengakses endpoint khusus super_admin, atau voter mengakses /api/admin/*).403ELECTION_CLOSEDPemilih mencoba login atau mengirim suara di luar rentang jadwal start_at s/d end_at.403VOTER_LOCKEDAkun pemilih terkunci sementara (15 menit) karena gagal login 5 kali berturut-turut.409ALREADY_VOTEDPemilih sudah menggunakan hak suaranya (has_voted = true) atau terjadi race condition.409DUPLICATE_ENTRYNIS pemilih atau Nomor Urut kandidat sudah terdaftar pada pemilihan yang sama.409VOTER_IMMUTABLEMencoba mereset token atau menghapus pemilih yang sudah berstatus voted (Sudah memilih).429RATE_LIMIT_EXCEEDEDTerlalu banyak percobaan request dari IP atau identitas yang sama dalam 1 menit.500INTERNAL_SERVER_ERRORKesalahan tak terduga di sisi server atau koneksi database.2. Daftar Ringkas Seluruh EndpointKategoriMethodEndpoint PathOtorisasi RoleDeskripsiPublicGET/api/public/electionPublicInfo pemilihan aktif, jadwal, status buka/tutup, & daftar kandidat aktif.Voter AuthPOST/api/voter/loginPublicLogin pemilih dengan NIS + Token 8 karakter.Voter AuthPOST/api/voter/logoutVoterHapus sesi pemilih & catat log voter_logout.VotingPOST/api/voter/voteVoterSubmit pilihan kandidat secara atomik (1 orang 1 suara).Admin AuthALL/api/auth/[...all]Public / AdminHandler bawaan Better Auth (login, logout, session).MonitoringGET/api/admin/dashboardcommittee, super_adminRingkasan KPI, partisipasi per rombel, & checklist kesiapan (Cached 3s).ResultsGET/api/admin/resultscommittee, super_adminHasil agregasi suara real-time per kandidat (Cached 3s untuk polling).CandidatesGET/api/admin/candidatescommittee, super_adminDaftar seluruh kandidat terdaftar.CandidatesPOST/api/admin/candidatessuper_adminTambah kandidat baru.CandidatesPATCH/api/admin/candidates/[id]super_adminUbah data kandidat / status aktif.CandidatesDELETE/api/admin/candidates/[id]super_adminHapus kandidat (hanya jika belum menerima suara).UploadPOST/api/admin/uploadsuper_adminUnggah foto kandidat ke Vercel Blob.Voters (DPT)GET/api/admin/voterscommittee, super_adminDaftar pemilih dengan filter, pencarian, & paginasi.Voters (DPT)POST/api/admin/voterscommittee, super_adminTambah 1 pemilih secara manual + generate token.Voters (DPT)PATCH/api/admin/voters/[id]committee, super_adminEdit nama, NIS, atau rombel pemilih.Voters (DPT)DELETE/api/admin/voters/[id]committee, super_adminHapus pemilih (ditolak jika has_voted = true).Voters (DPT)POST/api/admin/voters/[id]/reset-tokencommittee, super_adminGenerate token baru & hanguskan token lama.Voters (DPT)GET/api/admin/voters/[id]/copy-tokencommittee, super_adminDekripsi token pemilih untuk disalin panitia.Voters (DPT)POST/api/admin/voters/importcommittee, super_adminImpor massal DPT dari array hasil parsing CSV/XLSX.Master DataGET/POST/DELETE/api/admin/mastersuper_admin (GET: semua admin)CRUD Tingkat Kelas (grade_levels), Jurusan (majors), & Rombel (voter_groups).SettingsGET/PUT/api/admin/settingssuper_admin (GET: semua admin)Ubah nama instansi, jadwal pemilihan, dan label kustomisasi.Audit LogsGET/api/admin/logscommittee, super_adminDaftar riwayat aktivitas read-only dengan filter & paginasi.Admin UsersGET/POST/PATCH/DELETE/api/admin/userssuper_adminKelola akun panitia (multi-admin).3. Spesifikasi Detail Endpoint Publik & Pemilih3.1. POST /api/voter/login — Autentikasi Pemilih (NIS + Token)Memverifikasi identitas pemilih, mengecek batas percobaan login (lockout), memvalidasi jadwal aktif, dan menerbitkan cookie sesi votera_voter_session (HttpOnly).Otorisasi: Public (Dilindungi Rate Limiter: maks. 10 req/menit per IP).Skema Validasi Zod (src/lib/validations/voter.ts):TypeScriptimport { z } from "zod";

export const voterLoginSchema = z.object({
  electionId: z.string().uuid().optional(), // Jika kosong, gunakan pemilihan yang sedang isActive = true
  voterIdentity: z
    .string()
    .trim()
    .min(3, "NIS wajib diisi")
    .max(50, "NIS terlalu panjang"),
  token: z
    .string()
    .trim()
    .toUpperCase()
    .length(8, "Token harus terdiri dari 8 karakter")
    .regex(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/, "Format karakter token tidak valid"),
});
Alur Logika Server:Ambil pemilihan aktif (elections.isActive = true). Pastikan jadwal saat ini berada di antara startAt dan endAt (kecuali jika pemilih sudah memilih dan hanya ingin melihat bukti /vote/thanks).Cari pemilih berdasarkan (electionId, voterIdentity). Jika tidak ditemukan, kembalikan 401 INVALID_CREDENTIALS.Cek lockedUntil > NOW(). Jika masih terkunci, kembalikan 403 VOTER_LOCKED.Hitung HMAC-SHA256(token, TOKEN_HMAC_SECRET) dan bandingkan dengan voter.tokenHash menggunakan crypto.timingSafeEqual.Jika Token Salah: Increment failedLoginAttempts. Jika >= 5, set lockedUntil = NOW() + 15 minutes. Catat voter_login_failed di audit_logs. Kembalikan 401 INVALID_CREDENTIALS.Jika Token Benar: Reset failedLoginAttempts = 0, lockedUntil = null, set lastLoginAt = NOW(). Jika voterStatus === 'not_voted', ubah menjadi 'logged_in'. Buat baris di voter_sessions, set cookie votera_voter_session, dan catat voter_login di audit_logs.Response 200 OK:JSON{
  "success": true,
  "data": {
    "voter": {
      "id": "b7e2...",
      "name": "Putri Ayu Lestari",
      "voterIdentity": "2324004",
      "groupName": "Rombel 2",
      "hasVoted": false
    },
    "redirectTo": "/vote"
  }
}
3.2. POST /api/voter/vote — Submit Suara AtomikMenjalankan transaksi pemungutan suara menggunakan dbPool (drizzle-orm/neon-serverless) seperti yang telah didefinisikan pada security.md.Otorisasi: Voter (Wajib memiliki cookie votera_voter_session yang valid).Skema Validasi Zod:TypeScriptexport const castVoteSchema = z.object({
  candidateId: z.string().uuid("Pilihan kandidat tidak valid"),
});
Response 200 OK:JSON{
  "success": true,
  "data": {
    "votedAt": "2026-10-25T07:24:00.000Z",
    "redirectTo": "/vote/thanks"
  }
}
Error Responses: 403 ELECTION_CLOSED, 409 ALREADY_VOTED, 400 CANDIDATE_INVALID.4. Spesifikasi Detail Endpoint Panel Admin & Polling Real-Time4.1. GET /api/admin/results — Hasil Pemilihan Real-Time (Polling Endpoint)Endpoint ini dipanggil secara berkala oleh hook TanStack Query useElectionResults setiap 5–10 detik (default 8 detik, atau 30 detik pada mode hemat).Otorisasi: committee, super_admin (DILARANG diakses oleh voter atau public selama pemilihan berlangsung).Strategi Caching Server & Header HTTP:Menggunakan unstable_cache dari next/cache dengan revalidate: 3 (3 detik) dan tag ["election-results", electionId].Menyertakan header HTTP: Cache-Control: private, max-age=3, stale-while-revalidate=2.Penting: Endpoint ini hanya mengeksekusi query COUNT teragregasi (getAggregatedElectionResults di architecture.md), tidak pernah mengirimkan daftar baris tabel votes mentah ke klien.Response 200 OK:JSON{
  "success": true,
  "data": {
    "election": {
      "id": "e1a0...",
      "title": "Pemilihan Ketua OSIS 2026",
      "organizationName": "SMA Bojong Gede",
      "status": "open",
      "startAt": "2026-10-25T00:00:00.000Z",
      "endAt": "2026-11-02T08:00:00.000Z"
    },
    "summary": {
      "totalVoters": 76,
      "votesCast": 2,
      "notVoted": 74,
      "turnoutPercentage": 2.6
    },
    "leadingCandidate": {
      "candidateNumber": 1,
      "name": "Raka Aditya Pratama",
      "isTie": false
    },
    "candidates": [
      {
        "id": "c1...",
        "candidateNumber": 1,
        "name": "Raka Aditya Pratama",
        "classOrUnit": "XI IPA",
        "photoUrl": "[https://...blob.vercel-storage.com/](https://...blob.vercel-storage.com/)...",
        "themeColor": "red",
        "voteCount": 2,
        "percentage": 100.0,
        "rank": 1
      },
      {
        "id": "c2...",
        "candidateNumber": 2,
        "name": "Alya Putri Maharani",
        "classOrUnit": "XI IPS",
        "photoUrl": "[https://...blob.vercel-storage.com/](https://...blob.vercel-storage.com/)...",
        "themeColor": "green",
        "voteCount": 0,
        "percentage": 0.0,
        "rank": 2
      }
    ],
    "groupParticipation": [
      {
        "groupId": "g1...",
        "groupName": "Rombel 1",
        "gradeName": "Kelas X",
        "majorName": "IPA",
        "totalMembers": 12,
        "votedMembers": 1,
        "percentage": 8.3
      }
    ],
    "lastUpdatedAt": "2026-10-25T07:25:10.000Z"
  }
}
4.2. GET /api/admin/dashboard — Metrik Dashboard & Kesiapan PemilihanOtorisasi: committee, super_admin.Caching: revalidate: 3 detik.Response 200 OK: Mengembalikan data summary (Total DPT, Sudah memilih, Belum memilih, % Partisipasi), groupParticipation (Partisipasi per kelas/rombel), informasi jadwal aktif, serta objek readiness:JSON{
  "readiness": {
    "isReady": true,
    "checks": {
      "hasMinTwoActiveCandidates": true,
      "hasVotersRegistered": true,
      "hasScheduleConfigured": true,
      "hasOrganizationName": true
    }
  }
}
4.3. GET /api/admin/voters — Daftar Pemilih (DPT) dengan Filter & PaginasiMendukung 5 filter sesuai tampilan UI /admin/voters: pencarian (search), status memilih (status), rombel (groupId), tingkat (gradeLevelId), dan jurusan (majorId).Otorisasi: committee, super_admin.Skema Query Parameter Zod:TypeScriptexport const voterQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(10).max(100).default(25),
  search: z.string().trim().optional(), // Cari berdasarkan Nama atau NIS (ILIKE)
  status: z.enum(["all", "not_voted", "logged_in", "voted"]).default("all"),
  groupId: z.string().uuid().or(z.literal("all")).default("all"),
  gradeLevelId: z.string().uuid().or(z.literal("all")).default("all"),
  majorId: z.string().uuid().or(z.literal("all")).default("all"),
});
Catatan Dekripsi Token pada Tabel DPT:
Untuk baris pemilih yang memiliki hasVoted === false pada halaman aktif (maksimal 25 baris per request), server mendekripsi tokenEncrypted di RAM menggunakan AES-256-GCM agar dapat ditampilkan pada komponen TokenCopyBadge (JUFT88TF + tombol Salin). Untuk pemilih yang sudah memilih (hasVoted === true), field token dikembalikan sebagai null.4.4. POST /api/admin/voters/[id]/reset-token — Reset Token PemilihOtorisasi: committee, super_admin.Aturan Bisnis:Cek apakah pemilih ada. Jika voter.hasVoted === true, tolak dengan 409 VOTER_IMMUTABLE ("Pemilih sudah menggunakan hak suara, token tidak dapat direset").Generate token 8 karakter baru (CSPRNG), hitung tokenHash dan tokenEncrypted baru.Update baris voters (sekaligus me-reset failedLoginAttempts = 0 dan lockedUntil = null).Hapus seluruh sesi aktif pemilih tersebut di tabel voter_sessions.Catat aksi token_reset di audit_logs (tanpa menulis string token ke dalam log).Response 200 OK:JSON{
  "success": true,
  "data": {
    "voterId": "v1...",
    "voterIdentity": "2324001",
    "newToken": "9KLM4P2X"
  }
}
4.5. POST /api/admin/voters/import — Impor Massal DPT (CSV / XLSX)File CSV/XLSX di-parse terlebih dahulu di klien menggunakan PapaParse / SheetJS atau dikirim sebagai JSON array terstruktur ke server untuk divalidasi per baris.Otorisasi: committee, super_admin.Skema Validasi Zod (src/lib/validations/import.ts):TypeScriptexport const importVoterRowSchema = z.object({
  voterIdentity: z
    .string()
    .trim()
    .min(1, "NIS wajib diisi")
    .refine((val) => !/^[=+\-@]/.test(val), "Karakter awal tidak diizinkan (CSV Injection protection)"),
  name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter")
    .refine((val) => !/^[=+\-@]/.test(val), "Karakter awal tidak diizinkan"),
  groupName: z.string().trim().min(1, "Nama Rombel/Kelas wajib diisi"),
  gradeName: z.string().trim().optional(),
  majorName: z.string().trim().optional(),
});

export const bulkImportVotersSchema = z.object({
  rows: z.array(importVoterRowSchema).min(1).max(5000),
  autoCreateGroups: z.boolean().default(true),
});
Alur Eksekusi (dbPool Transaction):Validasi setiap baris menggunakan importVoterRowSchema.safeParse().Cek duplikasi voterIdentity baik di dalam file yang diunggah maupun terhadap data voters yang sudah ada di database.Baris yang valid di-insert secara batch (per 500 baris) beserta pembuatan token unik masing-masing.Baris yang gagal dikumpulkan beserta nomor baris dan alasan error-nya agar panitia dapat memperbaikinya di UI DptImportDialog.Catat aksi voters_imported di audit_logs (mis. "Mengimpor 76 data pemilih ke DPT").Response 200 OK:JSON{
  "success": true,
  "data": {
    "totalProcessed": 78,
    "insertedCount": 76,
    "failedCount": 2,
    "failures": [
      { "rowNumber": 14, "voterIdentity": "2324001", "reason": "NIS sudah terdaftar di database" },
      { "rowNumber": 52, "voterIdentity": "", "reason": "NIS wajib diisi" }
    ]
  }
}
4.6. POST /api/admin/candidates & PATCH /api/admin/candidates/[id]Otorisasi: Khusus super_admin.Skema Validasi Zod (src/lib/validations/candidate.ts):TypeScriptexport const candidateSchema = z.object({
  candidateNumber: z.coerce.number().int().min(1).max(99),
  name: z.string().trim().min(2, "Nama kandidat wajib diisi").max(120),
  classOrUnit: z.string().trim().min(1, "Kelas/Unit wajib diisi").max(60),
  motto: z.string().trim().min(3, "Motto wajib diisi").max(200),
  vision: z.string().trim().min(10, "Visi minimal 10 karakter"),
  missions: z.array(z.string().trim().min(1)).min(1, "Minimal 1 misi wajib diisi"),
  programs: z.array(z.string().trim().min(1)).default([]),
  supporters: z.array(z.string().trim().min(1)).default([]),
  photoUrl: z.string().url("URL foto tidak valid").nullable().optional(),
  themeColor: z.enum(["red", "green", "blue", "amber"]).default("red"),
  isActive: z.boolean().default(true),
});
4.7. GET /api/admin/logs — Riwayat Log Aktivitas (Read-Only)Mendukung 4 kartu ringkasan KPI (Total catatan, Aktivitas panitia, Login pemilih berhasil, Login gagal) dan 5 filter pada halaman /admin/logs.Otorisasi: committee, super_admin.Skema Query Parameter Zod:TypeScriptexport const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(10).max(100).default(25),
  search: z.string().trim().optional(), // Cari keterangan, nama, NIS, atau IP
  actorType: z.enum(["all", "admin", "voter", "system"]).default("all"),
  action: z.string().default("all"), // mis. "all", "vote_cast", "voter_login", "admin_login", "voter_login_failed"
  dateFrom: z.string().optional(), // YYYY-MM-DD
  dateTo: z.string().optional(),   // YYYY-MM-DD
});
