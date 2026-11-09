# Design System & UI/UX Specification — Aplikasi E-Voting (PILKETOS / Pemilihan Umum Digital)

Dokumen ini adalah acuan tunggal (*Single Source of Truth*) bagi Frontend Developer, UI/UX Designer, dan AI Coding Agent untuk membangun ulang, memelihara, dan mengembangkan antarmuka aplikasi **E-Voting / Pemilihan Online** yang konsisten, aman, dan aksesibel di perangkat mobile maupun desktop.

---

## 1. Overview & Design Principles

### Karakter Visual & Kesan yang Dibangun
Aplikasi mengusung karakter visual **Civic-Modern, Bersih, Formal-Ramah, dan Terpercaya (*High-Trust Institutional UI*)**. Penggunaan aksen **Merah Nasional (`Crimson/garnet Red`)** yang dipadukan dengan latar belakang putih bersih serta *warm gray/off-white* memberikan nuansa resmi layaknya pemungutan suara negara/institusi, namun tetap terasa ringan, modern, dan mudah digunakan oleh segala usia (siswa, mahasiswa, warga RT/RW, hingga anggota koperasi/organisasi).

### Prinsip Desain Utama
1. **Clarity Over Complexity (Kejelasan di Atas Kerumitan):** Setiap layar memiliki satu fokus utama. Pemilih tidak boleh bingung mencari tombol pilih atau cara melihat visi-misi kandidat.
2. **One Person, One Vote Integrity (Integritas Satu Suara):** Antarmuka secara visual menegaskan bahwa pilihan bersifat rahasia, final, dan hanya dapat dikirim satu kali melalui indikator status yang tegas dan *sticky confirmation bar*.
3. **Radical Transparency for Committee (Transparansi penuh untuk Panitia):** Panel admin dirancang berbasis metrik yang jujur—dilengkapi log aktivitas *read-only* yang mencatat waktu, pelaku, aksi, dan alamat IP secara *real-time*.
4. **Mobile-First Voter, Desktop-First Admin:** Antarmuka pemilih (*voter*) dioptimalkan untuk layar smartphone dengan area sentuh (*tap target*) yang besar dan nyaman dioperasikan satu tangan, sementara panel panitia (*admin*) dioptimalkan untuk layar desktop dengan tabel padat informasi dan multi-filter.
5. **White-Label Ready (Mudah Dikustomisasi):** Seluruh identitas visual bertumpu pada *design tokens* terpusat sehingga tema warna merah-putih (OSIS/Nasional) dapat dengan mudah diganti untuk kebutuhan BEM, Kades, Koperasi, atau Komunitas tanpa merombak struktur komponen.

---

## 2. Color Palette

Seluruh warna diekstrak langsung dari tangkapan layar aplikasi. Warna utama menggunakan spektrum merah tegas (*Civic Red*), dipadukan dengan permukaan netral hangat (*Warm Surface*) dan warna semantik yang kontras.

### 2.1 Light Mode Tokens (Default — Terlihat di Gambar)

| Token Name | Nilai HEX | Fungsi & Penggunaan pada UI |
| :--- | :--- | :--- |
| **Primary & Brand** | | |
| `--color-primary-50` | `#FEF2F2` `(estimasi)` | Background menu sidebar aktif, background badge nomor kandidat di tabel, avatar inisial |
| `--color-primary-100` | `#FCE8E6` `(estimasi)` | Background lingkaran ikon statistik merah, avatar profil pengguna (`P`, `S`), tombol hapus |
| `--color-primary-200` | `#FECACA` `(estimasi)` | Border tombol sekunder merah, border tombol hapus (`Hapus`), border kartu terpilih |
| `--color-primary-500` | `#D6362C` `(estimasi)` | Warna aksen teks utama (`OSIS 2026`, `Calon Ketua`), badge nomor urut (`#1`), tombol utama |
| `--color-primary-600` | `#C8322B` `(estimasi)` | Background tombol utama (*Primary CTA*), progress bar suara unggul, footer gelombang merah |
| `--color-primary-700` | `#B0251E` `(estimasi)` | State `:hover` dan `:active` pada tombol utama, gradien gelap pada banner login mobile |
| **Secondary & Candidate Accents** | | |
| `--color-accent-gold` | `#FDE047` `(estimasi)` | Teks aksen `OSIS 2026` di atas background hero merah gelap pada halaman Login Pemilih |
| `--color-candidate-1` | `#B9382C` `(estimasi)` | Border & teks kapsul program kerja Kandidat #1 (Merah Terakota) |
| `--color-candidate-2` | `#1F6E58` `(estimasi)` | Border & teks kapsul program kerja Kandidat #2 (Hijau Emerald/Hutan) |
| `--color-candidate-3` | `#1D5B9E` `(estimasi)` | Border & teks kapsul program kerja Kandidat #3 (Biru Kobalt) |
| `--color-candidate-4` | `#7E22CE` `(rekomendasi)` | Border & teks kapsul program kerja Kandidat #4 (Ungu Royal) |
| **Background & Surface** | | |
| `--color-bg-canvas` | `#FAF9F7` `(estimasi)` | Background utama halaman belakang (*canvas*) pada Panel Admin dan area bawah Hero |
| `--color-bg-subtle` | `#FDF8F6` `(estimasi)` | Background header halaman profil kandidat & header tabel (`thead`) bernuansa hangat |
| `--color-surface` | `#FFFFFF` | Background kartu (*card*), sidebar, navbar, tabel, modal, dan input form |
| `--color-surface-muted` | `#F8FAFC` `(estimasi)` | Background pill kode token (`JUFT88TF`), badge IP (`::1`), dan track progress bar kosong |
| **Border & Divider** | | |
| `--color-border-subtle` | `#F1F5F9` `(estimasi)` | Garis pemisah antar baris tabel (`tr`), divider horizontal di dalam kartu |
| `--color-border-default` | `#E2E8F0` `(estimasi)` | Border standar untuk semua kartu, input form, tombol sekunder, dan sidebar |
| `--color-border-strong` | `#CBD5E1` `(estimasi)` | State `:hover` pada border input dan tombol sekunder |
| **Text & Typography** | | |
| `--color-text-primary` | `#0F172A` `(estimasi)` | Judul utama (H1–H4), nama kandidat, angka statistik besar, teks isi tabel utama |
| `--color-text-secondary` | `#64748B` `(estimasi)` | Subjudul, deskripsi, motto kandidat, label kolom tabel, keterangan waktu |
| `--color-text-muted` | `#94A3B8` `(estimasi)` | Placeholder input (`Masukkan NIS kamu`), ikon di dalam input, teks non-aktif |
| `--color-text-on-primary`| `#FFFFFF` | Teks dan ikon di atas tombol merah utama serta di atas hero/footer merah |
| **Status & Semantic** | | |
| `--color-success-bg` | `#ECFDF5` `(estimasi)` | Background badge `Pemungutan suara dibuka`, `Aktif`, `Sudah memilih`, `Siap`, `Pemilih` |
| `--color-success-border`| `#A7F3D0` `(estimasi)` | Border pada pill status `Dibuka` di navbar |
| `--color-success-text` | `#047857` `(estimasi)` | Teks pada badge status hijau |
| `--color-success-solid` | `#1F7A4C` `(estimasi)` | Lingkaran ikon centang besar pada halaman `Suara Tercatat` (`/vote/thanks`) & titik indikator |
| `--color-warning-bg` | `#FEF3C7` `(estimasi)` | Background badge status `Sudah login` pada tabel DPT & lingkaran ikon statistik Partisipasi |
| `--color-warning-text` | `#B45309` `(estimasi)` | Teks pada badge `Sudah login` dan ikon grafik partisipasi |
| `--color-danger-bg` | `#FEF2F2` `(estimasi)` | Background tombol `Hapus` dan alert error |
| `--color-danger-border` | `#FECACA` `(estimasi)` | Border tombol `Hapus` |
| `--color-danger-text` | `#DC2626` `(estimasi)` | Teks tombol `Hapus`, label `Hasil sementara`, dan pesan validasi error |
| `--color-info-bg` | `#EFF6FF` `(estimasi)` | Background lingkaran ikon `Total pemilih (DPT)` pada Dashboard Admin |
| `--color-info-text` | `#2563EB` `(estimasi)` | Warna ikon biru pada statistik `Total pemilih (DPT)` |

