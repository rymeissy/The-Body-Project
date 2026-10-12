# Prototype Mobile Web Application — The Body Project

Prototype sistem pemesanan kelas Pilates berbasis web untuk **Studio Pilates The Body Project**,
mengikuti desain Figma (dominan hijau & krem) dan menerapkan **responsive web design**.

> Prototipe UI (front-end) — sesuai ruang lingkup skripsi BAB 4. Belum ada backend/API.

---

## Menjalankan

```bash
node serve.js          # default http://localhost:4173
node serve.js 8080     # porta lain
```

Buka **http://localhost:4173** untuk aplikasinya, atau
**http://localhost:4173/preview.html** untuk perbandingan tiga breakpoint sekaligus.

Alternatif tanpa Node: buka `index.html` langsung lewat Live Server (VS Code)
atau `npx serve .`

---

## Struktur

```
prototype/
├── index.html          # Struktur halaman & 4 view
├── preview.html        # Harness preview responsif (390 / 820 / 1280 px)
├── serve.js            # Server statis tanpa dependensi
├── css/
│   └── style.css       # Design token, komponen, 3 breakpoint
└── js/
    ├── data.js         # Data dummy (kelas, paket, instruktur, cabang)
    └── app.js          # Navigasi, filter, render, alur pemesanan
```

Tanpa framework dan tanpa build step — vanilla JS + CSS custom properties.
Semua data di `data.js` akan diganti API saat的开发 dilanjutkan ke tahap implementasi.

---

## Design token

| Token | Nilai | Dipakai untuk |
|---|---|---|
| `--green-800` | `#26513F` | Header, tombol utama, sidebar aktif |
| `--green-700` | `#2E5B4A` | Teks aksen, tag, border terpilih |
| `--cream-50` | `#FBF9F5` | Latar konten |
| `--cream-100` | `#F5F1E9` | Latar halaman, panel header |
| `--cream-200` | `#EDE7DA` | Pembatas, progress track |
| `--gold-600` | `#A8863C` | Badge "Sisa 2 dari 6 slot" / "Tersedia: 4 slot" |
| `--red-700` | `#B23B2E` | Badge "Penuh (Waitlist: 1 orang)" |
| `--ink-900` | `#1C2620` | Teks utama |

Tipografi: `Fraunces` (display/serif) untuk judul, `Inter` untuk UI,
dengan fallback ke serif & system font bila Google Fonts tidak terjangkau.

---

## Breakpoint

| Lebar | Navigasi | Grid kartu | Panel pemesanan |
|---|---|---|---|
| `< 768px` | Bottom tab bar | 1 kolom | Bottom sheet dari bawah |
| `768–1023px` | Horizontal, sticky di atas | 2 kolom | Modal terpusat |
| `≥ 1024px` | Sidebar kiri 236px | 3 kolom | Modal 560px, metode bayar 4 kolom |

Pendekatan **mobile-first**: aturan dasar ditulis untuk layar kecil,
lalu di-*enhance* pada `@media (min-width: …)`.

---

## Alur pengguna

Saat situs dibuka pertama kali, pengguna akan menemukan **gerbang autentikasi** — tidak langsung
masuk ke dashboard. Hanya satu form tampil pada satu waktu, dipindah lewat link silang
di bagian bawah:

```
Buka situs
  └─ Belum punya sesi → Layar Masuk
       │   "Belum punya akun? Daftar di sini"
       │        ↓ link
       │   Layar Daftar
       │   "Sudah punya akun? Login di sini"
       │        ↓ link
       ├─ Masuk        email atau no. WhatsApp + kata sandi
       ├─ Daftar       nama · email · no. WhatsApp · sandi · konfirmasi · syarat
       └─ Google / WhatsApp (sosial)
            └─ Sesi disimpan di localStorage → aplikasi terbuka
                 └─ Keluar (Profil) menghapus sesi → kembali ke layar auth
```

Saat berpindah form, posisi scroll dikembalikan ke atas dan fokus
dipindahkan ke field pertama — jadi tidak ada konteks yang tertinggal.

