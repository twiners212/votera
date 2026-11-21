# Testing Strategy & Verification Scenarios — Votera

**Nama Aplikasi:** Votera  
**Versi Dokumen:** 1.0.0  
**Testing Stack:** Vitest (Unit & Integration) + Playwright (End-to-End / E2E)

---

## 1. Strategi & Piramida Pengujian

Mengingat Votera adalah sistem pemungutan suara (*security-critical*), pengujian difokuskan pada integritas transaksi suara, isolasi hak akses, keandalan impor DPT, dan ketahanan terhadap manipulasi request paralel.

| Level Pengujian | Tool Utama | Cakupan Utama | Lokasi File |
| :--- | :--- | :--- | :--- |
| **Unit Testing** | `vitest` | Generator & enkripsi token (`HMAC-SHA256`, `AES-256-GCM`), skema validasi Zod, parser & sanitasi CSV/XLSX (`dpt-parser.ts`), kalkulasi persentase suara. | `tests/unit/*.test.ts` |
| **Integration Testing (DB & API)** | `vitest` + Neon Test Branch | Transaksi atomik `castVoteTransaction` (termasuk uji *race condition*), validasi jadwal server, *rate limiting* & *lockout* NIS, *immutability* trigger `audit_logs`, dan otorisasi Route Handler. | `tests/integration/*.test.ts` |
| **End-to-End (E2E) Testing** | `@playwright/test` | Alur penuh Pemilih (Login -> Pilih -> Konfirmasi -> `/vote/thanks`) dan alur Panitia (Login -> Impor DPT -> Reset Token -> Pantau Hasil Polling). | `tests/e2e/*.spec.ts` |

---

## 2. Daftar Skenario Uji Wajib (Mandatory Test Cases)

Seluruh skenario di bawah ini **WAJIB** lulus sebelum aplikasi dinaikkan ke lingkungan produksi:

### 2.1. Skenario Keamanan & Integritas Suara (Voting Security)

| ID Uji | Skenario | Kondisi Awal (Pre-condition) | Aksi Pengujian | Hasil yang Diharapkan (Expected Result) |
| :--- | :--- | :--- | :--- | :--- |
| **TC-01** | **Pencegahan Vote Dua Kali (Sequential Double-Vote)** | Pemilih (`NIS: 2324004`) sudah berhasil memilih (`has_voted = true`). | Pemilih mengirim request `POST /api/voter/vote` kedua kalinya menggunakan cookie sesi yang sama. | HTTP `409 Conflict` (`ALREADY_VOTED`). Jumlah baris di tabel `votes` tetap bertambah 1 saja. Halaman UI me-redirect ke `/vote/thanks`. |
| **TC-02** | **Pencegahan Vote Dua Kali via Request Paralel (Race Condition)** | Pemilih (`NIS: 2324001`, `has_voted = false`) memiliki sesi aktif dan jadwal sedang `open`. | Mengirim **10 request `POST /api/voter/vote` secara bersamaan** (`Promise.all`) dalam milidetik yang sama. | Tepat **1 request** mengembalikan HTTP `200 OK`, sedangkan **9 request lainnya** ditolak dengan HTTP `409 Conflict` (`ALREADY_VOTED`). Total suara masuk di tabel `votes` dari eksekusi ini mutlak hanya **1 baris**. |
| **TC-03** | **Vote di Luar Jadwal (Sebelum Buka / Setelah Tutup)** | Jadwal pemilihan `start_at` masih besok ATAU `end_at` sudah lewat 1 menit yang lalu (atau `status !== 'open'`). | Pemilih mem-bypass UI dan menembak langsung `POST /api/voter/ login` atau `POST /api/voter/vote`. | HTTP `403 Forbidden` (`ELECTION_CLOSED`). Suara ditolak dan status `has_voted` tetap `false`. |
| **TC-04** | **Anonimitas Suara & Truncated Timestamp** | Pemilih memberikan suara untuk Kandidat #1 pada pukul `10:15:42.891`. | Query langsung ke tabel `votes` dan `audit_logs` di database. | Tabel `votes` tidak memiliki referensi ke `voter_id`; nilai `votes.created_at` tercatat sebagai `10:15:00.000` (dibulatkan ke menit). Tabel `audit_logs` mencatat `vote_cast` atas nama pemilih tanpa mencantumkan `candidate_id`. |

### 2.2. Skenario Autentikasi, Token & Rate Limiting