### 2.2 Dark Mode Tokens `(rekomendasi)`
Untuk mendukung penggunaan malam hari atau preferensi sistem pengguna, gunakan pemetaan berikut:

| Token Name | Nilai HEX (Dark Mode) | Catatan Adaptasi |
| :--- | :--- | :--- |
| `--color-bg-canvas` | `#0B0F19` | Menggantikan `#FAF9F7` sebagai latar utama |
| `--color-surface` | `#111827` | Menggantikan `#FFFFFF` untuk kartu, sidebar, dan tabel |
| `--color-surface-muted` | `#1E293B` | Untuk pill token, badge IP, dan track progress bar |
| `--color-border-default` | `#1F2937` | Border kartu dan pemisah tabel agar tidak terlalu menyilaukan |
| `--color-text-primary` | `#F8FAFC` | Teks utama putih lembut |
| `--color-text-secondary` | `#94A3B8` | Teks sekunder abu-abu terang |
| `--color-primary-500` | `#EF4444` | Sedikit lebih terang agar kontras di atas `#111827` tetap memenuhi WCAG AA |
| `--color-primary-600` | `#DC2626` | Warna tombol utama pada mode gelap |

---

## 3. Typography

Berdasarkan karakteristik huruf (bentuk huruf `a` dua tingkat, `g` satu tingkat terbuka, angka `2`, `4`, `6` yang geometris dan tegas), aplikasi ini menggunakan keluarga font sans-serif modern **Plus Jakarta Sans** atau **Inter**.

### 3.1 Font Family
- **Primary Font (`--font-sans`):** `'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` `(estimasi)`
- **Monospace Font (`--font-mono`):** `'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` (digunakan pada kolom `TOKEN` seperti `JUFT88TF`, slug aksi `vote_cast`, dan alamat IP `::1`).

### 3.2 Typographic Scale & Hierarchy

| Elemen / Token | Ukuran (`px` / `rem`) | Font Weight | Line Height | Letter Spacing | Penggunaan pada Layar |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display / Hero H1** | `36px` (`2.25rem`) desktop / `30px` (`1.875rem`) mobile | `800` (ExtraBold) | `1.15` | `-0.025em` | Judul `Pemilihan Ketua OSIS 2026`, `Pilih Satu Calon Ketua`, `Terima kasih, Putri Ayu Lestari!` |
| **H1 (Page Title)** | `24px` (`1.5rem`) | `700` (Bold) | `1.25` | `-0.02em` | `Halo, Super Admin`, `Masuk untuk memilih`, Nama Kandidat di halaman profil (`Raka Aditya Pratama`) |
| **H2 (Section Title)** | `18px` (`1.125rem`) | `700` (Bold) | `1.35` | `-0.015em` | Nama kandidat di kartu (`Raka Aditya Pratama`), judul bagian `Visi`, `Perolehan suara`, header topbar (`Dashboard`, `Pemilih (DPT)`) |
| **H3 (Card Title)** | `16px` (`1rem`) | `700` (Bold) | `1.4` | `-0.01em` | `Partisipasi per kelas`, `Kesiapan pemilihan`, `Catatan aktivitas`, `Daftar pemilih` |
| **Stat Value (XL)** | `28px` (`1.75rem`) | `800` (ExtraBold) | `1.1` | `-0.02em` | Angka metrik utama di kartu statistik (`76`, `2`, `2,6%`, `21`, `4`) |
| **Body Large** | `16px` (`1rem`) | `400` (Regular) | `1.6` | `0em` | Paragraf pembuka di halaman beranda, teks Visi kandidat, subjudul halaman terima kasih |
| **Body Default** | `14px` (`0.875rem`) | `400` / `500` | `1.5` | `0em` | Teks sel tabel, deskripsi halaman admin, motto kandidat, item checklist kesiapan |
| **Label / Button** | `14px` (`0.875rem`) | `600` (SemiBold) | `1.25` | `0em` | Label input form (`NIS`, `Token`, `Cari pemilih`), teks tombol utama & sekunder, menu sidebar |
| **Caption / Subtext** | `12px` (`0.75rem`) | `400` / `500` | `1.4` | `0em` | Subteks di bawah angka statistik (`Total pemilih (DPT)`), waktu memilih, teks `Menampilkan 1–25 dari 76` |
| **Eyebrow / Table Header** | `11px–12px` (`0.75rem`) | `700` (Bold) | `1.2` | `0.06em` (Uppercase) | `PEMILIHAN RESMI — SATU ORANG, SATU SUARA`, `SURAT SUARA`, `SUARA TERCATAT`, header grup sidebar (`UTAMA`, `PEMILIHAN`), header kolom tabel (`WAKTU`, `PELAKU`, `AKSI`) |

---

## 4. Spacing, Grid & Layout

### 4.1 Spacing Scale (8pt Grid dengan Sub-grid 4pt)
Aplikasi menerapkan sistem spasi kelipatan `4px`:
- `space-1` (`4px`): Jarak antara judul dan subjudul kecil di dalam sel tabel (`Putri Ayu Lestari` dengan badge `Pemilih NIS 2324004`).
- `space-2` (`8px`): Jarak antar tombol aksi di dalam tabel (`Edit`, `Reset token`, `Hapus`), jarak ikon dengan teks di dalam badge/tombol.
- `space-3` (`12px`): Padding vertikal input/tombol, jarak antar kapsul program kandidat di tampilan mobile.
- `space-4` (`16px`): Padding standar kartu mobile, jarak antar kartu pada grid statistik (`gap-4`).
- `space-5` (`20px`): Padding dalam (*internal padding*) kartu statistik dan kartu hasil pemilihan (`p-5`).
- `space-6` (`24px`): Padding konten utama admin, jarak antar blok seksi vertikal (`space-y-6`).
- `space-8` (`32px`): Padding horizontal kontainer desktop, jarak pemisah seksi besar.

### 4.2 Struktur Layout Halaman

#### A. Layout Panel Admin / Panitia (Desktop-First)
- **Sidebar Kiri Tetap (`Fixed Sidebar`):** Lebar `240px` (`15rem`), tinggi `100vh`, `border-right: 1px solid #E2E8F0`, terdiri dari:
  - Header Brand (`height: 64px`, padding `16px 20px`).
  - Area Navigasi Scrollable dengan pengelompokan kategori (`UTAMA`, `PEMILIHAN`, `DATA MASTER`, `SISTEM`).
  - Footer Sidebar tetap di bagian bawah untuk tombol `Keluar`.
