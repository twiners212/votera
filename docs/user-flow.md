# User Flow & Role Matrix — Votera

**Nama Aplikasi:** Votera  
**Versi Dokumen:** 1.0.0  

---

## 1. Matriks Peran & Hak Akses (RBAC Matrix)

Votera menerapkan kontrol akses berbasis peran (*Role-Based Access Control*) dengan 4 tingkatan pengguna:
1. **Public (Anonim):** Pengunjung yang belum login.
2. **Voter (Pemilih):** Pemilih sah yang terdaftar di DPT dan login menggunakan `NIS/ID + Token`.
3. **Committee (Panitia Operator):** Panitia lapangan yang mengelola DPT, token, dan memantau jalannya pemilihan.
4. **Super Admin:** Pemilik sistem / Ketua Panitia yang memiliki akses penuh ke konfigurasi sistem, data master, kandidat, dan manajemen akun panitia.

| Modul / Fitur | Endpoint / Route Utama | Public | Voter | Committee | Super Admin |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Beranda Pemilihan** | `/` | ✅ | ✅ | ✅ | ✅ |
| **Daftar & Detail Profil Kandidat** | `/candidates`, `/candidates/[id]` | ✅ | ✅ | ✅ | ✅ |
| **Login Pemilih (NIS + Token)** | `/login` | ✅ | 🔄 (Redirect) | ❌ | ❌ |
| **Surat Suara Digital (Memilih)** | `/vote` | ❌ | ✅ (Jika `has_voted=false` & jadwal buka) | ❌ | ❌ |
| **Halaman Konfirmasi Suara Tercatat** | `/vote/thanks` | ❌ | ✅ (Jika `has_voted=true`) | ❌ | ❌ |
| **Login Panel Panitia** | `/admin/login` | ✅ | ❌ | 🔄 (Redirect) | 🔄 (Redirect) |
| **Dashboard & Kesiapan Pemilihan** | `/admin/dashboard` | ❌ | ❌ | ✅ (View) | ✅ (Full) |
| **Manajemen Kandidat (CRUD)** | `/admin/candidates` | ❌ | ❌ | 👁️ (View Only) | ✅ (Full CRUD) |
| **Manajemen DPT (CRUD, Impor, Filter)** | `/admin/voters` | ❌ | ❌ | ✅ (Full CRUD) | ✅ (Full CRUD) |
| **Salin Token & Reset Token Pemilih** | `/admin/voters` (Action) | ❌ | ❌ | ✅ (Jika `has_voted=false`) | ✅ (Jika `has_voted=false`) |
| **Hasil Real-Time & Ekspor Laporan** | `/admin/results` | ❌* | ❌* | ✅ | ✅ |
| **Data Master (Tingkat Kelas & Jurusan)** | `/admin/classes`, `/admin/majors` | ❌ | ❌ | 👁️ (View Only) | ✅ (Full CRUD) |
| **Pengaturan Jadwal & Identitas** | `/admin/settings` | ❌ | ❌ | 👁️ (View Only) | ✅ (Full Edit) |
| **Log Aktivitas (Audit Trail)** | `/admin/logs` | ❌ | ❌ | 👁️ (Read-Only) | 👁️ (Read-Only) |
| **Kelola Admin (Multi-Admin CRUD)** | `/admin/users` | ❌ | ❌ | ❌ | ✅ (Full CRUD) |

> **Catatan:**  
> - `*` Hasil pemilihan disembunyikan sepenuhnya dari **Public** dan **Voter** selama pemungutan suara berlangsung. Super Admin dapat mengaktifkan toggle `is_result_public` di pengaturan hanya setelah waktu pemungutan suara ditutup.  
> - **Log Aktivitas (`/admin/logs`)** bersifat *Read-Only / Append-Only* bahkan untuk **Super Admin** guna menjamin integritas audit dan mencegah penghapusan jejak kecurangan.

---

## 2. Alur Pemilih (Voter Flow)

Alur pemilih dirancang sesingkat mungkin dengan validasi status berlapis untuk memastikan prinsip **"Satu Orang, Satu Suara"** serta kerahasiaan pilihan.

