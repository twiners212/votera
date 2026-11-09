# Product Requirements Document (PRD) — Votera

**Nama Aplikasi:** Votera (Platform E-Voting & Pemilihan Online Multi-Instansi)  
** Kasus Penggunaan Awal (Default Preset):** Pemilihan Ketua OSIS (PILKETOS 2026 - SMA Bojong Gede)  
**Versi Dokumen:** 1.0.0  
**Status:** Approved for Development  

---

## 1. Tujuan Produk (Product Objectives)

Votera adalah platform pemungutan suara elektronik (*e-voting*) berbasis web yang dirancang untuk menyelenggarakan pemilihan secara jujur, rahasia, transparan, dan bebas kecurangan. 

Meskipun dikonfigurasi awal untuk **Pemilihan Ketua OSIS (PILKETOS)**, arsitektur Votera dibangun secara *multi-election* dan *white-label* sehingga dapat dikustomisasi dengan mudah tanpa mengubah kode inti untuk:
- Pemilihan Ketua & Pengurus OSIS / MPK (SMP/SMA/SMK)
- Pemilihan Ketua BEM / HMJ / UKM Kampus
- Pemilihan Ketua RT / RW / Kepala Desa (Kades) / Karang Taruna
- Pemilihan Ketua Koperasi, Komunitas, Ikatan Alumni, atau Ketua Kelas

### Tujuan Utama:
1. **Integritas & Kerahasiaan Suara (1 Orang 1 Suara):** Menjamin setiap pemilih terdaftar (DPT) hanya dapat memberikan satu suara secara sah melalui transaksi atomik di database, serta memisahkan identitas pemilih dari pilihan suaranya (*ballot secrecy*).
2. **Efisiensi Operasional Panitia:** Memangkas waktu administrasi panitia melalui fitur impor DPT massal (CSV/XLSX), pembuatan & pengelolaan token otomatis, serta rekapitulasi suara secara *real-time*.
3. **Transparansi & Auditabilitas:** Menyediakan rekam jejak aktivitas (*append-only audit logs*) untuk setiap aksi krusial (login, pemungutan suara, perubahan jadwal, reset token) tanpa membocorkan rahasia pilihan pemilih.
4. **Kemudahan Akses & Responsivitas:** Antarmuka pemilih yang ringan, intuitif, dan optimal diakses dari perangkat mobile (HP siswa/warga) maupun laptop/komputer bilik suara.

---

## 2. Target Pengguna & Persona

Sistem membagi pengguna ke dalam **3 Persona Utama** dengan pemisahan hak akses dan konteks sesi yang tegas:

### 2.1. Pemilih (Voter)
- **Profil:** Siswa (untuk PILKETOS), mahasiswa, warga RT/RW, atau anggota organisasi yang terdaftar di Daftar Pemilih Tetap (DPT).
- **Perangkat Utama:** Smartphone (Mobile Browser) atau PC/Tablet di bilik suara (TPS Digital).
- **Kebutuhan:**
  - Melihat profil, visi, misi, dan program kerja kandidat sebelum memilih.
  - Login cepat menggunakan Nomor Induk (NIS/NIM/NIK/ID Anggota) dan Token unik dari panitia.
  - Memberikan suara dengan mudah, mendapatkan kepastian bahwa suara telah tercatat, dan yakin pilihannya rahasia.
- **Batasan:** Hanya bisa memilih 1 kali pada jadwal yang aktif; tidak bisa mengubah pilihan setelah dikirim; tidak bisa melihat hasil sementara selama pemungutan suara berlangsung.

### 2.2. Panitia (Committee / Operator Admin)
- **Profil:** Pengurus MPK/OSIS, panitia pemilihan (KPU Kampus/Panitia RT), atau guru/staf pendamping yang bertugas di lapangan.
- **Perangkat Utama:** Laptop / Desktop PC.
- **Kebutuhan:**
  - Mengelola data DPT (tambah manual, edit, impor CSV/XLSX, filter per kelas/rombel/wilayah).
  - Membagikan/menyalin token pemilih dan melakukan *reset token* bagi pemilih yang lupa/kehilangan token (selama belum memilih).
  - Memantau tingkat partisipasi per kelompok (Rombel/Kelas/Jurusan) secara *real-time*.
- **Batasan:** Tidak dapat menghapus atau memanipulasi log aktivitas; tidak dapat menambah/menghapus akun Super Admin lain.