- **Area Utama (`Main Wrapper`):** Mengisi sisa layar (`calc(100vw - 240px)`), background `#FAF9F7`.
  - **Topbar Header:** Tinggi `64px`, background `#FFFFFF`, `border-bottom: 1px solid #E2E8F0`, padding `0 28px`, menampilkan judul halaman aktif di kiri dan profil admin (`Super Admin`) di kanan.
  - **Content Container:** Lebar penuh (`max-width: 1440px`), padding `24px 28px`, semua blok disusun vertikal dengan jarak `20px–24px`.

#### B. Layout Pemilih / Publik (Responsive Mobile & Desktop)
- **Top Navbar:** Tinggi `64px`, sticky di atas (`top: 0`), background `#FFFFFF`, `border-bottom: 1px solid #E2E8F0`.
- **Hero Section:** Lebar penuh (`100%`), tinggi menyesuaikan konten (`220px–320px`), menampilkan latar ilustrasi bendera Merah Putih dan kotak suara di sisi kanan dengan efek *fade-out gradient* ke warna putih/krem di sisi kiri (desktop) atau bawah (mobile).
- **Content Area:**
  - Pada Desktop (Surat Suara): `max-width: 1200px`, terpusat (`mx-auto`), `padding: 32px 24px`, menampilkan grid 4 kolom (`grid-template-columns: repeat(4, minmax(0, 1fr))`).
  - Pada Mobile (Beranda, Daftar Kandidat, Profil): `max-width: 480px` (atau `100%` di viewport ponsel), padding horizontal `16px`.

### 4.3 Responsive Breakpoints
- **Mobile (`< 640px` / `sm`):** 1 kolom penuh. Kartu kandidat di beranda menggunakan tata letak horizontal split (foto di kiri `36%`, info & misi di kanan `64%`). Tombol CTA bertumpuk vertikal (`w-full`).
- **Tablet (`640px – 1024px` / `md–lg`):** Grid kartu kandidat dan kartu statistik berubah menjadi 2 kolom (`grid-cols-2`). Sidebar admin berubah menjadi *off-canvas drawer* dengan tombol hamburger `(rekomendasi)`.
- **Desktop (`> 1024px` / `xl`):** Grid kartu surat suara dan kartu statistik menjadi 4 kolom (`grid-cols-4`). Tabel ditampilkan utuh dengan aksi horizontal.

---

## 5. Shape & Elevation

### 5.1 Border Radius
- `--radius-xs` (`6px`): Badge pangkat/role kecil di dalam tabel (`Panitia`, `Pemilih`), badge kode IP (`::1`), checkbox.
- `--radius-sm` (`8px`): Tombol aksi kecil di dalam tabel (`Edit`, `Reset token`, `Hapus`), badge token (`JUFT88TF`), badge nomor urut di sudut foto (`#1`).
- `--radius-md` (`12px`): Standar utama untuk tombol (`Masuk`, `Kirim suara`, `+ Tambah pemilih`), input form, select dropdown, dan item menu sidebar.
- `--radius-lg` (`16px`): Standar utama untuk seluruh Kartu (*Card*), seperti kartu kandidat, kartu statistik, kartu tabel, dan kartu filter.
- `--radius-xl` (`24px`): Sudut atas *bottom-sheet card* pada halaman Login Pemilih mobile (`border-radius: 24px 24px 0 0` atau `24px` menyeluruh).
- `--radius-full` (`9999px`): Badge status kapsul (`● Dibuka`, `● Aktif`, `● Sudah memilih`), avatar lingkaran (`P`, `S`), indikator radio pilih kandidat, dan kapsul misi kandidat.

### 5.2 Border Width
- **Default Card & Input Border:** `1px solid var(--color-border-default)` (`#E2E8F0`).
- **Candidate Mission Pill Border:** `1px solid` sesuai warna aksen masing-masing kandidat (`#B9382C`, `#1F6E58`, `#1D5B9E`).
- **Selected Card / Active Result Card Border:** `1.5px` hingga `2px solid var(--color-primary-500)` (`#D6362C`).

### 5.3 Shadows & Elevation
Desain ini mengutamakan pendekatan **Flat-Bordered Surface** dengan bayangan yang sangat lembut (*low-contrast diffused shadow*):
- `--shadow-xs`: `0 1px 2px 0 rgba(15, 23, 42, 0.03)` — Digunakan pada kartu statistik, kartu tabel, dan tombol sekunder putih.
- `--shadow-sm`: `0 4px 12px -2px rgba(15, 23, 42, 0.06)` — Digunakan pada kartu kandidat dan floating card di halaman login.
- `--shadow-primary`: `0 6px 16px -4px rgba(200, 50, 43, 0.35)` — Bayangan berwarna merah lembut di bawah tombol utama (`Masuk untuk memilih`, `Masuk`, `Kirim suara`).
- `--shadow-sticky-bar`: `0 -4px 16px -4px rgba(15, 23, 42, 0.08)` — Bayangan ke arah atas pada *sticky bottom bar* di halaman Surat Suara.

### 5.4 Gradients & Visual Effects
- **Hero Image Masking Gradient (Desktop):** `linear-gradient(90deg, #FFFFFF 35%, rgba(255, 255, 255, 0.85) 55%, rgba(255, 255, 255, 0) 100%)` di atas foto latar bendera dan kotak suara agar teks judul di sebelah kiri tetap terbaca sempurna.
- **Hero Image Masking Gradient (Mobile):** `linear-gradient(180deg, rgba(253, 248, 246, 0) 50%, #FDF8F6 100%)`.
- **Login Hero Red Overlay:** `linear-gradient(135deg, rgba(168, 32, 26, 0.92) 0%, rgba(214, 54, 44, 0.85) 100%)` melapisi foto latar belakang.

---

## 6. Komponen UI

### 6.1 Button (Tombol)

#### A. Primary Button (`btn-primary`)
- **Tampilan:** Background merah solid (`#C8322B` / `#D6362C`), teks putih (`#FFFFFF`), `font-weight: 600`, `border-radius: 12px`, `shadow-primary`.
- **Ukuran:**
  - *Large (Mobile CTA / Login):* Tinggi `48px` (`h-12`), padding `0 24px`, `font-size: 15px`, lebar penuh (`w-full`).
  - *Default (Admin Header / Sticky Bar):* Tinggi `40px` (`h-10`), padding `0 18px`, `font-size: 14px`.
- **States:**
  - *Default:* Background `#C8322B`, teks `#FFFFFF`.
  - *Hover:* Background `#B0251E`, translasi `translateY(-1px)` `(rekomendasi)`.
  - *Active:* Background `#991B1B`, translasi `translateY(0)`.
  - *Focus:* Outline ring `0 0 0 3px rgba(214, 54, 44, 0.25)`.
  - *Disabled:* Background `#FDA4AF` atau `#E2E8F0`, teks `#94A3B8`, `cursor: not-allowed`, tanpa bayangan (digunakan pada tombol `Kirim suara` saat belum ada kandidat yang diketuk) `(rekomendasi)`.

#### B. Secondary Outlined Brand Button (`btn-secondary-brand`)
- **Contoh:** Tombol `Masuk sebagai panitia` di beranda.
- **Tampilan:** Background `#FFFFFF`, border `1px solid #E11D48` (atau `#D6362C`), teks & ikon merah `#C8322B`, tinggi `48px`, `border-radius: 12px`.
- **States:** *Hover* mengubah background menjadi `#FEF2F2`.

