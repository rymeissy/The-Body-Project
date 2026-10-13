# Prototype Mobile Web Application — The Body Project

Prototype sistem pemesanan kelas Pilates berbasis web untuk **Studio Pilates The Body Project**.
Tampilan bergaya hijau dan krem, dengan lebar kolom dikunci 512px pada semua
ukuran layar.

> Prototipe UI (front-end). Belum ada backend/API.

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
| `--green-800` | `#26513F` | Header, tombol utama, tab aktif |
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

## Lebar layar

Kolom aplikasi dikunci **512px** di semua ukuran layar. Navigasi bawah
berlebar **430px** dan tetap melayang di dasar layar.

Tidak ada layout desktop: di layar besar, kolom tetap sempit di tengah
dengan gutter putih di kiri dan kanan.

| Lebar | Yang menyesuaikan |
|---|---|
| `< 300px` | Ukuran font nav dan sel kalender dikecilkan |
| `300–480px` | Padding konten, tinggi baris kalender, dan jarak bawah nav dirapatkan |
| `≥ 768px` | Navigasi diberi radius atas dan bayangan tipis |
| Tinggi `< 560px` | tinggi sheet, progress bar, dan grafik dikurangi |

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
sehingga terlihat **gutter putih di kiri dan kanan**. Di bawah 512px kolom
mengisi layar penuh sehingga tidak ada gutter.

## Navigasi

Lima tab di bawah: **Jadwal · Cabang · Paket · Riwayat · Profil**

Navigasi tetap berada di dasar layar pada semua ukuran layar — tidak pernah
berubah menjadi sidebar.

## Fitur yang terimplementasi

**Jadwal** — dari atas ke bawah:

- *Baris atas* — pill cabang (dengan caret, bisa diklik untuk memutar 8 cabang)
  dan status "● Studio Buka • jam operasional" yang ikut berubah per cabang
- *Kartu paket* — kartu hijau tua berisi nama paket + badge AKTIF, masa berlaku,
  cakupan kelas, sisa sesi, tombol **Top Up Sesi**, dan progress bar
- *Kalender* — judul "Oktober 2026" + tautan **Lihat Kalender** yang membuka
  date picker bulanan, lalu deret 7 hari berbentuk kartu. Hari terpilih jadi
  hijau tua; setiap hari punya **titik hijau** sebagai penanda masih ada slot
  kosong (mengikuti filter cabang & tipe aktif)

### Date picker

Tautan "Lihat Kalender" membuka bottom sheet berisi kalender bulan penuh.

**Tanggal lampau tidak bisa dipilih, tanggal masa depan bisa** — pelanggan
mem-booking jauh sebelum hari jadwal. Batasnya 90 hari ke depan
(`HORIZON_HARI` di `data.js`), dan sheet menampilkan batas tersebut di
bawah legenda.

| Elemen | Perilaku |
|---|---|
| Navigasi ‹ › | Pindah bulan; disembunyikan bila bulan itu tidak ada tanggal yang bisa dipilih |
| Tanggal lampau | Nonaktif (`disabled`), tampil redup, `aria-label` berbunyi "sudah lewat" |
| Tanggal masa depan | Aktif sampai `HORIZON_HARI` ke depan |
| Warna sel | Hijau muda = ada slot · krem = penuh/waitlist · abu-abu = sudah lewat |
| Garis bawah | Menandai hari ini |
| Legenda | Menjelaskan ketiga warna |

Setiap sel punya `aria-label` berisi tanggal dan jumlah slot, misalnya
*"13 Oktober 2026, 25 slot tersedia"*.

Deret 7 hari di bawah strip tidak lagi tombol mati: saat tanggal dipilih
melalui date picker, strip ikut bergeser ke minggu tersebut supaya tanggal
terpilih tetap terlihat.

**Data kelas untuk minggu-minggu berikutnya** dibangkitkan dari
`JADWAL_MINGGUAN` melalui `seedFutureClasses()`, memakai pola tetap
(seed berbasis indeks) supaya isi tampilan tidak berubah tiap kali halaman
dimuat ulang. Pada implementasi nyata, bagian ini diganti dengan data dari
server.
- *Filter tipe* — Semua Kelas · Reformer · Mat Flow · Cadillac · Prenatal
- *Kartu kelas* — jam + durasi terhitung ("50 Menit • Reformer Studio A"),
  pil "⊕ Sisa 2 dari 6 slot", judul besar, tag level + "Dapat kuota paket",
  instruktur dengan peran (Lead Reformer Coach dll), dan tombol Book Seat

Perubahan state pada halaman ini: memfilter tipe atau memilih hari akan
me-render ulang deret kalender (titik ikut berubah) dan daftar kelas.

**Cabang** — 8 studio di Jabodetabek. Kartu berisi: area hero
dengan badge *Flagship Studio*, overlay "Buka Hari Ini" + jam operasional dan
jarak, nama studio dengan tag status, alamat, chip fasilitas
(Reformer Beds / Private Suites / Valet Parking / Shower), lalu footer dengan
tombol **Lihat Jadwal (N Sesi)** dan tombol ikon peta.

Ikon peta membuka Google Maps di tab baru lewat URL pencarian berdasarkan alamat:
`https://www.google.com/maps/search/?api=1&query=<alamat>`

Angka pada tombol "Lihat Jadwal (N Sesi)" dihitung dari data kelas,
bukan angka statis.

**Paket** — daftar paket aktif dengan progress bar, masa berlaku, harga per sesi · ketentuan kelas

**Riwayat** — aktivitas pemesanan (selesai / dibatalkan / terjual / menunggu)

**Profil** — data keanggotaan, poin hadiah, menu akun

**Lain-lain** — branch switcher di header (memutar 8 cabang) · toast notifikasi ·
semantic HTML + `aria-current`/`aria-pressed` · fokus keyboard terlihat ·
`prefers-reduced-motion`

---

## Placeholder yang perlu diganti

| Selector | Sekarang | Ganti dengan |
|---|---|---|
| `.branch-card__hero` | Gradien + tekstur | `background-image: url(...)` |
| `.avatar--ring` | Inisial huruf | `<img src="...">` di `classCard()` pada `js/app.js` |

Untuk avatar, tambahkan `instructorPhoto` ke tiap entri `CLASSES` di `data.js`,
lalu tambahkan `object-fit: cover` agar foto tidak tergencet.

Data cabang (alamat, nomor telepon, jam buka, jarak) juga masih contoh —
ganti dengan data sebenarnya.

---

## Fitur yang belum ada

1. **Halaman admin** — kelola jadwal, kapasitas, paket, dan absensi (UI-nya belum dibuat)
2. **Halaman merchandise** — etalase e-commerce
3. **Pencarian kelas** — state `search` sudah ada di `app.js`, tinggal ditambahkan input
4. **State persisten** — saat ini reset saat reload; bisa pakai `localStorage`
5. **Integrasi backend** — ganti `data.js` dengan fetch ke REST API
