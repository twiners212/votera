# Customization & Multi-Election Guide — Votera

**Nama Aplikasi:** Votera  
**Versi Dokumen:** 1.0.0  
**Preset Bawaan:** Pemilihan Ketua OSIS (`PILKETOS 2026 — SMA Bojong Gede`)

---

## 1. Arsitektur Kustomisasi Tanpa Mengubah Kode (Zero-Code Rebranding)

Meskipun dikonfigurasi awal untuk **Pemilihan Ketua OSIS (PILKETOS)**, Votera dirancang agar dapat digunakan langsung oleh berbagai organisasi lain (**Ketua RT/RW, Kepala Desa, Karang Taruna, BEM/HMJ/UKM Kampus, Koperasi, Komunitas, Ketua Kelas, maupun Ikatan Alumni**) melalui perubahan konfigurasi di tabel `elections` dan `election_settings` tanpa perlu memodifikasi kode sumber komponen UI.

Seluruh teks judul, nama instansi, logo, gambar banner, hingga nama label pengelompokan pemilih di-render secara dinamis dari database melalui *Server Components* dan endpoint `/api/admin/settings`.

---

## 2. Matriks Pemetaan Istilah Antar-Instansi (Terminology Mapping)

Pada tabel `elections` dan `election_settings`, Anda dapat menyesuaikan 4 label utama pengelompokan DPT (`id_label`, `group_label`, `grade_label`, `major_label`) melalui menu **Panel Panitia -> Pengaturan (`/admin/settings`)**:

| Kolom Database | Default (PILKETOS SMA/SMK) | Kampus (BEM / HMJ / UKM) | Warga (RT / RW / Kades / Karang Taruna) | Organisasi / Koperasi / Komunitas / Alumni |
| :--- | :--- | :--- | :--- | :--- |
| `elections.short_name` | `PILKETOS 2026` | `PEMIRA BEM 2026` | `PILKADES / PEMILIHAN RW 05` | `RAT KOPERASI / MUNAS ALUMNI` |
| `elections.title` | `Pemilihan Ketua OSIS 2026` | `Pemilihan Raya Ketua BEM 2026` | `Pemilihan Ketua RW 05 Periode 2026–2029` | `Pemilihan Ketua Umum Komunitas 2026` |
| `elections.organization_name` | `SMA Bojong Gede` | `Universitas Nusantara` | `Kelurahan Bojong Gede` | `Koperasi Maju Bersama` |
| `election_settings.id_label` | **`NIS`** | **`NIM`** | **`NIK / No. KK`** | **`ID Anggota / NIA`** |
| `election_settings.group_label` | **`Rombel`** *(mis. Rombel 1)* | **`Kelas / Prodi`** *(mis. TI-A)* | **`RT`** *(mis. RT 01, RT 02)* | **`Cabang / Divisi`** *(mis. Cabang Jakarta)* |
| `election_settings.grade_label` | **`Tingkat`** *(mis. Kelas X, XI)* | **`Angkatan`** *(mis. 2023, 2024)* | **`RW / Dusun`** *(mis. Dusun I)* | **`Kategori / Angkatan`** *(mis. Reguler)* |
| `election_settings.major_label` | **`Jurusan`** *(mis. IPA, IPS)* | **`Fakultas`** *(mis. Teknik, FEB)* | **`Blok / Sektor`** *(mis. Blok A)* | **`Departemen / Wilayah`** *(mis. Korwil Barat)* |
| `candidates.class_or_unit` | `XI IPA` / `XI IPS` | `Teknik Informatika '23` | `Warga RT 03 / Blok B` | `Divisi Operasional / Angkatan 2018` |

### Dampak Perubahan Label pada Antarmuka UI:
1. **Halaman Login Pemilih (`/login`):**
   - Label input otomatis berubah dari `"NIS"` menjadi `"NIM"`, `"NIK"`, atau `"ID Anggota"`.
   - Placeholder otomatis mengikuti `id_label`: `"Masukkan [id_label] kamu"`.