#### C. Neutral Secondary Button (`btn-secondary`)
- **Contoh:** Tombol `Lihat Profil →`, `Lihat kandidat`, `Lihat beranda`, `Import DPT`, `Segarkan`, serta tombol tabel `Edit` dan `Reset token`.
- **Tampilan:** Background `#FFFFFF`, border `1px solid #E2E8F0`, teks `#0F172A`, `font-weight: 600`.
- **Ukuran:**
  - *Default:* Tinggi `40px`, padding `0 16px`, `border-radius: 12px`.
  - *Small (Table Action):* Tinggi `32px`, padding `0 12px`, `font-size: 12px`, `border-radius: 8px`.
- **States:** *Hover* mengubah background ke `#F8FAFC` dan border ke `#CBD5E1`.

#### D. Soft Danger Button (`btn-danger-soft`)
- **Contoh:** Tombol `Hapus` di tabel Kandidat dan tabel DPT.
- **Tampilan:** Background `#FEF2F2`, border `1px solid #FECACA`, teks `#DC2626`, tinggi `32px`, padding `0 12px`, `font-size: 12px`, `font-weight: 600`, `border-radius: 8px`.
- **States:** *Hover* mengubah background menjadi `#FEE2E2` dan border menjadi `#FCA5A5`.

#### E. Ghost / Link Button (`btn-ghost`)
- **Contoh:** `← Semua kandidat`, `← Kembali ke beranda`, `Kelola pemilih`, `Semua log`, `Salin`.
- **Tampilan:** Tanpa background dan border. Teks berwarna merah `#C8322B` (untuk aksi admin seperti `Salin`, `Kelola pemilih`, `Semua log`) atau abu-abu/hitam (untuk navigasi kembali), `font-weight: 600`.

---

### 6.2 Input & Form Controls

- **Struktur:** Label berada di atas input (`margin-bottom: 6px`, `font-size: 13px`, `font-weight: 600`, warna `#0F172A`).
- **Text & Password/Token Input:**
  - Tinggi `44px` (admin filter) hingga `48px` (login pemilih), padding `0 14px` (atau `0 40px` jika memiliki ikon kiri & kanan), background `#FFFFFF`, border `1px solid #E2E8F0`, `border-radius: 12px`.
  - **Ikon Dalam Input:** Ikon user/gembok di sisi kiri (`left: 14px`, warna `#94A3B8`, ukuran `18px`), ikon mata (*show/hide token*) di sisi kanan (`right: 14px`, interaktif).
- **Select Dropdown (`Status`, `Rombel`, `Tingkat`, `Jurusan`, `Pelaku`, `Aksi`):**
  - Tinggi `42px`, background `#FFFFFF`, border `1px solid #E2E8F0`, `border-radius: 10px`, teks `#0F172A`, ikon chevron-down di sisi kanan.
- **Date Input (`Dari tanggal`, `Sampai tanggal`):**
  - Format placeholder `hh / bb / tttt` dengan ikon kalender di sisi kanan.
- **States Input:**
  - *Focus:* Border berubah menjadi `#D6362C`, `box-shadow: 0 0 0 3px rgba(214, 54, 44, 0.12)`, `outline: none`.
  - *Error `(rekomendasi)`:* Border `#DC2626`, background `#FEF2F2`, disertai teks pesan kesalahan di bawah input berwarna `#DC2626` (`12px`).

---

### 6.3 Card (Kartu)

#### A. Kartu Kandidat — Varian Surat Suara (Vertical Ballot Card)
- **Dimensi & Kontainer:** Background `#FFFFFF`, `border-radius: 16px`, `overflow: hidden`, transisi `all 0.2s ease`, `cursor: pointer`.
- **Bagian Atas (Foto):** Rasio aspek `4:5`, latar belakang putih dengan grafis sapuan kuas (*brush stroke*) merah diagonal di belakang potret siswa berseragam.
  - *Sudut Kiri Atas:* Badge nomor urut (`#1`, `#2`, dst.) berukuran `32px x 26px`, background `#D6362C`, teks putih bold `13px`, `border-radius: 8px`.
  - *Sudut Kanan Atas:* Indikator lingkaran radio (`28px x 28px`). Saat belum dipilih: background `rgba(255,255,255,0.85)`, border `1.5px solid #E2E8F0`. Saat dipilih: background `#D6362C`, ikon centang putih `✓`.
- **Bagian Bawah (Info):** Padding `16px`, menampilkan Nama Kandidat (`16px`, bold, `#0F172A`) dan Motto (`13px`, regular, `#64748B`).
- **State Terpilih (`Selected`):** Border kartu berubah menjadi `2px solid #D6362C` dengan bayangan `0 8px 20px -4px rgba(214, 54, 44, 0.18)`.