Sesi bertahan setelah reload. Untuk memaksa tampilan aplikasi tanpa sesi,
akses `index.html?demo=1`.

### Yang sudah ditangani

- Validasi **email** (`nama@domain.tld`) dan **nomor** (`08…` / `+62 8…`)
- Kata sandi minimal 6 karakter + konfirmasi harus cocok
- Meter kekuatan kata sandi (lemah / sedang / kuat)
- Tombol tampil-sembunyikan kata sandi dengan `aria-pressed`
- Pesan error inline di bawah tiap field, border merah, `role="alert"`
- Fokus otomatis ke field pertama yang salah
- Tombol submit menampilkan status "Memverifikasi…" / "Membuat akun…"
- Nama, email, no. WhatsApp, dan tanggal bergabung ikut tersinkron ke
  halaman **Profil** serta sheet pemesanan

Layout auth satu kolom di semua lebar layar, dengan logo studio di atas form.
Kolom merek/panel dekoratif tidak digunakan agar fokus tetap pada form.

---

## Alur pemesanan

```
Kartu kelas
  └─ Book Seat / Daftar Tunggu
       └─ Langkah 1 — Pilih Paket
            • Gunakan Kuota Paket (sisa sesi dipotong otomatis)
            • Beli Drop-in / Sesi Baru  Rp 375.000
            • Masuk Daftar Tunggu (kursi penuh)
            └─ Langkah 2 — Data Peserta + kebijakan
                 └─ Langkah 3 — Metode pembayaran
                      (QRIS · BCA VA · GoPay/OVO · Kartu Kredit)
                      └─ Konfirmasi → e-ticket + riwayat
```

Perilaku yang ikut diuji:

- Sisa kuota paket berkurang dan **langsung tercermin** di ringkasan & halaman Paket
- `taken` bertambah sehingga status kapasitas berubah ("Sisa 2" → "Sisa 1")
- Kelas yang penuh menampilkan opsi **Daftar Tunggu** dan menambah penghitung waitlist
- Booking baru langsung masuk ke **Riwayat** dengan kode `TBP-26014-08`

---

## Latar halaman

Latar luar halaman **putih** dengan kolom aplikasi krem terpusat di tengahnya,
sehingga terlihat **gutter putih di kiri dan kanan** — mengikuti pola
sweatbar.id. Kolom aplikasi dibatasi 520px (mobile) → 960px (tablet) →
1180px (desktop) supaya gutter selalu muncul di layar laptop.

Di bawah 768px kolom aplikasi memenuhi layar penuh, sehingga tidak ada gutter sama sekali —
tampilan mobile apa adanya.

## Navigasi

Lima tab di bawah: **Jadwal · Cabang · Paket · Riwayat · Profil**

- **< 768px** — bottom tab bar
- **768–1023px** — horizontal, sticky di atas
- **≥ 1024px** — sidebar kiri

## Fitur yang terimplementasi

**Jadwal** — mengikuti desain Figma, dari atas ke bawah:

- *Baris atas* — pill cabang (dengan caret, bisa diklik untuk memutar 8 cabang)
  dan status "● Studio Buka • jam operasional" yang ikut berubah per cabang
- *Kartu paket* — kartu hijau tua berisi nama paket + badge AKTIF, masa berlaku,
  cakupan kelas, sisa sesi, tombol **Top Up Sesi**, dan progress bar
- *Kalender* — judul "Oktober 2026" + tautan Lihat Kalender, lalu deret 7 hari
  berbentuk kartu. Hari terpilih jadi hijau tua; setiap hari punya **titik hijau**
  sebagai penanda masih ada slot kosong (mengikuti filter cabang & tipe aktif)
- *Filter tipe* — Semua Kelas · Reformer · Mat Flow · Cadillac · Prenatal
- *Kartu kelas* — jam + durasi terhitung ("50 Menit • Reformer Studio A"),
  pil "⊕ Sisa 2 dari 6 slot", judul besar, tag level + "Dapat kuota paket",
  instruktur dengan peran (Lead Reformer Coach dll), dan tombol Book Seat

Perubahan state pada halaman ini: memfilter tipe atau memilih hari akan
me-render ulang deret kalender (titik ikut berubah) dan daftar kelas.