| ID Uji | Skenario | Kondisi Awal (Pre-condition) | Aksi Pengujian | Hasil yang Diharapkan (Expected Result) |
| :--- | :--- | :--- | :--- | :--- |
| **TC-05** | **Token Salah & Kedaluwarsa (Setelah Reset)** | Panitia melakukan **Reset Token** untuk `NIS: 2324011` (Token lama: `AAAA2222`, Token baru: `BBBB3333`). | Pemilih mencoba login dengan token lama `AAAA2222`. | HTTP `401 Unauthorized` (`INVALID_CREDENTIALS`). Mencatat `voter_login_failed` di `audit_logs` dan menaikkan `failed_login_attempts`. |
| **TC-06** | **Rate Limit & Account Lockout Pemilih** | Pemilih (`NIS: 2324001`) memiliki `failed_login_attempts = 0`. | Mengirim 5 kali percobaan login dengan token salah berturut-turut, lalu pada percobaan ke-6 memasukkan **token yang benar**. | Setelah gagal ke-5, kolom `locked_until` terisi `NOW() + 15 menit`. Percobaan ke-6 (walaupun token benar) ditolak dengan HTTP `403 Forbidden` (`VOTER_LOCKED`). |
| **TC-07** | **Penghangusan Token Setelah Memilih** | Pemilih (`NIS: 2324004`) baru saja menyelesaikan pemungutan suara. | Panitia memanggil `GET /api/admin/voters/[id]/copy-token` atau menekan tombol **Reset token**. | Endpoint `copy-token` menolak permintaan karena `token_encrypted` sudah diredaksi (`"[REDACTED]"`). Endpoint `reset-token` mengembalikan HTTP `409 Conflict` (`VOTER_IMMUTABLE`). |

### 2.3. Skenario Otorisasi & Penyembunyian Hasil

| ID Uji | Skenario | Kondisi Awal (Pre-condition) | Aksi Pengujian | Hasil yang Diharapkan (Expected Result) |
| :--- | :--- | :--- | :--- | :--- |
| **TC-08** | **Pemilih Mengakses Endpoint Admin** | Pengguna login sebagai Pemilih (memiliki cookie `votera_voter_session`, tanpa sesi Better Auth). | Mengakses `GET /api/admin/voters`, `POST /api/admin/candidates`, atau membuka halaman `/admin/dashboard`. | Endpoint API mengembalikan HTTP `401 Unauthorized` / `403 Forbidden`. Halaman `/admin/*` me-redirect ke `/admin/login`. |
| **TC-09** | **Hasil Tersembunyi Saat Pemungutan Suara Berlangsung** | Pemilihan berstatus `open` dan `is_result_public = false`. | Pengunjung publik atau Pemilih memanggil `GET /api/admin/results` atau mencoba membaca angka suara kandidat dari endpoint publik `/api/candidates`. | `GET /api/admin/results` mengembalikan HTTP `403 Forbidden`. Endpoint publik `/api/candidates` hanya mengembalikan profil, visi, misi, dan program kerja tanpa properti `voteCount`. |
| **TC-10** | **Pembatasan Role Committee vs Super Admin** | Panitia login dengan role `committee`. | Mencoba menghapus kandidat (`DELETE /api/admin/candidates/[id]`), mengubah jadwal (`PUT /api/admin/settings`), atau menambah akun admin (`POST /api/admin/users`). | Seluruh request ditolak dengan HTTP `403 Forbidden` (`FORBIDDEN`). |
| **TC-11** | **Immutability Tabel Audit Logs** | Terdapat 10 baris di tabel `audit_logs`. | Menjalankan query SQL `DELETE FROM audit_logs` atau `UPDATE audit_logs SET description = 'hacked'` secara langsung. | PostgreSQL menolak eksekusi query dan melempar exception dari trigger `trg_protect_audit_logs`. |

### 2.4. Skenario Impor DPT dengan Data Rusak (Malformed Import)

| ID Uji | Skenario | Kondisi Awal (Pre-condition) | Aksi Pengujian | Hasil yang Diharapkan (Expected Result) |
| :--- | :--- | :--- | :--- | :--- |
| **TC-12** | **Impor CSV/XLSX dengan Baris Rusak, Duplikat & Formula Injection** | File Excel berisi 5 baris: <br>1. Baris valid (`2324099`, `Budi`, `Rombel 1`)<br>2. NIS kosong (`""`, `Siti`, `Rombel 1`)<br>3. NIS duplikat di dalam file (`2324099`, `Budi 2`, `Rombel 2`)<br>4. Rombel tidak terdaftar (`2324100`, `Andi`, `Rombel 99`)<br>5. String berbahaya CSV Injection (`2324101`, `=CMD\|' /C calc'!A0`, `Rombel 1`) | Mengunggah file ke `POST /api/admin/voters/import`. | Sistem menolak/melewati baris 2, 3, 4, dan 5 dengan pesan error spesifik per nomor baris (mis. `Baris 2: NIS wajib diisi`, `Baris 4: Rombel 'Rombel 99' tidak ditemukan`, `Baris 5: Karakter awal tidak diizinkan`), serta hanya menyimpan baris valid atau mengembalikan laporan validasi yang presisi tanpa membuat server *crash*. |

---

## 3. Contoh Kode Pengujian Kritis

### 3.1. Uji Integrasi: Race Condition Double-Voting (`tests/integration/voting-race.test.ts`)

Pengujian ini membuktikan bahwa `castVoteTransaction` dengan `dbPool` benar-benar kebal terhadap serangan *concurrent request*:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { db, dbPool } from "@/db";
import { elections, candidates, voters, votes, voterGroups } from "@/db/schema";
import { castVoteTransaction } from "@/lib/voting/cast-vote";
import { eq } from "drizzle-orm";