#### B. Kartu Kandidat — Varian Showcase Beranda (Horizontal Split Card)
- **Struktur:** Kartu putih (`border-radius: 16px`, border `1px solid #E2E8F0`, `overflow: hidden`) yang dibagi menjadi 2 kolom sejajar (`display: flex`):
  - **Kolom Kiri (`width: 36%`):** Foto potret kandidat memenuhi tinggi kartu (`object-fit: cover`), dilengkapi badge `#1` di kiri atas.
  - **Kolom Kanan (`width: 64%`, padding `16px`):**
    - Nama Kandidat (`18px`, bold) & Motto (`13px`, `#64748B`, `margin-bottom: 12px`).
    - 3 Kapsul Program/Misi bertumpuk vertikal (`gap: 8px`). Setiap kapsul memiliki `border-radius: 14px`, padding `8px 12px`, `font-size: 12.5px`, `font-weight: 600`, dengan warna border dan teks spesifik per kandidat (Merah `#B9382C` untuk #1, Hijau `#1F6E58` untuk #2, Biru `#1D5B9E` untuk #3).
    - Tombol `Lihat Profil →` di bagian paling bawah (`margin-top: 12px`, `w-full`).

#### C. Kartu Statistik (Stat Card)
- **Varian 1 (Dengan Ikon — Dashboard):** Background `#FFFFFF`, border `1px solid #E2E8F0`, `border-radius: 16px`, padding `20px`. Di bagian atas terdapat lingkaran ikon `36px x 36px` (merah/biru/hijau/kuning lembut), diikuti angka besar `28px` extrabold di tengah, dan label keterangan `12px` `#64748B` di bawah.
- **Varian 2 (Kompak Tanpa Ikon — Halaman DPT, Hasil, Log):** Tinggi lebih ringkas (`padding: 16px 20px`), langsung menampilkan angka besar `26px` di atas dan label deskripsi `12px` di bawah. Khusus kartu `Partisipasi`, terdapat progress bar horizontal setebal `6px` di bagian bawah.

#### D. Kartu Perolehan Suara Kandidat (Result Card)
- **Struktur:** Background `#FFFFFF`, `border-radius: 16px`, padding `20px`, border `1.5px solid #D6362C` (untuk kandidat peringkat 1/unggul) atau `1px solid #E2E8F0` (untuk kandidat lainnya).
- **Header Kartu:** Lingkaran peringkat kecil (`24px`, merah `#D6362C` teks putih untuk `1`, abu-abu `#F1F5F9` teks `#64748B` untuk `2`) + Kotak Inisial (`40px x 40px`, `border-radius: 10px`, background `#FEF2F2`, teks merah `R`, `A`, `D`, `N`) + Nama Kandidat, nomor urut merah (`No. 1`), dan kelas (`XI IPA`).
- **Body & Footer Kartu:** Angka perolehan suara di kiri (`28px` bold `2` diikuti teks `suara` `13px` `#64748B`), persentase di kanan (`18px` bold merah `100,0%` atau `0,0%`), ditutup dengan progress bar horizontal di bagian bawah (`height: 8px`, `border-radius: 9999px`).

---

### 6.4 Tabel Data & Pagination (DPT, Kandidat, Log Aktivitas)
- **Kontainer Tabel:** Dibungkus dalam kartu putih (`border-radius: 16px`, border `1px solid #E2E8F0`, `overflow: hidden`).
- **Card Header Tabel:** Menampilkan judul tabel di kiri (`Daftar pemilih`, `Catatan aktivitas`) dan penghitung baris di kanan (`Menampilkan 1–25 dari 76`, `12px`, `#64748B`), padding `16px 20px`.
- **Table Header (`thead`):** Background hangat lembut `#FAF6F5` (atau `#F8FAFC`), teks uppercase `11px`, `font-weight: 700`, `letter-spacing: 0.05em`, warna `#64748B`, padding `12px 20px`, `border-top` dan `border-bottom: 1px solid #F1F5F9`.
- **Table Body (`tbody tr`):** Tinggi baris `60px–68px`, padding sel `14px 20px`, `border-bottom: 1px solid #F1F5F9`, state `:hover` mengubah background baris menjadi `#FAF9F7`.
- **Elemen Khusus di Dalam Sel:**
  - **Token Chip:** Kotak monospace `JUFT88TF` (`background: #F8FAFC`, `border: 1px solid #E2E8F0`, `border-radius: 6px`, `padding: 4px 8px`, `font-size: 12px`, `font-weight: 700`) berdampingan dengan tombol teks `Salin` berwarna merah.
  - **IP Chip:** Kotak monospace `::1` (`background: #F8FAFC`, `border: 1px solid #E2E8F0`, `border-radius: 6px`, `padding: 2px 8px`, `font-size: 11px`, warna `#64748B`).
- **Pagination `(rekomendasi untuk >25 baris)`:** Ditempatkan di bagian bawah kartu tabel (`padding: 12px 20px`, `border-top: 1px solid #F1F5F9`), menampilkan tombol `Sebelumnya`, nomor halaman (`1`, `2`, `3` dengan halaman aktif berwarna `#C8322B` teks putih), dan `Berikutnya`.

---

### 6.5 Badge & Status Pill

| Nama Status / Badge | Background | Teks & Dot | Border | Penggunaan |
| :--- | :--- | :--- | :--- | :--- |
| **Dibuka / Sedang berlangsung / Pemungutan suara dibuka** | `#ECFDF5` | `#047857` (dengan titik hijau `#10B981` `6px`) | `1px solid #A7F3D0` (di navbar) atau tanpa border | Navbar publik, halaman login, dashboard, hasil pemilihan |
| **Sudah memilih / Aktif / Siap** | `#ECFDF5` | `#047857` (dengan titik `#10B981`) | Tanpa border | Tabel DPT, tabel kandidat, kartu kesiapan pemilihan |
| **Belum memilih** | `#F1F5F9` | `#64748B` (dengan titik `#94A3B8`) | Tanpa border | Tabel DPT |
| **Sudah login** | `#FEF3C7` | `#B45309` (dengan titik `#F59E0B`) | Tanpa border | Tabel DPT (pemilih yang sedang membuka surat suara tapi belum submit) |
| **Role: Panitia** | `#FEF2F2` | `#C8322B` (`11px` bold) | Tanpa border | Kolom Pelaku pada Log Aktivitas & Dashboard |
| **Role: Pemilih** | `#ECFDF5` | `#047857` (`11px` bold) | Tanpa border | Kolom Pelaku pada Log Aktivitas |
| **Nomor Urut Kandidat (`#1`)** | `#D6362C` (di foto) / `#FCE8E6` (di tabel) | `#FFFFFF` (di foto) / `#C8322B` (di tabel) | Tanpa border | Foto kartu kandidat & kolom pertama tabel kandidat |

---

### 6.6 Navbar, Sidebar & Header
- **Public / Voter Topbar:**
  - Kiri: Logo bulat sekolah (`36px x 36px`) + teks bertumpuk `PILKETOS 2026` (kata `2026` berwarna merah `#D6362C`) dan `SMA Bojong Gede` (`12px`, `#64748B`).
  - Kanan (Belum Login): Pill status `● Dibuka`.
  - Kanan (Sudah Login): Pill status `● Pemungutan suara dibuka` (desktop) + Avatar inisial lingkaran merah muda `P` + Nama Pemilih (`Putri Ayu Lestari`) & Kelas (`Rombel 2`) + Tombol `Keluar` berbingkai (`border: 1px solid #E2E8F0`).
- **Admin Sidebar:**
  - Item menu memiliki tinggi `40px`, padding `0 12px`, `border-radius: 10px`, jarak ikon-teks `10px`.
  - *State Aktif:* Background `#FCE8E6` (atau `#FEF2F2`), teks dan ikon berwarna `#C8322B`, `font-weight: 600`.
  - *State Default:* Background transparan, teks `#334155`, ikon `#64748B`.

---

### 6.7 Modal / Dialog Konfirmasi `(rekomendasi)`
Meskipun tidak tertangkap langsung di layar, alur krusial seperti **Konfirmasi Kirim Suara**, **Atur Jadwal**, **Reset Token**, dan **Hapus Data** membutuhkan komponen modal standar yang selaras dengan sistem desain:
- **Overlay Backdrop:** `background: rgba(15, 23, 42, 0.45)` dengan `backdrop-filter: blur(4px)`.
- **Modal Box:** Lebar `max-width: 440px`, background `#FFFFFF`, `border-radius: 20px`, padding `24px`, `shadow-lg`.
- **Struktur Konfirmasi Pilihan Suara:**
  - Header dengan badge merah `KONFIRMASI PILIHAN` + Judul `Kirim suara untuk Kandidat #1?`.
  - Ringkasan kartu mini yang menampilkan foto, nama (`Raka Aditya Pratama`), dan kelas kandidat yang dipilih.
  - Kotak peringatan kuning/merah lembut: *"Perhatian: Suara yang sudah dikirim tidak dapat diubah kembali."*
  - Footer tombol sejajar: `Batal` (`btn-secondary` di kiri) dan `Ya, Kirim Suara` (`btn-primary` di kanan).

---

### 6.8 Alert, Toast & Notifikasi `(rekomendasi)`
- **Toast Feedback (mis. saat klik tombol `Salin` token):** Muncul melayang di kanan atas atau bawah tengah (`border-radius: 12px`, background `#0F172A`, teks putih `#FFFFFF`, ikon centang hijau `#10B981`, teks `"Token JUFT88TF berhasil disalin"`).
- **Inline Error Banner (mis. NIS/Token salah di halaman Login):** Kotak dengan background `#FEF2F2`, border `1px solid #FECACA`, teks `#DC2626`, `border-radius: 12px`, padding `12px 14px`, menampilkan ikon tanda seru dan pesan `"NIS atau token tidak valid, atau sudah digunakan untuk memilih."`

---

### 6.9 Upload Foto & Import Data `(rekomendasi)`
- **Modal Import DPT (saat klik `Import DPT`):** Memiliki area *drag-and-drop* (`border: 2px dashed #CBD5E1`, `border-radius: 16px`, background `#F8FAFC`, padding `32px`, teks instruksi unggah file `.csv` atau `.xlsx` beserta tautan `Unduh template CSV`).
- **Upload Foto Kandidat (saat klik `+ Tambah kandidat`):** Pratinjau foto rasio `4:5` (`width: 120px`, `border-radius: 12px`) dengan tombol `Pilih Foto` (`JPG/PNG, maks. 2MB`).

---

### 6.10 Grafik & Progress Bar Real-Time
Aplikasi menggunakan **Linear Horizontal Progress Bar** yang bersih dan mudah dipindai:
- **Track (Jalur Kosong):** Tinggi `6px` (pada kartu statistik & tabel kelas) atau `8px` (pada kartu hasil perolehan suara), background `#F1F5F9`, `border-radius: 9999px`.
- **Fill (Isi Progres):**
  - Pada Kartu Statistik Partisipasi: Warna hijau `#1F7A4C` dengan titik bulat di ujung kiri/awal saat persentase kecil (`2,6%`).
  - Pada Tabel `Partisipasi per kelas` & Kartu Kandidat Unggul: Warna merah utama `#C8322B` / `#D6362C`, `border-radius: 9999px`, transisi `width 0.4s cubic-bezier(0.4, 0, 0.2, 1)`.

---

## 7. Halaman & Layout per Screen

### 7.1 Beranda Publik & Daftar Kandidat (Mobile View)
- **Susunan Atas ke Bawah:**
  1. **Sticky Navbar:** Brand `PILKETOS 2026` di kiri, badge `● Dibuka` (atau avatar `P` + tombol keluar jika sudah login) di kanan.
  2. **Hero Banner Image:** Ilustrasi gedung sekolah, bendera Merah Putih, dan kotak suara.
  3. **Hero Introduction Block:** Eyebrow merah `PEMILIHAN RESMI — SATU ORANG, SATU SUARA`, judul besar `Pemilihan Ketua OSIS 2026`, deskripsi singkat kerahasiaan suara, diikuti 2 tombol penuh vertikal (`Masuk untuk memilih` dan `Masuk sebagai panitia`).
  4. **Summary Counter Card:** Kartu putih menampilkan angka `4 CALON TERDAFTAR` dengan ikon grup merah.
  5. **Candidate List Section:** Daftar kartu kandidat bertumpuk vertikal (`#1 Raka Aditya Pratama`, `#2 Alya Putri Maharani`, `#3 Dimas Bagaskara`, `#4 Nadia Safira Rahman`), masing-masing menampilkan foto di kiri, 3 kapsul misi berwarna unik di kanan, dan tombol `Lihat Profil →`.

### 7.2 Halaman Detail Profil Kandidat (Mobile View)
- **Susunan Atas ke Bawah:**
  1. **Navbar & Hero Strip:** Navbar standar diikuti pita ilustrasi bendera Merah Putih yang lebih pendek (`height: ~110px`).
  2. **Header Profil:** Tautan navigasi `← Semua kandidat`, eyebrow merah `KANDIDAT NOMOR 1`, nama besar `Raka Aditya Pratama`, dan kutipan motto `“Bersama Bergerak, Bersama Bersinar”`.
  3. **Kartu Foto Kandidat:** Kartu putih berbingkai menampilkan potret kandidat dengan badge `#1`.
  4. **Kartu Visi (dan Misi/Program di bawahnya):** Kartu putih dengan aksen garis merah horizontal (`—`) di sebelah judul `Visi`, diikuti paragraf deskripsi yang nyaman dibaca.

### 7.3 Halaman Login Pemilih (Mobile View)
- **Susunan Atas ke Bawah:**
  1. **Red Hero Header:** Latar belakang ilustrasi kotak suara yang dilapisi gradien merah tua (`#A8201A` ke `#D6362C`), menampilkan logo sekolah, nama acara, dan judul besar `Pemilihan Ketua OSIS 2026` (kata `OSIS 2026` berwarna kuning keemasan `#FDE047`).
  2. **Overlapping Form Card:** Kartu putih dengan sudut atas membulat (`24px`) yang menumpuk di atas bawah hero merah:
     - Badge hijau `● Pemungutan suara dibuka`.
     - Judul `Masuk untuk memilih` & subjudul instruksi.
     - Input `NIS` dengan ikon profil di kiri.
     - Input `Token` dengan ikon gembok di kiri dan tombol mata (*show/hide*) di kanan.
     - Tombol utama `Masuk` berwarna merah penuh.
     - Garis pemisah tipis, tautan `← Kembali ke beranda`, dan teks bantuan `Lupa token? Hubungi panitia.`

### 7.4 Halaman Surat Suara / Voting Screen (Desktop & Mobile View)
- **Susunan Atas ke Bawah:**
  1. **Top Navbar:** Logo di kiri; status `● Pemungutan suara dibuka`, profil `Putri Ayu Lestari (Rombel 2)`, dan tombol `Keluar` di kanan.
  2. **Hero Header Surat Suara:** Latar belakang bendera Merah Putih di kanan, teks di kiri: eyebrow `SURAT SUARA`, judul `Pilih Satu Calon Ketua`, dan instruksi dengan penekanan tebal `tidak bisa diubah`.
  3. **Grid Kartu Kandidat:** 4 kartu berjajar horizontal di desktop (`grid-cols-4`) atau bertumpuk di mobile. Kartu yang diklik (`#1`) langsung memiliki border merah dan tanda centang merah di sudut kanan atas foto.
  4. **Sticky Bottom Confirmation Bar:** Bilah putih tetap di bagian bawah layar yang menampilkan teks `Dipilih: No. 1 — Raka Aditya Pratama` di kiri dan tombol merah `Kirim suara` di kanan.

### 7.5 Halaman Suara Tercatat (`/vote/thanks`)
- **Susunan Atas ke Bawah:**
  1. **Top Navbar:** Sama seperti halaman surat suara.
  2. **Centered Confirmation Hero:** Berlatar belakang bendera Merah Putih dan kotak suara, menampilkan:
     - Ikon lingkaran hijau besar (`64px`) dengan tanda centang putih di tengah.
     - Eyebrow merah `SUARA TERCATAT`.
     - Judul besar `Terima kasih, Putri Ayu Lestari!`.
     - Subteks penjelasan bahwa suara telah disimpan secara rahasia.
     - Dua tombol sejajar di tengah: `Keluar` (merah utama) dan `Lihat kandidat` (putih berbingkai).
  3. **Curved Red Footer:** Lengkungan gelombang merah yang menyatu ke footer merah penuh berisi identitas sekolah dan hak cipta.

### 7.6 Dashboard Admin (`/admin/dashboard`)
- **Susunan Atas ke Bawah (di dalam Area Konten):**
  1. **Greeting & Quick Actions:** Judul `Halo, Super Admin` di kiri; tombol `Lihat beranda` dan `Atur jadwal` di kanan.
  2. **Voting Status Banner Card:** Menampilkan rentang jadwal aktif (`25 Okt 2026, 07:00 – 2 Nov 2026, 15:00`) di kiri dan badge `● Pemungutan suara dibuka` di kanan.
  3. **4 Metric Cards:** `4 Kandidat aktif`, `76 Total pemilih (DPT)`, `2 Sudah memilih (74 belum memilih)`, dan `2,6% Partisipasi`.
  4. **Bento Lower Grid (2 Kolom):**
     - Kiri (`65%`): Tabel `Partisipasi per kelas` lengkap dengan progress bar merah per rombel (`Rombel 1` s/d `Rombel 7`).
     - Kanan (`35%`): Kartu `Kesiapan pemilihan` (4 item checklist bercentang hijau dengan status `Siap`) di bagian atas, dan kartu `Aktivitas terbaru` di bagian bawah.

### 7.7 Manajemen Kandidat (`/admin/candidates`)
- **Susunan Atas ke Bawah:**
  1. **Header Baris Aksi:** Keterangan jumlah kandidat aktif di kiri, tombol `+ Tambah kandidat` di kanan.
  2. **Tabel Kandidat:** Menampilkan nomor urut (`#1`–`#4`), foto profil mini, nama & motto, kelas (`XI IPA`/`XI IPS`), ringkasan kelengkapan (`4 misi, 3 program, 3 pendukung`), badge status `● Aktif`, serta tombol aksi `Edit` dan `Hapus`.
  3. **Footer Admin:** Teks hak cipta terpusat di bawah tabel.

### 7.8 Manajemen Pemilih / DPT (`/admin/voters`)
- **Susunan Atas ke Bawah:**
  1. **Header Baris Aksi:** Deskripsi aturan login DPT di kiri; tombol `Import DPT` dan `+ Tambah pemilih` di kanan.
  2. **4 Compact Stat Cards:** Ringkasan total pemilih, sudah memilih, belum memilih, dan persentase partisipasi.
  3. **Multi-Filter Bar Card:** Input pencarian `Nama atau NIS`, dropdown `Status`, `Rombel`, `Tingkat`, `Jurusan`, dan tombol merah `Cari`.
  4. **Tabel Daftar Pemilih:** Menampilkan `NIS`, `NAMA`, `KELAS`, `TOKEN` (dengan tombol `Salin`), `STATUS` (`Sudah memilih` beserta jam, `Belum memilih`, atau `Sudah login`), dan 3 tombol aksi (`Edit`, `Reset token`, `Hapus`).

### 7.9 Hasil Pemilihan Real-Time (`/admin/results`)
- **Susunan Atas ke Bawah:**
  1. **Header Baris Aksi:** Keterangan privasi hasil suara di kiri; tombol `Segarkan` dan `Lihat laporan` di kanan.
  2. **Election Info Banner:** Nama pemilihan, jadwal mulai-selesai, label merah `Hasil sementara`, dan badge hijau `● Sedang berlangsung`.
  3. **4 Compact Stat Cards:** Suara masuk (`2`), Total pemilih (`76`), Belum memilih (`74`), Partisipasi (`3%`).
  4. **Grid Kartu Perolehan Suara:** Dilengkapi badge `● Unggul: No. 1 Raka Aditya Pratama` di kanan atas, menampilkan kartu masing-masing kandidat dalam grid 3 kolom (baris pertama 3 kandidat, baris kedua 1 kandidat).
  5. **Auto-Refresh Toggle:** Checkbox `Segarkan otomatis tiap 30 detik` di bagian paling bawah.

### 7.10 Log Aktivitas (`/admin/logs`)
- **Susunan Atas ke Bawah:**
  1. **Deskripsi Imutabilitas:** Penjelasan bahwa log bersifat *read-only* dan tidak dapat diubah dari panel.
  2. **4 Log Metric Cards:** `21 Total catatan`, `10 Aktivitas panitia`, `4 Login pemilih berhasil`, `2 Login gagal`.
  3. **Filter Bar Log:** Input pencarian (`Keterangan, nama, NIS, atau IP`), dropdown `Pelaku`, dropdown `Aksi`, input tanggal `Dari tanggal` & `Sampai tanggal`, serta tombol `Cari`.
  4. **Tabel Catatan Aktivitas:** Menampilkan `WAKTU` (tanggal & jam lengkap ke detik), `PELAKU` (nama + badge `Panitia`/`Pemilih` + username/NIS), `AKSI` (judul aksi + kode sistem), `KETERANGAN`, dan alamat `IP`.

---

## 8. Iconography & Imagery

### 8.1 Gaya Ikon & Library
- **Gaya Visual:** Outline (*stroke-based*) dengan ketebalan garis konsisten (`stroke-width: 1.75px` atau `2px`), ujung garis membulat (`stroke-linecap: round`, `stroke-linejoin: round`).
- **Rekomendasi Library:** **Lucide Icons** (`lucide-react` / `lucide`) atau **Heroicons v2 Outline**, yang 100% identik dengan ikon di layar:
  - Dashboard: `LayoutGrid`, Kandidat: `User`, Pemilih: `Users`, Hasil & Laporan: `BarChart3`, Tingkat Kelas: `Layers`, Jurusan: `BookOpen` / `CreditCard`, Pengaturan: `SlidersHorizontal`, Log Aktivitas: `Clock`, Kelola Admin: `ShieldCheck`, Keluar: `LogOut`, Token: `Lock`, Lihat Token: `Eye`, Kotak Suara: `Inbox` / `Archive`.
- **Ukuran Standar:**
  - `16px` (`w-4 h-4`): Ikon di dalam tombol, input form, dan menu sidebar.
  - `18px–20px` (`w-5 h-5`): Ikon di dalam lingkaran kartu statistik dashboard.
  - `32px` (`w-8 h-8`): Ikon centang putih di dalam lingkaran hijau halaman `Suara Tercatat`.

### 8.2 Gaya Foto Kandidat & Ilustrasi
- **Foto Kandidat:**
  - Menggunakan latar belakang studio seragam (putih dengan aksen sapuan kuas merah diagonal) sehingga seluruh kartu kandidat terlihat harmonis.
  - Rasio aspek: `4:5` (pada halaman Surat Suara dan Detail Profil) dan `3:4` penuh vertikal pada kartu daftar kandidat mobile.
  - Thumbnail di Tabel Admin: Persegi `40px x 40px` (`border-radius: 10px`, `object-fit: cover`).
- **Ilustrasi Hero:** Menggabungkan elemen fotografi/3D gedung institusi, langit cerah, bendera Merah Putih berkibar, dan kotak suara putih di sisi kanan sebagai identitas visual yang konsisten di seluruh halaman pemilih.

---

## 9. Interaction & Motion

1. **Pemilihan Kartu Surat Suara:**
   - Saat pengguna mengetuk kartu kandidat, transisi perubahan warna border (`#E2E8F0` ke `#D6362C`), munculnya tanda centang pada lingkaran radio, dan pembaruan teks pada *sticky bottom bar* berlangsung instan dengan `transition: all 180ms cubic-bezier(0.4, 0, 0.2, 1)`.
2. **Copy Token Feedback:**
   - Saat panitia menekan tombol `Salin` di sebelah token pemilih, teks tombol berubah sementara menjadi `Tersalin ✓` berwarna hijau `#047857` selama `1.5 detik` sebelum kembali menjadi `Salin` `(rekomendasi)`.
3. **Auto-Refresh Polling (Halaman Hasil):**
   - Ketika checkbox `Segarkan otomatis tiap 30 detik` dicentang, aplikasi melakukan *background fetch* setiap 30 detik dan menganimasikan lebar *progress bar* suara kandidat secara mulus (`transition: width 500ms ease-out`) tanpa memuat ulang seluruh halaman.
4. **Loading & Empty States `(rekomendasi)`:**
   - Saat tombol `Masuk` atau `Kirim suara` ditekan, tampilkan ikon *spinner* berputar di sebelah teks tombol dan nonaktifkan tombol (`disabled`) untuk mencegah klik ganda (*double submission*).
   - Jika pencarian di tabel DPT atau Log Aktivitas tidak menemukan hasil, tampilkan baris kosong terpusat dengan ikon kaca pembesar abu-abu, teks `"Data tidak ditemukan"`, dan tombol `"Reset filter"`.

---

## 10. Accessibility & UX Keamanan

1. **Kontras Warna (WCAG 2.1 AA/AAA):**
   - Teks utama `#0F172A` di atas `#FFFFFF` memiliki rasio kontras **17.4:1** (AAA).
   - Teks putih `#FFFFFF` di atas tombol merah `#C8322B` memiliki rasio kontras **5.6:1** (lulus AA untuk teks normal dan AAA untuk teks besar/bold).
2. **Ukuran Tap Target Mobile:**
   - Seluruh tombol utama pada layar mobile (`Masuk untuk memilih`, `Masuk`, `Lihat Profil →`) memiliki tinggi minimal `44px–48px` dan lebar penuh sehingga sangat mudah dijangkau ibu jari.
3. **Pola UX "Satu Orang, Satu Suara" & Anti-Curang:**
   - **Token Sekali Pakai & Masking:** Input token menggunakan `type="password"` secara default dengan tombol ikon mata agar tidak mudah diintip orang di sekitar pemilih.
   - **Pencegahan Salah Pilih:** Teks instruksi secara eksplisit menebalkan kalimat **"Setelah suara dikirim, pilihan tidak bisa diubah"**, didukung bilah konfirmasi di bawah layar yang menyebutkan ulang nomor dan nama kandidat yang sedang dipilih (`Dipilih: No. 1 — Raka Aditya Pratama`).
   - **Deteksi Sesi Menggantung (`Sudah login`):** Pada tabel DPT, panitia dapat melihat status kuning `● Sudah login` untuk membedakan pemilih yang baru masuk ke bilik suara dengan yang sudah selesai memilih (`● Sudah memilih`), serta menyediakan fitur `Reset token` jika pemilih mengalami kendala perangkat.
   - **Immutable Audit Trail:** Halaman Log Aktivitas memberikan pernyataan tegas bahwa seluruh catatan bersifat *read-only* dan merekam jejak waktu hingga satuan detik beserta alamat IP.

---

## 11. Do & Don't

| ✅ DO (Lakukan) | ❌ DON'T (Jangan Lakukan) |
| :--- | :--- |
| Gunakan warna merah utama (`#C8322B` / `#D6362C`) **hanya** untuk CTA utama, indikator aktif/terpilih, dan aksen merek agar hierarki visual tetap tajam. | Jangan gunakan warna merah menyala untuk seluruh latar belakang halaman admin; pertahankan latar `#FAF9F7` dan kartu `#FFFFFF` yang bersih. |
| Gunakan `font-mono` dengan latar `#F8FAFC` dan border tipis untuk semua data teknis seperti Token (`JUFT88TF`), kode aksi (`vote_cast`), dan IP (`::1`). | Jangan tampilkan token pemilih menggunakan font proporsional biasa karena karakter seperti `I`, `l`, `1`, `0`, dan `O` mudah tertukar saat diketik pemilih. |
| Berikan warna aksen kapsul misi yang berbeda untuk tiap kandidat di halaman daftar kandidat agar pemilih mudah membedakan program kerja mereka. | Jangan mengubah warna border kartu di halaman **Surat Suara** dengan warna-warni per kandidat; di Surat Suara, warna border merah **hanya** menandakan kandidat yang sedang dipilih. |
| Pertahankan *sticky bottom bar* di halaman Surat Suara agar tombol `Kirim suara` selalu terlihat tanpa perlu melakukan *scroll* panjang. | Jangan langsung mengirim suara saat pengguna baru mengetuk kartu kandidat; pengguna harus menekan tombol `Kirim suara` secara sadar. |
| Sertakan satuan waktu lengkap (`HH:mm:ss`) dan badge peran (`Panitia` / `Pemilih`) pada setiap baris Log Aktivitas. | Jangan menyediakan tombol Edit atau Hapus di dalam tabel Log Aktivitas demi menjaga integritas audit pemilihan. |

---

## 12. CSS Variables / Design Tokens & Tailwind Config

### 12.1 CSS Variables (`:root`)

```css
:root {
  /* Brand & Primary Colors */
  --color-primary-50: #FEF2F2;
  --color-primary-100: #FCE8E6;
  --color-primary-200: #FECACA;
  --color-primary-500: #D6362C;
  --color-primary-600: #C8322B;
  --color-primary-700: #B0251E;

  /* Secondary & Candidate Accents */
  --color-accent-gold: #FDE047;
  --color-candidate-1: #B9382C;
  --color-candidate-2: #1F6E58;
  --color-candidate-3: #1D5B9E;
  --color-candidate-4: #7E22CE;

  /* Background & Surface */
  --color-bg-canvas: #FAF9F7;
  --color-bg-subtle: #FDF8F6;
  --color-surface: #FFFFFF;
  --color-surface-muted: #F8FAFC;

  /* Borders */
  --color-border-subtle: #F1F5F9;
  --color-border-default: #E2E8F0;
  --color-border-strong: #CBD5E1;

  /* Typography Colors */
  --color-text-primary: #0F172A;
  --color-text-secondary: #64748B;
  --color-text-muted: #94A3B8;
  --color-text-on-primary: #FFFFFF;

  /* Status & Semantic Colors */
  --color-success-bg: #ECFDF5;
  --color-success-border: #A7F3D0;
  --color-success-text: #047857;
  --color-success-solid: #1F7A4C;

  --color-warning-bg: #FEF3C7;
  --color-warning-text: #B45309;

  --color-danger-bg: #FEF2F2;
  --color-danger-border: #FECACA;
  --color-danger-text: #DC2626;

  --color-info-bg: #EFF6FF;
  --color-info-text: #2563EB;

  /* Typography Families */
  --font-sans: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  /* Spacing Scale */
  --space-1: 0.25rem; /* 4px */
  --space-2: 0.5rem;  /* 8px */
  --space-3: 0.75rem; /* 12px */
  --space-4: 1rem;    /* 16px */
  --space-5: 1.25rem; /* 20px */
  --space-6: 1.5rem;  /* 24px */
  --space-8: 2rem;    /* 32px */

  /* Border Radius */
  --radius-xs: 6px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-xs: 0 1px 2px 0 rgba(15, 23, 42, 0.03);
  --shadow-sm: 0 4px 12px -2px rgba(15, 23, 42, 0.06);
  --shadow-primary: 0 6px 16px -4px rgba(200, 50, 43, 0.35);
  --shadow-sticky-bar: 0 -4px 16px -4px rgba(15, 23, 42, 0.08);
}
```

### 12.2 Konfigurasi Tailwind CSS (`tailwind.config.js`)

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{html,js,jsx,ts,tsx,php,vue}',
    './app/Views/**/*.php', // Mendukung struktur CodeIgniter 4 / Laravel Blade
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          200: 'var(--color-primary-200)',
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
          700: 'var(--color-primary-700)',
          DEFAULT: 'var(--color-primary-600)',
        },
        canvas: 'var(--color-bg-canvas)',
        subtle: 'var(--color-bg-subtle)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          muted: 'var(--color-surface-muted)',
        },
        candidate: {
          1: 'var(--color-candidate-1)',
          2: 'var(--color-candidate-2)',
          3: 'var(--color-candidate-3)',
          4: 'var(--color-candidate-4)',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        primary: 'var(--shadow-primary)',
        'sticky-bar': 'var(--shadow-sticky-bar)',
      },
    },
  },
  plugins: [],
};
```