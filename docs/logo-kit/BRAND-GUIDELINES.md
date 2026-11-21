# Votera — Browser Tab Icon & Favicon Guidelines

## 1. Identitas & Konsep
- **Konsep:** *The Kinetic V-Check* — Monolit inisial huruf "V" dengan sayap kanan membubung tegas membentuk tanda centang (*checkmark*) afirmasi suara.
- **Fungsi Khusus:** Dioptimalkan khusus untuk keterbacaan ekstrem pada tab browser (*favicon 16×16 px* dan *32×32 px*), bookmarks bar, serta pintasan aplikasi web (PWA).

## 2. Palet Warna Resmi
| Peran | Nama Token | HEX | RGB | Penggunaan |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Brand** | Civic Crimson | `#D93829` | `217, 56, 41` | Default ikon di tab terang / putih |
| **Dark Neutral** | Slate Midnight | `#0F172A` | `15, 23, 42` | Varian monokrom gelap |
| **Clean White** | Pure White | `#FFFFFF` | `255, 255, 255` | Varian untuk tema tab gelap |

## 3. Struktur Berkas yang Dihasilkan (`docs/logo-kit/` & `public/`)
| Berkas | Format & Ukuran | Fungsi |
| :--- | :--- | :--- |
| `favicon.ico` | Multi-size ICO (16, 32, 48 px) | Kompatibilitas browser legacy & Windows shortcut |
| `favicon.svg` | SVG Vektor Ringan (~300 bytes) | Favicon modern beresolusi tajam tanpa batas skala |
| `favicon-16.png` & `favicon-32.png` | PNG Transparan | Standar fallback favicon browser |
| `apple-touch-icon.png` | PNG 180×180 px | Ikon bookmark di iOS Safari & Home Screen |
| `icon-192.png` & `icon-512.png` | PNG PWA Icon | Manifest web app & Android splash |
| `site.webmanifest` | JSON Manifest | Konfigurasi PWA tema `#D93829` |
| `votera-black.svg` & `votera-white.svg` | Master SVG Monokrom | Keperluan varian dark/light kontras tinggi |

## 4. Rekomendasi Penggunaan
- **Di Tab Browser Terang (Light Theme):** Gunakan `votera-mono-d93829.svg` atau `favicon.ico`.
- **Di Tab Browser Gelap (Dark Theme):** Gunakan `favicon.svg` atau varian putih.
- **Jangan:** Menambahkan drop-shadow, gradien kabur, garis tepi (*outline*) tipis, atau meregangkan rasio aspek (harus selalu 1:1).