2. **Halaman Manajemen DPT (`/admin/voters`) & Dashboard (`/admin/dashboard`):**
   - Header kolom tabel otomatis berubah dari `NIS | NAMA | KELAS` menjadi `[id_label] | NAMA | [group_label]`.
   - Dropdown filter 5 kolom otomatis menyesuaikan placeholder menjadi `Semua [group_label]`, `Semua [grade_label]`, dan `Semua [major_label]`.
   - Kartu progres di Dashboard otomatis berjudul `"Partisipasi per [group_label]"`.
3. **Template Impor CSV/XLSX:**
   - Saat panitia mengunduh template impor di modal **Import DPT**, header kolom otomatis menyesuaikan dengan label aktif (`id_identity`, `name`, `group_name`).

---

## 3. Cara Mengganti Logo, Banner & Identitas Visual

### 3.1. Mengganti Logo Instansi & Hero Banner (Melalui Panel Admin)
1. Masuk sebagai **Super Admin** ke halaman `/admin/settings`.
2. Pada bagian **Identitas & Branding Acara**:
   - **Logo Instansi (`logo_url`):** Unggah file PNG/WebP transparan (rasio 1:1, rekomendasi `128x128px`). Jika dikosongkan, sistem menampilkan `public/images/logo-default.png`.
   - **Hero Banner (`hero_banner_url`):** Unggah gambar ilustrasi/foto kegiatan (rasio 16:9 atau 21:9, rekomendasi `1200x500px`). Jika dikosongkan, sistem menampilkan ilustrasi default `public/images/hero-flag-ballot.jpg`.
3. Klik **Simpan Pengaturan**. Seluruh halaman publik (`/`, `/login`, `/candidates`, `/vote`, `/vote/thanks`) dan sidebar admin akan langsung memperbarui tampilan berkat invalidasi `queryKeys.election.settings(electionId)`.

### 3.2. Mengganti Warna Tema Utama (Primary Brand Color)
Secara default, Votera menggunakan warna utama **Crimson Red (`#D93829`)** yang bernuansa nasionalis/demokrasi Indonesia (sesuai `DESIGN_NOTES.md`). Jika organisasi Anda memiliki warna identitas berbeda (misalnya Biru Dongker untuk BEM Universitas atau Hijau Zamrud untuk Koperasi), Anda cukup mengubah variabel CSS di `src/app/globals.css`:

```css
/* Contoh Kustomisasi Tema di src/app/globals.css */
@layer base {
  :root {
    /* Preset A: Default Crimson Red (PILKETOS / Nasional) */
    --primary: 5 70% 51%;           /* #D93829 */
    --primary-hover: #B8281B;
    --bg-warm-tint: #FFF5F3;
    --accent: 7 100% 97%;           /* #FFF0EE */

    /* Preset B: Royal Civic Blue (Contoh untuk BEM Kampus / Korporat)
    --primary: 221 83% 53%;         /* #2563EB */
    --primary-hover: #1D4ED8;
    --bg-warm-tint: #F0F7FF;
    --accent: 214 100% 97%;         /* #EFF6FF */
    */

    /* Preset C: Emerald Trust (Contoh untuk Koperasi / Komunitas)
    --primary: 160 84% 39%;         /* #10B981 */
    --primary-hover: #059669;
    --bg-warm-tint: #F0FDF4;
    --accent: 152 81% 96%;          /* #ECFDF5 */
    */
  }
}
```

### 3.3. Warna Aksen Kartu Kandidat (`theme_color`)
Setiap kandidat yang ditambahkan di `/admin/candidates` dapat memilih 1 dari 4 warna aksen (`red`, `green`, `blue`, `amber`) untuk *outline mission pills* pada halaman `/candidates` agar pemilih mudah membedakan identitas visual antar-pasangan calon.

---

## 4. Menjalankan Beberapa Pemilihan (Multi-Election Operations)