**Cabang** — 8 studio di Jabodetabek. Kartu mengikuti desain Figma: area hero
dengan badge *Flagship Studio*, overlay "Buka Hari Ini" + jam operasional dan
jarak, nama studio dengan tag status, alamat, chip fasilitas
(Reformer Beds / Private Suites / Valet Parking / Shower), lalu footer dengan
tombol **Lihat Jadwal (N Sesi)** dan tombol ikon peta.

Ikon peta membuka Google Maps di tab baru lewat URL pencarian berdasarkan alamat:
`https://www.google.com/maps/search/?api=1&query=<alamat>`

Angka pada tombol "Lihat Jadwal (N Sesi)" dihitung dari data kelas,
bukan angka statis.

> **Catatan data:** area hero masih berupa placeholder gradien karena belum ada
> aset foto. Ganti dengan foto studio asli (300 dpi, format JPG) lalu ubah
> `background` pada `.branch-card__hero` menjadi `background-image: url(...)`.
> Alamat, nomor telepon, jam buka, dan jarak juga masih placeholder.

### Foto yang belum ada

Tiga tempat di prototype ini memakai placeholder karena belum ada aset gambar.
Supaya gampang ditukar nanti, ketiganya sudah disiapkan:

| Tempat | Sekarang | Cara ganti |
|---|---|---|
| Hero kartu cabang | Gradien + tekstur | `.branch-card__hero` → `background-image: url(...)` |
| Avatar instruktur | Inisial dalam lingkaran | Ganti isi `.avatar--ring` di `classCard()` menjadi `<img>` |
| Foto merchandise | Belum ada halaman | — |

Untuk avatar, di `classCard()` ganti:

```js
<span class="avatar avatar--ring" aria-hidden="true">${initials(k.instructor)}</span>
```

dengan:

```js
<img class="avatar avatar--ring" src="${k.instructorPhoto}" alt="">
```

lalu tambahkan `instructorPhoto` ke tiap entri `CLASSES` di `data.js`.

`avatar--ring` sudah punya `border-radius: 50%`, jadi yang perlu ditambah
adalah `object-fit: cover` supaya foto tidak tergencet:

```css
.avatar--ring { object-fit: cover; }
```

**Paket** — daftar paket aktif dengan progress bar, masa berlaku, harga per sesi · ketentuan kelas

**Riwayat** — aktivitas pemesanan (selesai / dibatalkan / terjual / menunggu)

**Profil** — data keanggotaan, poin hadiah, menu akun

**Lain-lain** — branch switcher di header (memutar 8 cabang) · toast notifikasi ·
semantic HTML + `aria-current`/`aria-pressed` · fokus keyboard terlihat ·
`prefers-reduced-motion`

---

## Fitur yang belum ada

Berikutnya yang wajar dikerjakan:

1. **Halaman admin** — kelola jadwal, kapasitas, paket, dan absensi
   (sudah dibahas di BAB 3 tapi belum dibuat UI-nya)
2. **Halaman merchandise** — etalase e-commerce (karena itu revenue stream kedua)
3. **Pencarian kelas** — state `search` sudah ada di `app.js`, tinggal Alison input
4. **State persisten** — saat ini reset saat reload; bisa pakai `localStorage`
5. **Integrasi backend** — ganti `data.js` dengan fetch ke REST API

---

## Catatan untuk paper IEEE

Untuk paper 6 halaman, jangan masukkan semua layar. Rujukan pemilihan gambar:

| Layar | Gunanya | Prioritas |
|---|---|---|
| Jadwal + status kuota | Membuktikan real-time capacity & waitlist | Wajib |
| Detail paket ("Gunakan Kuota") | Fitur pembeda utama | Wajib |
| Checkout + metode bayar | Alur end-to-end | Wajib |
| Halaman admin | Sisi back-office | Opsional |

Gabung 3 layar sisi pelanggan ke satu gambar horizontal (mis. Fig. 4),
lalu 1 layar admin terpisah (Fig. 5). Export dari browser atau Figma
dengan **300 dpi** agar tidak pecah saat dicetak.