### 2.3. Super Admin (Ketua Panitia / Pembina / System Owner)
- **Profil:** Pembina OSIS, Ketua KPU Pemilihan, atau Administrator IT penyelenggara.
- **Perangkat Utama:** Laptop / Desktop PC.
- **Kebutuhan:**
  - Mengatur konfigurasi pemilihan (nama instansi, jadwal buka-tutup pemungutan suara, visibilitas hasil).
  - Mengelola data Master (Tingkat Kelas/Kategori, Jurusan/Unit, Rombel/Wilayah) dan data Kandidat (foto, visi, misi, program, pendukung).
  - Mengelola akun panitia (*multi-admin*), memantau *Log Aktivitas* keamanan, serta mengunduh laporan resmi hasil pemilihan (PDF & Excel).

---

## 3. Daftar Fitur & Prioritas (MVP vs Fase Berikutnya)

### 3.1. Fitur Wajib MVP (Fase 1 — Cakupan Dokumen Ini)

| Modul | Fitur | Prioritas | Deskripsi Singkat |
| :--- | :--- | :---: | :--- |
| **Publik & Info** | Beranda Pemilihan & Daftar Kandidat | **P0 (MVP)** | Menampilkan status pemungutan suara (Dibuka/Ditutup), jumlah calon terdaftar, daftar kartu kandidat beserta misi singkat, dan halaman detail profil/visi/misi kandidat. |
| **Autentikasi** | Login Pemilih (NIS/ID + Token) | **P0 (MVP)** | Login menggunakan nomor identitas (NIS) dan token alfanumerik unik 8 karakter disertai *rate limiting* dan proteksi *brute-force*. |
| **Autentikasi** | Login Panel Panitia (Multi-Admin) | **P0 (MVP)** | Login terpisah untuk `super_admin` dan `committee` menggunakan username/email & password berbasis sesi aman Better Auth. |
| **E-Voting** | Surat Suara Digital Atomik | **P0 (MVP)** | Antarmuka pemilihan kandidat dengan modal konfirmasi, penyimpanan suara tanpa identitas pemilih (*unlinkable ballot*), jaminan 1 orang 1 suara via transaksi database, dan layar bukti terima kasih (`/vote/thanks`). |
| **Manajemen Kandidat** | CRUD Kandidat & Upload Foto | **P0 (MVP)** | Tambah, ubah, hapus, dan aktif/nonaktifkan kandidat beserta nomor urut, kelas/unit, motto, visi, daftar misi, program kerja, pendukung, dan upload foto ke Cloud Storage. |
| **Manajemen DPT** | CRUD, Filter & Impor Massal DPT | **P0 (MVP)** | Tambah/edit/hapus pemilih, impor massal via CSV (PapaParse) & XLSX (SheetJS) dengan validasi per baris dan laporan baris gagal. Pencarian & filter berdasarkan Status (`Belum memilih`, `Sudah login`, `Sudah memilih`), Rombel, Tingkat, dan Jurusan. |
| **Manajemen Token** | Salin Token & Reset Token | **P0 (MVP)** | Fitur salin token dari tabel DPT, generate token massal, dan *reset token* untuk pemilih yang statusnya belum memilih. |
| **Data Master** | Manajemen Kelas, Tingkat & Jurusan | **P0 (MVP)** | Pengelolaan entitas pengelompokan pemilih (fleksibel: Kelas/Rombel/Jurusan untuk sekolah, atau RT/RW/Divisi untuk umum). |
| **Penjadwalan** | Pengaturan Jadwal & Identitas Pemilihan | **P0 (MVP)** | Pengaturan waktu mulai & selesai pemungutan suara (divalidasi ketat di server), nama instansi/sekolah, dan checklist kesiapan pemilihan otomatis di dashboard. |
| **Monitoring & Hasil** | Real-Time Dashboard & Hasil (Polling) | **P0 (MVP)** | Ringkasan KPI (Total DPT, Suara Masuk, Belum Memilih, % Partisipasi), tabel partisipasi per kelas/rombel, dan perolehan suara kandidat secara *real-time* via *client polling* (5–10 detik, default 8 detik) ke endpoint agregat ter-cache. |
| **Laporan** | Ekspor Laporan PDF & Excel | **P0 (MVP)** | Unduh berita acara / laporan hasil perolehan suara dan rekapitulasi partisipasi per kelas dalam format PDF dan XLSX. |
| **Keamanan & Audit** | Log Aktivitas (*Append-Only*) | **P0 (MVP)** | Pencatatan seluruh aktivitas panitia dan pemilih (`admin_login`, `voter_login`, `vote_cast`, `voter_logout`, `token_reset`, dll.) beserta waktu dan IP address, bersifat *read-only* dengan filter pencarian. |