Skema database Votera sudah dilengkapi kolom `election_id` pada seluruh tabel operasional (`election_settings`, `grade_levels`, `majors`, `voter_groups`, `candidates`, `voters`, `votes`, `audit_logs`). Terdapat **2 mode operasional** untuk menangani lebih dari satu pemilihan:

### Mode 1: Pergantian Pemilihan Berurutan / Tahunan (Active Election Switching)
Cocok untuk sekolah, kampus, atau RT/RW yang menyelenggarakan pemilihan secara berkala (misal: *PILKETOS 2026*, lalu tahun depan *PILKETOS 2027*) tanpa menghapus histori data tahun sebelumnya:

1. **Arsipkan Pemilihan Lama:**
   - Setelah *PILKETOS 2026* selesai dan laporan diunduh, Super Admin mengubah status pemilihan lama menjadi `archived` dan `is_active = false`.
   - Seluruh data suara, DPT, dan audit log tahun 2026 tetap tersimpan utuh di database sebagai arsip historis.
2. **Buat Pemilihan Baru:**
   - Super Admin membuat entri baru di tabel `elections` (misal: `slug: "pilketos-2027"`, `is_active: true`, `status: "draft"`).
   - Karena query aplikasi mengambil pemilihan dengan `WHERE is_active = true`, seluruh layar publik dan panel admin otomatis beralih ke konteks *PILKETOS 2027* yang bersih (`0 kandidat`, `0 pemilih`, `0 suara`).

### Mode 2: Beberapa Pemilihan Berbeda dalam Satu Instansi
Jika Anda ingin menyiapkan preset konfigurasi cepat melalui script seeding (`src/db/seed.ts`), Anda dapat mengubah objek konfigurasi preset di atas file `seed.ts`:

```typescript
// Contoh Mengubah Preset Awal di src/db/seed.ts
const ELECTION_PRESET = {
  slug: "pemilihan-rw05-2026",
  shortName: "PEMILU RW 05",
  title: "Pemilihan Ketua RW 05 Periode 2026–2029",
  organizationName: "Kelurahan Bojong Gede",
  settings: {
    idLabel: "NIK",
    groupLabel: "RT",
    gradeLabel: "Blok",
    majorLabel: "Sektor",
  },
  groups: ["RT 01", "RT 02", "RT 03", "RT 04", "RT 05", "RT 06"],
};
```

---

## 5. Checklist Kustomisasi Cepat (Quick Adaptation Checklist)

Saat mengadaptasi Votera untuk organisasi baru, ikuti 5 langkah berurutan ini dari Panel Super Admin:

1. **Ubah Identitas & Label (`/admin/settings`):**
   - Isi Nama Acara (`title`), Nama Singkat (`short_name`), Nama Instansi (`organization_name`), serta sesuaikan keempat label (`id_label`, `group_label`, `grade_label`, `major_label`).
2. **Isi Data Master Pengelompokan (`/admin/classes` & `/admin/majors`):**
   - Masukkan daftar Tingkat/Blok, Jurusan/Fakultas (jika digunakan), dan daftar Rombel/RT/Divisi (`voter_groups`).
3. **Tambahkan Kandidat (`/admin/candidates`):**
   - Unggah foto masing-masing calon, isi nama, unit/kelas asal, motto, visi, misi, program kerja, dan pendukung.
4. **Impor Daftar Pemilih Tetap (`/admin/voters`):**
   - Unduh template Excel/CSV terbaru, isi daftar anggota/warga/mahasiswa sesuai nama kelompok yang sudah dibuat pada langkah 2, lalu unggah ke sistem.
5. **Atur Jadwal Buka-Tutup (`/admin/settings`):**
   - Tentukan tanggal/jam `start_at` dan `end_at`, pastikan kartu **Kesiapan pemilihan** di `/admin/dashboard` berstatus **Siap**, lalu ubah status pemilihan menjadi `open`.
