# Security Architecture & Threat Model — Votera

**Nama Aplikasi:** Votera  
**Versi Dokumen:** 1.0.0  

---

## 1. Model Ancaman (Threat Model)

Dalam sistem pemungutan suara elektronik (*e-voting*), ancaman keamanan datang dari dua sisi: **eksternal** (pemilih yang mencoba mencoblos lebih dari sekali atau menebak token teman) dan **internal** (oknum panitia/admin yang mencoba mengintip pilihan pemilih atau memanipulasi log).

| ID Ancaman | Deskripsi Ancaman | Dampak | Mitigasi Arsitektural Votera |
| :--- | :--- | :---: | :--- |
| **T-01** | **Deanonimisasi Suara:** Admin DB mencoba melihat siapa memilih kandidat mana di tabel database. | Kritis | Pemisahan mutlak tabel `voters` dan `votes` (*Unlinkable Ballot*), penggunaan UUID v4 acak, dan pembulatan timestamp (`date_trunc('minute')`). |
| **T-02** | **Double Voting (Race Condition):** Pemilih mengirim 10 request submit suara secara paralel di milidetik yang sama. | Kritis | Transaksi atomik via WebSocket Pool (`neon-serverless`) dengan *conditional atomic update* (`WHERE id = ? AND has_voted = false`). |
| **T-03** | **Brute-Force Token Pemilih:** Pihak luar mencoba menebak kombinasi token untuk NIS tertentu. | Tinggi | Alfabet 31 karakter non-ambigu ($31^8 \approx 852 \text{ miliar}$ kombinasi), *rate limiting* ketat per IP & per NIS, serta *account lockout* sementara. |
| **T-04** | **Kebocoran Database Token:** Dump tabel `voters` bocor dan penyerang membaca token *plaintext*. | Tinggi | Token tidak pernah disimpan *plaintext*. Disimpan dalam bentuk `token_hash` (HMAC-SHA256) untuk verifikasi dan `token_encrypted` (AES-256-GCM) yang kuncinya hanya ada di environment server, serta langsung dihapus (`[REDACTED]`) saat pemilih selesai memilih. |
| **T-05** | **Manipulasi Jejak Audit:** Oknum admin menghapus log setelah melakukan reset token ilegal. | Tinggi | Tabel `audit_logs` bersifat *append-only* (tanpa endpoint UPDATE/DELETE di aplikasi + pencabutan izin `REVOKE UPDATE, DELETE` di level PostgreSQL role). |
| **T-06** | **Voting di Luar Jadwal:** Pemilih mengirim request langsung ke API sebelum pemilihan dibuka atau setelah ditutup. | Sedang | Validasi jadwal (`start_at <= NOW() <= end_at`) wajib dieksekusi di dalam transaksi server menggunakan jam server PostgreSQL, bukan jam browser klien. |
| **T-07** | **Efek Bandwagon / Bocornya Hasil Awal:** Pemilih melihat hasil sementara sebelum mencoblos sehingga memengaruhi pilihannya. | Sedang | Hasil sementara disembunyikan dari publik/pemilih selama pemungutan berlangsung; endpoint hasil agregat diproteksi middleware role (`super_admin` & `committee`). |

---

## 2. Pemisahan Identitas Pemilih & Pilihan Suara (Unlinkable Ballot)

Votera menerapkan prinsip **Kerahasiaan Surat Suara Mutlak**:
1. **Struktur Tabel `votes`:** Hanya berisi kolom `id` (UUID v4 acak), `election_id`, `candidate_id`, dan `created_at`. **DILARANG KERAS** menambahkan kolom `voter_id`, `voter_identity` (NIS), `session_id`, atau `ip_address` pada tabel `votes`.
2. **Mitigasi Deanonimisasi via Timestamp & Urutan Insert (*Timing Correlation Attack*):**
   - Jika `voters.voted_at` dan `votes.created_at` sama-sama mencatat waktu hingga presisi milidetik (`2026-10-25 14:24:05.182`), admin database dapat menyandingkan kedua tabel untuk menebak pilihan pemilih.
   - **Mitigasi 1 (Coarse Timestamp pada `votes`):** Kolom `votes.created_at` dibulatkan ke tingkat menit menggunakan `date_trunc('minute', now())` dan hanya dipakai untuk agregasi metrik trafik per menit jika diperlukan.
   - **Mitigasi 2 (Random UUID v4 Primary Key):** Baik `votes.id` maupun `audit_logs.id` menggunakan `gen_random_uuid()` (UUID v4 acak, bukan `SERIAL` / *auto-increment integer* dan bukan UUID v7 yang berurutan waktu) sehingga urutan fisik baris di indeks utama tidak mencerminkan urutan kronologis pencoblosan.
   - **Mitigasi 3 (Redaksi Log Aktivitas):** Saat mencatat aksi `vote_cast` di tabel `audit_logs`, deskripsi log hanya berbunyi `"Pemilih telah memberikan suara"` tanpa pernah menyertakan nomor urut atau nama kandidat yang dipilih.