### 2.1. Tahapan Alur Pemilih:
1. **Akses Beranda (`/`):**
   - Pemilih melihat informasi acara (mis. *PILKETOS 2026 - SMA Bojong Gede*), badge status pemungutan suara (`Dibuka` / `Belum Dibuka` / `Ditutup`), dan jumlah calon terdaftar.
   - Pemilih dapat menekan tombol **"Masuk untuk memilih"** menuju `/login`.
2. **Autentikasi Pemilih (`/login`):**
   - Pemilih memasukkan `NIS` dan `Token` unik 8 karakter.
   - **Validasi Server:**
     - Cek *Rate Limit* IP & NIS (cegah *brute-force*).
     - Cek apakah jadwal pemungutan suara sedang dalam rentang `start_at <= NOW() <= end_at`. Jika di luar jadwal, tolak dengan pesan jadwal belum dibuka / sudah berakhir.
     - Verifikasi kecocokan `NIS` dan hash `Token` di tabel `voters`.
     - Jika valid dan `has_voted == false`: Buat sesi pemilih, ubah status pemilih dari `not_voted` menjadi `logged_in` ("Sudah login"), catat log `voter_login` di `audit_logs`, lalu arahkan ke `/vote` (atau `/candidates` jika ingin melihat profil dulu).
     - Jika valid namun `has_voted == true`: Langsung arahkan ke halaman bukti `/vote/thanks` (pemilih tidak bisa mengakses surat suara lagi).
3. **Eksplorasi Kandidat (`/candidates` & `/candidates/[id]`):**
   - Pemilih melihat daftar kartu kandidat beserta foto, motto, dan 3 poin misi utama.
   - Pemilih dapat membuka halaman detail (`/candidates/[id]`) untuk membaca Visi, Misi lengkap, Program Kerja, dan daftar Pendukung.
4. **Surat Suara Digital (`/vote`):**
   - Menampilkan grid seluruh kandidat berstatus `Aktif`.
   - Pemilih mengetuk salah satu kartu kandidat -> Kartu menyala dengan border merah (`#D93829`), ikon centang muncul di sudut kanan atas foto, dan *Sticky Bottom Bar* menampilkan teks `"Dipilih: No. 1 — Raka Aditya Pratama"` beserta tombol **"Kirim suara"** yang aktif.
5. **Konfirmasi & Transaksi Suara Atomik:**
   - Saat menekan **"Kirim suara"**, muncul modal konfirmasi: *"Apakah kamu yakin memilih Kandidat No. 1 - Raka Aditya Pratama? Pilihan tidak dapat diubah setelah dikirim."*
   - Saat dikonfirmasi, server menjalankan **Transaksi Database Atomik**:
     1. Validasi ulang waktu pemilihan aktif (`NOW()` di antara jadwal).
     2. Eksekusi `UPDATE voters SET has_voted = true, voter_status = 'voted', voted_at = NOW() WHERE id = $voterId AND has_voted = false`.
     3. Jika `rowCount === 0` (sudah pernah memilih/race condition), batalkan transaksi (*rollback*) dan kembalikan error `ALREADY_VOTED`.
     4. Eksekusi `INSERT INTO votes (election_id, candidate_id)` **tanpa menyertakan `voter_id`**.
     5. Eksekusi `INSERT INTO audit_logs` dengan aksi `vote_cast` untuk `voter_id` **tanpa menyertakan `candidate_id`**.
6. **Selesai & Konfirmasi (`/vote/thanks`):**
   - Menampilkan layar *"SUARA TERCATAT — Terima kasih, [Nama Pemilih]!"*.
   - Pemilih dapat menekan **"Lihat kandidat"** (mode baca saja) atau **"Keluar"** (menghapus sesi dan mencatat `voter_logout`).

### 2.2. Diagram Alur Pemilih (Mermaid)