describe("Atomic Voting & Race Condition Prevention", () => {
  let electionId: string;
  let candidateId: string;
  let voterId: string;

  beforeEach(async () => {
    // Setup election aktif (buka 1 jam yang lalu sampai 1 jam ke depan)
    const [election] = await db
      .insert(elections)
      .values({
        slug: `test-race-${Date.now()}`,
        title: "Test Election",
        organizationName: "SMA Test",
        status: "open",
        startAt: new Date(Date.now() - 3600_000),
        endAt: new Date(Date.now() + 3600_000),
      })
      .returning();
    electionId = election.id;

    const [group] = await db
      .insert(voterGroups)
      .values({ electionId, name: "Rombel 1" })
      .returning();

    const [candidate] = await db
      .insert(candidates)
      .values({
        electionId,
        candidateNumber: 1,
        name: "Raka Aditya Pratama",
        classOrUnit: "XI IPA",
        motto: "Maju Bersama",
        vision: "Visi Uji",
        isActive: true,
      })
      .returning();
    candidateId = candidate.id;

    const [voter] = await db
      .insert(voters)
      .values({
        electionId,
        groupId: group.id,
        voterIdentity: "2324001",
        name: "Aditya Pratama",
        tokenHash: "dummy_hash",
        tokenEncrypted: "dummy_cipher",
        hasVoted: false,
        voterStatus: "logged_in",
      })
      .returning();
    voterId = voter.id;
  });

  it("harus hanya mencatat tepat 1 suara meskipun dikirim 10 request secara paralel", async () => {
    // Kirim 10 transaksi secara serentak (simulasi race condition)
    const concurrentRequests = Array.from({ length: 10 }, () =>
      castVoteTransaction({
        electionId,
        voterId,
        candidateId,
        ipAddress: "127.0.0.1",
      })
    );

    const results = await Promise.allSettled(concurrentRequests);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // 1. Tepat 1 request berhasil, 9 lainnya wajib gagal dengan kode ALREADY_VOTED
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(9);

    for (const r of rejected) {
      if (r.status === "rejected") {
        expect(r.reason.code).toBe("ALREADY_VOTED");
      }
    }

    // 2. Verifikasi jumlah suara di tabel votes hanya bertambah 1
    const recordedVotes = await db
      .select()
      .from(votes)
      .where(eq(votes.electionId, electionId));
    expect(recordedVotes).toHaveLength(1);

    // 3. Verifikasi status pemilih menjadi 'voted' dan tokenEncrypted diredaksi ("[REDACTED]")
    const [updatedVoter] = await db
      .select()
      .from(voters)
      .where(eq(voters.id, voterId));
    expect(updatedVoter.hasVoted).toBe(true);
    expect(updatedVoter.voterStatus).toBe("voted");
    expect(updatedVoter.tokenEncrypted).toBe("[REDACTED]");
  });
});
```

### 3.2. Uji Unit: Validasi & Sanitasi Impor DPT Rusak (`tests/unit/dpt-parser.test.ts`)

```typescript
import { describe, it, expect } from "vitest";
import { validateDptRows } from "@/lib/importers/dpt-parser";

describe("DPT Importer Validation & Sanitization", () => {
  const validGroupsMap = new Map([
    ["rombel 1", "uuid-rombel-1"],
    ["rombel 2", "uuid-rombel-2"],
  ]);
  const existingNisSet = new Set(["2324001"]);

  it("mendeteksi baris rusak, NIS duplikat, Rombel tidak valid, dan CSV injection", () => {
    const rawRows = [
      { nis: "2324004", nama: "Putri Ayu Lestari", kelas: "Rombel 2" }, // Valid
      { nis: "", nama: "Tanpa NIS", kelas: "Rombel 1" }, // Error: NIS kosong
      { nis: "2324001", nama: "Duplikat DB", kelas: "Rombel 1" }, // Error: Sudah ada di DB
      { nis: "2324004", nama: "Duplikat File", kelas: "Rombel 1" }, // Error: Duplikat di dalam file
      { nis: "2324009", nama: "Kelas Salah", kelas: "Rombel 99" }, // Error: Rombel tidak ditemukan
      { nis: "2324010", nama: "=1+1", kelas: "Rombel 1" }, // Error: CSV Formula Injection
    ];

    const result = validateDptRows(rawRows, validGroupsMap, existingNisSet);

    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0].voterIdentity).toBe("2324004");
    expect(result.errors).toHaveLength(5);
    expect(result.errors.map((e) => e.rowNumber)).toEqual([2, 3, 4, 5, 6]);
  });
});
```

---

## 4. Perintah Eksekusi Pengujian

```bash
# Menjalankan seluruh unit & integration test (Vitest)
pnpm test

# Menjalankan Vitest dalam mode watch saat development
pnpm test:watch

# Menjalankan pengujian khusus keamanan & race condition
pnpm test tests/integration/voting-race.test.ts

# Menjalankan pengujian End-to-End (Playwright) di headless browser
pnpm test:e2e
```