---

## 3. Jaminan "1 Orang 1 Suara" via Transaksi Atomik (`neon-serverless`)

Validasi `if (voter.hasVoted)` di kode JavaScript saja **tidak cukup** karena rentan terhadap *Time-of-Check to Time-of-Use (TOCTOU) race condition* jika pemilih mengirimkan beberapa request HTTP serentak.

Votera mengunci satu suara per pemilih menggunakan *atomic conditional update* di dalam transaksi PostgreSQL interaktif melalui driver `drizzle-orm/neon-serverless`:

```typescript
// src/lib/voting/cast-vote.ts
import { dbPool } from "@/db";
import { voters, votes, elections, candidates, auditLogs, voterSessions } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

export class VotingError extends Error {
  constructor(public code: string, message: string, public status: number = 400) {
    super(message);
  }
}

export async function castVoteTransaction(params: {
  electionId: string;
  voterId: string;
  candidateId: string;
  ipAddress: string;
}) {
  const { electionId, voterId, candidateId, ipAddress } = params;

  return await dbPool.transaction(async (tx) => {
    // 1. Validasi jadwal buka-tutup pemilihan langsung menggunakan waktu server DB (NOW())
    const [election] = await tx
      .select({
        id: elections.id,
        status: elections.status,
        isWithinSchedule: sql<boolean>`
          ${elections.status} = 'open'
          AND ${elections.startAt} IS NOT NULL
          AND ${elections.endAt} IS NOT NULL
          AND now() >= ${elections.startAt}
          AND now() <= ${elections.endAt}
        `,
      })
      .from(elections)
      .where(eq(elections.id, electionId));

    if (!election || !election.isWithinSchedule) {
      throw new VotingError(
        "ELECTION_CLOSED",
        "Pemungutan suara sedang tidak dibuka atau di luar jadwal resmi.",
        403
      );
    }

    // 2. Pastikan kandidat terdaftar, aktif, dan milik electionId yang sama
    const [candidate] = await tx
      .select({ id: candidates.id })
      .from(candidates)
      .where(
        and(
          eq(candidates.id, candidateId),
          eq(candidates.electionId, electionId),
          eq(candidates.isActive, true)
        )
      );

    if (!candidate) {
      throw new VotingError("INVALID_CANDIDATE", "Kandidat tidak valid atau tidak aktif.", 400);
    }

    // 3. ATOMIC LOCK & UPDATE:
    // PostgreSQL secara otomatis menerapkan row-level lock (FOR UPDATE) pada baris ini.
    // Jika ada 2 request paralel, request kedua akan menunggu hingga request pertama commit,
    // lalu melihat has_voted = true sehingga klausa WHERE gagal (mengembalikan 0 baris).
    const updatedVoters = await tx
      .update(voters)
      .set({
        hasVoted: true,
        voterStatus: "voted",
        votedAt: sql`now()`,
        tokenEncrypted: "[REDACTED]", // Hanguskan ciphertext token setelah memilih
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(voters.id, voterId),
          eq(voters.electionId, electionId),
          eq(voters.hasVoted, false) // Syarat mutlak belum pernah memilih
        )
      )
      .returning({
        id: voters.id,
        name: voters.name,
        voterIdentity: voters.voterIdentity,
      });

    // Jika 0 baris terpengaruh, berarti pemilih sudah memilih (atau terkena race condition) -> ROLLBACK!
    if (updatedVoters.length === 0) {
      throw new VotingError(
        "ALREADY_VOTED",
        "Suara kamu sudah pernah tercatat sebelumnya. Satu orang hanya memiliki satu suara.",
        409
      );
    }

    const voter = updatedVoters[0];

    // 4. INSERT suara ke tabel `votes` TANPA identitas pemilih
    await tx.insert(votes).values({
      electionId,
      candidateId,
      createdAt: sql`date_trunc('minute', now())`,
    });

    // 5. INSERT jejak audit ke `audit_logs` TANPA identitas kandidat yang dipilih
    await tx.insert(auditLogs).values({
      electionId,
      actorType: "voter",
      actorId: voter.id,
      actorName: voter.name,
      actorIdentity: `NIS ${voter.voterIdentity}`,
      action: "vote_cast",
      actionTitle: "Vote cast",
      description: "Pemilih telah memberikan suara",
      ipAddress,
    });

    return { success: true, votedAt: new Date().toISOString() };
  });
}
4. Kriptografi & Manajemen Token Pemilih
4.1. Spesifikasi Format Token
Panjang: 8 Karakter (contoh di UI: JUFT88TF, PYBRYG4V, KJ2TRDQG).

Alfabet Karakter Non-Ambigu (31 Karakter):

Menggunakan huruf kapital dan angka dengan mengecualikan karakter yang mirip secara visual (0, O, 1, I, L dikeluarkan):

Alfabet: 23456789ABCDEFGHJKMNPQRSTUVWXYZ (31 simbol ≈ 4,95 bit entropi per karakter).

Generator: Wajib menggunakan CSPRNG (crypto.randomInt(0, ALPHABET.length) dari modul node:crypto), dilarang menggunakan Math.random().

4.2. Penyimpanan Token & Solusi Fitur "Salin Token"
Pada antarmuka /admin/voters, panitia membutuhkan fitur untuk melihat badge token (JUFT88TF) dan menekan tombol Salin saat mendistribusikan token di lapangan. Namun menyimpan token plaintext di database berisiko tinggi jika tabel voters terekspos.

Solusi Hibrida (Dual-Column Crypto):

token_hash (HMAC-SHA256 dengan TOKEN_HMAC_SECRET):

Digunakan khusus saat proses login pemilih (/api/auth/voter/login).

Karena token 8 karakter dibuat secara acak kriptografis oleh server (bukan password buatan manusia yang lemah) dan dilindungi oleh Rate Limiting + Account Lockout (maksimal 5 percobaan gagal), penggunaan HMAC-SHA256(token, process.env.TOKEN_HMAC_SECRET) yang dibandingkan via crypto.timingSafeEqual memberikan verifikasi konstan yang cepat tanpa membebani CPU serverless saat ratusan siswa login bersamaan di pagi hari.

token_encrypted (AES-256-GCM Reversibel Berbatas Waktu):

Agar fitur Salin Token dan cetak daftar token per kelas di halaman /admin/voters dapat berfungsi tanpa menyimpan plaintext di database, token dienkripsi menggunakan AES-256-GCM dengan kunci TOKEN_ENCRYPTION_KEY (32-byte hex yang hanya tersimpan di Environment Variable server aplikasi, terpisah dari database Neon).

Trade-off & Siklus Hidup Keamanan:

Jika penyerang hanya mendapatkan dump SQL database tanpa environment variables Vercel, mereka tidak dapat membaca token.

Begitu seorang pemilih selesai memberikan suara (has_voted = true), kolom token_encrypted otomatis ditimpa menjadi "[REDACTED]" di dalam transaksi pemungutan suara sehingga token lama tidak lagi bisa didekripsi maupun digunakan.

Saat panitia menekan Reset token, token baru di-generate, token_hash dan token_encrypted diperbarui, semua sesi aktif pemilih tersebut di tabel voter_sessions dihapus, dan aksi token_reset dicatat di audit_logs.

TypeScript
// src/lib/crypto-token.ts
import crypto from "node:crypto";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateVoterToken(length = 8): string {
  let token = "";
  for (let i = 0; i < length; i++) {
    token += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return token;
}

export function hashVoterToken(token: string): string {
  const normalized = token.trim().toUpperCase();
  return crypto
    .createHmac("sha256", process.env.TOKEN_HMAC_SECRET!)
    .update(normalized)
    .digest("hex");
}

export function verifyVoterToken(inputToken: string, storedHash: string): boolean {
  const inputHash = hashVoterToken(inputToken);
  const a = Buffer.from(inputHash, "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function encryptVoterToken(token: string): string {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, "hex"); // 32 bytes
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptVoterToken(payload: string): string {
  if (!payload || payload === "[REDACTED]") return "••••••••";
  const [ivHex, authTagHex, encryptedHex] = payload.split(":");
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
5. Rate Limiting, Lockout & Pencegahan Brute-Force
5.1. Login Pemilih (/api/auth/voter/login)
Dilindungi oleh mekanisme pertahanan dua lapis:

Per-Voter Account Lockout (Database Level):

Setiap kali kombinasi NIS ditemukan tetapi Token salah, kolom voters.failed_login_attempts bertambah +1 dan sistem mencatat aksi login_failed di audit_logs.

Jika failed_login_attempts >= 5, kolom voters.locked_until diset ke NOW() + INTERVAL '15 minutes'.

Selama periode locked_until > NOW(), semua percobaan login untuk NIS tersebut langsung ditolak sebelum memeriksa hash token.

Panitia yang melakukan Reset token pada pemilih secara otomatis mereset failed_login_attempts = 0 dan locked_until = NULL.

Per-IP Rate Limiting:

Maksimal 10 percobaan login per menit per IP Address (menggunakan tabel rate limit / in-memory sliding window dengan kunci gabungan ip_address + voter_identity agar jaringan Wi-Fi sekolah yang berbagi satu IP publik tidak memblokir siswa lain yang berbeda NIS).

5.2. Login Admin & Panitia (Better Auth)
Mengaktifkan rateLimit bawaan Better Auth (penyimpanan database table atau memory) dengan batas maksimal 5 percobaan gagal per 10 menit pada endpoint /api/auth/sign-in/email dan /api/auth/sign-in/username.

6. Immutability Audit Log (Append-Only)
Sesuai keterangan pada antarmuka /admin/logs ("Riwayat aktivitas panitia, pemilih, dan sistem. Data ini hanya untuk dibaca dan tidak bisa diubah dari panel"), integritas log dijaga melalui:

Zero Mutation Endpoints: Aplikasi sama sekali tidak menyediakan fungsi Drizzle .update(auditLogs) maupun .delete(auditLogs) di seluruh codebase.

PostgreSQL Trigger Proteksi Immutability:
Dalam file migrasi SQL kustom (drizzle/migrations/0001_audit_log_immutable.sql), dipasang trigger database yang menolak segala upaya UPDATE atau DELETE pada baris audit_logs:

SQL
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$ BEGIN RAISE EXCEPTION 'Security Violation: Tabel audit_logs bersifat append-only dan tidak dapat diubah atau dihapus.'; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_audit_logs
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
Aturan Sanitasi Data Log (PII & Secrecy):

DILARANG mencatat string token pemilih (baik plaintext maupun hash) atau password admin di kolom description.

DILARANG mencatat candidate_id atau nama kandidat pilihan pemilih saat aksi vote_cast.

7. Kerahasiaan Hasil Sementara & Otorisasi Endpoint
Penyembunyian Hasil Selama Pemungutan Suara:

Pemilih (voter) maupun pengunjung publik tidak memiliki akses ke halaman /admin/results maupun API /api/admin/results.

Seperti tertulis di layar /admin/results: "Perolehan suara tiap kandidat. Angka ini hanya bisa dilihat panitia dan tidak ditampilkan ke pemilih."

Validasi Role di Server:

Endpoint agregasi hasil (/api/admin/results dan /api/admin/dashboard/stats) memverifikasi sesi Better Auth di server dan memastikan session.user.role IN ('super_admin', 'committee').

Jika sesi berasal dari cookie pemilih (votera_voter_session), server langsung mengembalikan 403 Forbidden.

8. Perlindungan Web, Upload File, & Environment Variables
8.1. Proteksi CSRF & Cookie Sesi
Admin Session (Better Auth): Cookie HttpOnly, Secure (di produksi), SameSite=Lax, dengan verifikasi header Origin / Host bawaan Better Auth dan Next.js Server Actions.

Voter Session (votera_voter_session): Menggunakan cookie terpisah (HttpOnly, Secure, SameSite=Strict, masa berlaku singkat 2 jam) yang menyimpan token sesi acak yang di-hash di tabel voter_sessions. Begitu pemilih klik Keluar, baris sesi dihapus dari DB dan cookie dibersihkan.

8.2. Security Headers (next.config.ts)
Menambahkan HTTP Security Headers standar pada seluruh route:

X-Content-Type-Options: nosniff

X-Frame-Options: DENY (mencegah clickjacking pada bilik surat suara)

Referrer-Policy: strict-origin-when-cross-origin

Permissions-Policy: camera=(), microphone=(), geolocation=()

8.3. Validasi Upload File (Foto Kandidat & Impor DPT)
Foto Kandidat:

Hanya boleh diunggah oleh super_admin.

Tipe MIME yang diizinkan: image/jpeg, image/png, image/webp (divalidasi dari magic bytes buffer file, bukan sekadar ekstensi nama file).

Ukuran maksimal: 2 MB per foto.

Nama file di penyimpanan objek diganti menjadi UUID acak (candidates/{electionId}/{uuid}.webp) untuk mencegah path traversal.

File Impor DPT (CSV/XLSX):

Diparse di memori tanpa mengeksekusi formula makro Excel.

Ukuran maksimal file: 5 MB (maksimal 5.000 baris per batch impor).

Sanitasi karakter awal sel (=, +, -, @) untuk mencegah CSV Formula Injection saat data diekspor kembali ke Excel.

8.4. Backup & Pemulihan Data (Disaster Recovery)
Memanfaatkan fitur Neon Point-in-Time Restore (PITR) dengan jendela retensi minimal 7 hari selama minggu pemilihan agar database dapat dipulihkan ke detik sebelum insiden jika terjadi kesalahan operasional fatal oleh admin.