```mermaid
flowchart TD
    A([Buka Aplikasi / Beranda]) --> B{Klik 'Masuk untuk memilih'}
    B --> C[/Halaman Login Pemilih: Input NIS & Token/]
    C --> D{Validasi Server:<br/>Rate Limit, Jadwal & Token}
    
    D -- Gagal: Token Salah / Limit --> E[Tampilkan Pesan Error & Catat 'login_failed']
    E --> C
    
    D -- Gagal: Di Luar Jadwal --> F[Tampilkan Alert: Pemungutan Suara Belum Dibuka / Sudah Ditutup]
    F --> A

    D -- Berhasil: Valid --> G{Cek Status 'has_voted'}
    
    G -- "has_voted == true" --> H[/Redirect ke /vote/thanks<br/>Suara Sudah Tercatat/]
    
    G -- "has_voted == false" --> I[Update Status 'Sudah login'<br/>Catat Log 'voter_login']
    I --> J[/Halaman Surat Suara /vote/]
    
    J <--> K[/Lihat Daftar & Detail Kandidat<br/>/candidates/]
    
    J --> L[Ketuk Kartu Kandidat Pilihan]
    L --> M[Klik Tombol 'Kirim suara' di Sticky Bar]
    M --> N{Modal Konfirmasi:<br/>Yakin dengan pilihan?}
    
    N -- Batal --> J
    N -- Ya, Kirim Suara --> O[Server: Mulai Transaksi Atomik DB]
    
    O --> P{UPDATE voters SET has_voted=true<br/>WHERE id=X AND has_voted=false}
    P -- "0 Baris (Race Condition)" --> Q[Rollback & Redirect ke /vote/thanks]
    P -- "1 Baris Berhasil" --> R[INSERT INTO votes tanpa voter_id<br/>INSERT audit_logs 'vote_cast' tanpa candidate_id]
    
    R --> S[Commit Transaksi]
    S --> H
    H --> T{Klik 'Keluar'}
    T --> U([Hapus Sesi & Catat 'voter_logout'])
3. Alur Panitia & Super Admin (Admin Flow)
Alur administrasi dibagi menjadi 3 fase operasional: Fase Persiapan (Pra-Pemilihan), Fase Pemungutan Suara (Hari-H), dan Fase Pasca-Pemilihan (Rekapitulasi & Laporan).

3.1. Tahapan Alur Admin:
Fase 1: Persiapan & Setup Pemilihan (Super Admin & Panitia)

Login Panel Panitia (/admin/login): Masuk dengan akun Admin -> Sistem mencatat admin_login di audit_logs -> Masuk ke /admin/dashboard.

Pengaturan Identitas & Data Master:

Super Admin mengisi Nama Sekolah/Instansi di /admin/settings.

Super Admin mengisi data master Tingkat Kelas (mis. X, XI, XII) dan Jurusan (mis. IPA, IPS) serta Rombel (mis. Rombel 1–7).

Input Kandidat (/admin/candidates):

Super Admin menambahkan minimal 2 kandidat aktif beserta foto potret, nomor urut, motto, visi, misi, program, dan pendukung.

Input / Impor DPT (/admin/voters):

Panitia mengunggah file CSV/XLSX daftar pemilih atau menambahkannya satu per satu.

Sistem memvalidasi format baris, men-generate token unik 8 karakter untuk tiap pemilih, menyimpan versi hash ke DB, dan menyediakan akses salin/ekspor token untuk dibagikan ke pemilih.

Atur Jadwal Pemilihan:

Super Admin mengatur waktu mulai (start_at) dan selesai (end_at).

Panel Kesiapan pemilihan di /admin/dashboard akan berubah menjadi centang hijau semua (Siap) ketika 4 syarat terpenuhi: (1) Minimal 2 kandidat aktif, (2) DPT sudah terisi, (3) Jadwal sudah diatur, (4) Nama sekolah sudah diisi.

Fase 2: Monitoring Hari-H & Layanan Helpdesk DPT

Monitoring Dashboard (/admin/dashboard):

Memantau kartu KPI (Total DPT, Sudah memilih, Belum memilih, % Partisipasi) dan progress bar Partisipasi per kelas/rombel yang diperbarui otomatis via polling.

Penanganan Masalah Token (/admin/voters):

Jika ada siswa/pemilih yang melapor lupa token: Panitia mencari NIS/Nama pemilih di /admin/voters.

Pastikan status pemilih masih Belum memilih atau Sudah login.

Klik "Reset token" -> Sistem men-generate token baru, menghanguskan token lama, mencatat token_reset di audit_logs, dan menampilkan token baru untuk disalin dan diberikan kepada pemilih. (Jika status pemilih sudah Sudah memilih, tombol Reset Token dan Hapus otomatis dinonaktifkan).

Fase 3: Pemantauan Hasil & Laporan Akhir

Hasil Pemilihan (/admin/results):

Panitia memantau perolehan suara tiap kandidat secara real-time (dengan polling aktif default 8 detik atau opsi centang "Segarkan otomatis tiap 30 detik" sebagai mode hemat).

Audit Keamanan (/admin/logs):

Memeriksa riwayat aktivitas untuk memastikan tidak ada anomali (memfilter login gagal, aktivitas panitia, dan waktu suara masuk).

Ekspor Laporan (/admin/results -> Lihat Laporan):

Setelah waktu pemilihan selesai (NOW() > end_at), panitia mengunduh laporan hasil resmi dan tabel partisipasi per kelas dalam format PDF (siap cetak & tanda tangan Berita Acara) atau Excel (XLSX).

3.2. Diagram Alur Admin (Mermaid)
Cuplikan kode
flowchart TD
    A([Login Panel Panitia /admin/login]) --> B[/Dashboard Admin /admin/dashboard/]
    
    subgraph Fase_1_Persiapan [Fase 1: Setup & Persiapan]
        B --> C[Atur Nama Instansi & Jadwal<br/>/admin/settings]
        B --> D[Kelola Data Master Kelas & Jurusan<br/>/admin/classes & /admin/majors]
        B --> E[Tambah Min. 2 Kandidat Aktif<br/>/admin/candidates]
        B --> F[Impor CSV/XLSX atau Tambah DPT<br/>/admin/voters]
        C & D & E & F --> G{Checklist Kesiapan Pemilihan}
        G -- Lengkap 4 Syarat --> H([Status Kesiapan: SIAP])
    end

    subgraph Fase_2_Pelaksanaan [Fase 2: Hari-H Pemungutan Suara]
        H --> I[Pantau Partisipasi per Kelas Real-Time<br/>Polling 5–10 Detik<br/>(Default 8 Detik)]
        H --> J{Pemilih Lupa Token?}
        J -- Ya --> K[Cari NIS di /admin/voters]
        K --> L{Apakah Status == Sudah Memilih?}
        L -- Ya --> M[Tolak Reset: Pemilih Sudah Menggunakan Hak Suara]
        L -- Tidak --> N[Klik 'Reset token' -> Salin Token Baru ke Pemilih]
    end

    subgraph Fase_3_Hasil_Audit [Fase 3: Hasil, Audit & Laporan]
        I --> O[/Pantau Perolehan Suara Kandidat<br/>/admin/results/]
        O --> P[/Periksa Jejak Audit Anti-Curang<br/>/admin/logs/]
        O --> Q[Ekspor Laporan Resmi PDF & Excel]
    end
4. Transisi Status Pemilih (Voter State Machine)
Sesuai dengan desain antarmuka pada halaman /admin/voters, setiap baris pemilih pada DPT memiliki siklus status satu arah (unidirectional state transition):

Cuplikan kode
stateDiagram-v2
    [*] --> not_voted : Ditambahkan / Diimpor ke DPT ("Belum memilih")
    not_voted --> not_voted : Reset Token oleh Panitia
    not_voted --> logged_in : Pemilih Berhasil Login ("Sudah login")
    logged_in --> not_voted : Sesi Kedaluwarsa / Logout sebelum memilih
    logged_in --> logged_in : Reset Token oleh Panitia
    logged_in --> voted : Transaksi Submit Suara Sukses ("Sudah memilih")
    voted --> [*] : Terkunci Permanen (Token Hangus, Tidak Bisa Reset/Hapus)