### 3.2. Fitur Fase Berikutnya (Post-MVP / Future Enhancements)
*Fitur di bawah ini TIDAK dikerjakan pada iterasi MVP saat ini, namun arsitektur telah disiapkan agar mudah diekstensi:*
1. **Upgrade Real-Time via SSE / Pusher / Ably:** Menggantikan mekanisme *HTTP Polling* pada layar hasil pemilihan jika skala pemilihan mencapai puluhan ribu pemilih serentak.
2. **Cetak Kartu Pemilih Massal (PDF QR Code):** Mencetak kartu fisik berisi NIS dan Token (atau QR Code auto-fill) dalam layout grid siap potong untuk dibagikan di kelas/TPS.
3. **Distribusi Token Otomatis via WhatsApp / Email:** Integrasi gateway pesan untuk mengirimkan token langsung ke nomor/email pemilih.
4. **Mode Kiosk / Bilik Suara Terkunci:** Mode khusus untuk tablet/PC di TPS fisik yang otomatis me-logout pemilih dalam 3 detik setelah halaman `/vote/thanks` tampil dan kembali ke layar login.
5. **Dukungan Multi-Kategori Pemilihan Serentak:** Memungkinkan 1 kali login pemilih untuk mencoblos lebih dari 1 surat suara sekaligus (misal: Surat Suara Ketua OSIS + Surat Suara Ketua MPK).

---

## 4. Di Luar Cakupan (Out of Scope)

Untuk menjaga fokus, keamanan, dan kecepatan pengembangan MVP, hal-hal berikut secara eksplisit **berada di luar cakupan**:
1. **Autentikasi Biometrik / E-KTP Reader:** Tidak ada verifikasi pengenalan wajah (*face recognition*) atau pemindaian sidik jari perangkat keras.
2. **Blockchain / Smart Contract Voting:** Penyimpanan suara menggunakan PostgreSQL transaksional (Neon) dengan pemisahan tabel dan *append-only audit log*, bukan jaringan blockchain.
3. **Pendaftaran Pemilih Mandiri (*Self-Registration*):** Pemilih tidak dapat mendaftar akun sendiri; seluruh data DPT wajib diinput atau diimpor oleh Panitia untuk mencegah pemilih fiktif.
4. **Aplikasi Mobile Native (iOS/Android APK):** Aplikasi diakses sepenuhnya melalui browser web modern (responsif untuk layar HP dan Desktop).
5. **Kampanye Interaktif / Kolom Komentar:** Tidak ada fitur *live chat*, komentar, atau *like* pada halaman profil kandidat.

---

## 5. Metrik Keberhasilan (Success Metrics)

Keberhasilan teknis dan operasional Votera diukur menggunakan parameter berikut:
1. **Zero Double-Voting (0% Duplikasi Suara):** Tidak ada satu pun pemilih yang berhasil mengirimkan lebih dari 1 suara meskipun dilakukan pengiriman paralel (*concurrent race-condition requests*).
2. **100% Anonimitas Suara (*Ballot Secrecy*):** Bahkan dengan akses penuh ke database produksi (`SELECT * FROM votes`), administrator database tidak dapat menghubungkan baris suara tertentu dengan `voter_id` atau `nis` pemilih.
3. **Kinerja & Beban Database Terjaga saat Polling:** Endpoint agregasi hasil dan dashboard memiliki waktu respons rata-rata `< 150ms` berkat *server-side caching* (revalidate 3–5 detik), sehingga konsumsi *compute unit* Neon tetap minimal meski puluhan panitia membuka layar hasil bersamaan.
4. **Kecepatan Proses Memilih (`Time-to-Vote`):** Waktu rata-rata pemilih sejak memasukkan NIS + Token hingga mencapai layar `/vote/thanks` kurang dari **45 detik**.
5. **Keandalan Impor DPT:** Proses impor file CSV/XLSX berisi hingga 2.000 baris pemilih selesai diproses, divalidasi, dan disimpan ke database dalam waktu `< 10 detik` dengan laporan baris error yang akurat.
