/* ==========================================================================
   Data dummy — mencerminkan fitur yang dirancang pada skripsi
   (multi-branch class booking, real-time quota, waitlist, payment gateway)
   ========================================================================== */

const BRANCHES = [
  { id: 'all',      name: 'Semua Cabang' },
  { id: 'senopati', name: 'Senopati Sanctuary' },
  { id: 'menteng',  name: 'Menteng' },
  { id: 'pik',      name: 'PIK Avenue' },
  { id: 'kemang',   name: 'Kemang' },
  { id: 'simatupang', name: 'TB Simatupang' }
];

const CLASS_TYPES = [
  { id: 'all',      label: 'Semua Kelas' },
  { id: 'reformer', label: 'Reformer' },
  { id: 'mat',      label: 'Mat Floor' },
  { id: 'cadillac', label: 'Cadillac' },
  { id: 'prenatal', label: 'Prenatal' }
];

const INSTRUCTORS = [
  { id: 'all',    name: 'Semua Instruktur' },
  { id: 'sarah',  name: 'Sarah Adistya' },
  { id: 'nadia',  name: 'Nadia Prasetyo' },
  { id: 'karin',  name: 'Karin Utami' },
  { id: 'wahyu',  name: 'Wahyu Nugroho' },
  { id: 'gaga',   name: 'Gaga Permana' },
  { id: 'malik',  name: 'Malik Hidayat' }
];

/* ==========================================================================
   Kalender & date picker

   Tanggal lampau tidak dapat dipilih (kelas sudah lewat), tetapi tanggal
   masa depan tetap bisa — pelanggan mem-booking jauh sebelum hari jadwal.
   ========================================================================== */
const HORIZON_HARI = 90;          // berapa hari ke depan boleh di-booking
const STRIP_PANJANG = 7;          // berapa tanggal yang terlihat di strip kalender

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/* Versi tiga huruf, untuk baris ringkas seperti ringkasan riwayat.
   "Mei" tetap penuh karena tiga hurufnya juga "Mei". */
const BULAN_SINGKAT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

const HARI_MINGGU = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const pad = n => String(n).padStart(2, '0');

/** Ubah "YYYY-MM-DD" menjadi objek Date waktu lokal. */
const toDate = key => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Ubah objek Date menjadi "YYYY-MM-DD". */
const toKey = dt => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;

/* "Hari ini" diambil dari tanggal sistem, bukan tanggal yang ditulis mati.
   Kalau ditulis mati, kalender akan perlahan berbohong: tanggal yang sudah
   lewat masih terbuka untuk dipilih, dan penanda hari ini ikut tertinggal di
   tanggal lama begitu aplikasi dibuka beberapa hari kemudian.

   Zona waktu memakai waktu lokal browser, sama seperti toKey() di atas, jadi
   "hari ini" di kalender selalu sama dengan tanggal yang dilihat pengguna. */
const CAL_TODAY = toKey(new Date());

const CAL_MAX = (() => {
  const d = toDate(CAL_TODAY);
  d.setDate(d.getDate() + HORIZON_HARI);
  return toKey(d);
})();

/** Batas bawah = hari ini. Semua tanggal sebelum itu sudah lewat. */
const CAL_MIN = CAL_TODAY;

/** Tanggal relatif terhadap hari ini: hari(-1) kemarin, hari(0) hari ini. */
const hari = n => {
  const d = toDate(CAL_TODAY);
  d.setDate(d.getDate() + n);
  return toKey(d);
};

/** Objek Date n hari dari hari ini; negatif berarti sudah lewat.
    Pakai ini kalau butuh tanggalnya, bukan hanya kuncinya. */
const tanggalRelatif = n => {
  const d = toDate(CAL_TODAY);
  d.setDate(d.getDate() + n);
  return d;
};

/** "8 Okt 2026" -- bentuk ringkas untuk baris riwayat dan masa berlaku. */
const ringkasTanggal = d => `${d.getDate()} ${BULAN_SINGKAT[d.getMonth()]} ${d.getFullYear()}`;

/** "6281261637438" -> "+62 812-3456-7890".
    Nomor disimpan di database dalam format E.164 supaya bisa dibandingkan
    dan dicari; bentuknya tidak enak dibaca, jadi ditata hanya saat ditampilkan.
    Kalau bukan 13 digit berawalan 62, dikembalikan apa adanya -- lebih baik
    menampilkan angka mentah daripada nomor yang dipotong salah. */
function formatTelepon(raw) {
  if (!raw) return '';
  const d = String(raw).replace(/\D/g, '');
  if (d.length !== 13 || !d.startsWith('62')) return String(raw);
  return `+62 ${d.slice(2, 5)}-${d.slice(5, 9)}-${d.slice(9)}`;
}

/** True bila tanggal boleh dipilih (tidak lampau, masih dalam horizon). */
function isSelectable(key) {
  return key >= CAL_MIN && key <= CAL_MAX;
}

/**
 * Deret STRIP_PANJANG hari untuk strip kalender di halaman Jadwal, dimulai
 * dari fromKey. fromKey adalah awal jendela, bukan tanggal terpilih. Kalau
 * yang dipakai adalah tanggal terpilih, strip akan bergeser setiap kali
 * pengguna memilih tanggal lain.
 */
function stripDays(fromKey) {
  const start = toDate(fromKey || CAL_TODAY);
  const out = [];
  for (let i = 0; i < STRIP_PANJANG; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    out.push({
      key: toKey(d),
      day: HARI_MINGGU[d.getDay()],
      date: String(d.getDate()),
      month: NAMA_BULAN[d.getMonth()]
    });
  }
  return out;
}

const CLASSES = [
  {
    id: 'c1', day: hari(1),
    start: '08:00', end: '08:50',
    name: 'Reformer Sculpt & Core',
    type: 'reformer',
    level: 'Beginner/Intermediate',
    instructor: 'Sarah Adistya',
    branch: 'Senopati Sanctuary', branchId: 'senopati', studio: 'Studio A',
    capacity: 6, taken: 4, waitlist: 0,
    usesPackage: true
  },
  {
    id: 'c2', day: hari(1),
    start: '10:00', end: '10:50',
    name: 'Cadillac Posture Alignment',
    type: 'cadillac',
    level: 'Intermediate',
    instructor: 'Nadia Prasetyo',
    branch: 'Senopati Sanctuary', branchId: 'senopati', studio: 'Studio B',
    capacity: 4, taken: 4, waitlist: 1,
    usesPackage: false
  },
  {
    id: 'c3', day: hari(1),
    start: '16:30', end: '17:20',
    name: 'Core & Fluid Flow',
    type: 'mat',
    level: 'All Levels',
    instructor: 'Karin Utami',
    branch: 'Senopati Sanctuary', branchId: 'senopati', studio: 'Studio B',
    capacity: 8, taken: 4, waitlist: 0,
    usesPackage: true
  },
  {
    id: 'c4', day: hari(1),
    start: '19:00', end: '19:50',
    name: 'Mat Floor Basics',
    type: 'mat',
    level: 'Beginner',
    instructor: 'Wahyu Nugroho',
    branch: 'Senopati Sanctuary', branchId: 'senopati', studio: 'Studio A',
    capacity: 10, taken: 2, waitlist: 0,
    usesPackage: true
  },
  {
    id: 'c5', day: hari(2),
    start: '12:15', end: '13:05',
    name: 'Prenatal Pilates',
    type: 'prenatal',
    level: 'All Levels',
    instructor: 'Gaga Permana',
    branch: 'Senopati Sanctuary', branchId: 'senopati', studio: 'Studio C',
    capacity: 4, taken: 3, waitlist: 0,
    usesPackage: true
  },
  {
    id: 'c6', day: hari(2),
    start: '18:00', end: '18:50',
    name: 'Reformer Power Flow',
    type: 'reformer',
    level: 'Intermediate',
    instructor: 'Malik Hidayat',
    branch: 'PIK Avenue', branchId: 'pik', studio: 'Studio A',
    capacity: 6, taken: 1, waitlist: 0,
    usesPackage: true
  },
  {
    id: 'c7', day: hari(3),
    start: '07:30', end: '08:20',
    name: 'Reformer Morning Flow',
    type: 'reformer',
    level: 'All Levels',
    instructor: 'Sarah Adistya',
    branch: 'Senopati Sanctuary', branchId: 'senopati', studio: 'Studio A',
    capacity: 6, taken: 0, waitlist: 0,
    usesPackage: true
  },
  {
    id: 'c8', day: hari(3),
    start: '09:15', end: '10:05',
    name: 'Core & Mobility',
    type: 'mat',
    level: 'Beginner',
    instructor: 'Nadia Prasetyo',
    branch: 'Kemang', branchId: 'kemang', studio: 'Studio 1',
    capacity: 12, taken: 5, waitlist: 0,
    usesPackage: true
  },
  {
    id: 'c9', day: hari(4),
    start: '17:30', end: '18:20',
    name: 'Cadillac Full Body',
    type: 'cadillac',
    level: 'Advanced',
    instructor: 'Karin Utami',
    branch: 'Menteng', branchId: 'menteng', studio: 'Studio B',
    capacity: 4, taken: 2, waitlist: 0,
    usesPackage: false
  },
  {
    id: 'c10', day: hari(5),
    start: '08:30', end: '09:20',
    name: 'Weekend Reformer Reset',
    type: 'reformer',
    level: 'All Levels',
    instructor: 'Gaga Permana',
    branch: 'TB Simatupang', branchId: 'simatupang', studio: 'Studio A',
    capacity: 6, taken: 3, waitlist: 0,
    usesPackage: true
  }
  ,
  {
    id: 'c11', day: hari(1),
    start: '07:00', end: '07:50',
    name: 'Grand Indonesia Morning Flow',
    type: 'reformer',
    level: 'All Levels',
    instructor: 'Sarah Adistya',
    branch: 'Grand Indonesia', branchId: 'grandindonesia', studio: 'Studio A',
    capacity: 8, taken: 3, waitlist: 0,
    usesPackage: true
  },
  {
    id: 'c12', day: hari(1),
    start: '11:00', end: '11:50',
    name: 'Sunter Mat Mobility',
    type: 'mat',
    level: 'Beginner',
    instructor: 'Wahyu Nugroho',
    branch: 'Sunter', branchId: 'sunter', studio: 'Studio 1',
    capacity: 10, taken: 4, waitlist: 0,
    usesPackage: true
  },
  {
    id: 'c13', day: hari(2),
    start: '09:30', end: '10:20',
    name: 'Prenatal Pilates Bekasi',
    type: 'prenatal',
    level: 'All Levels',
    instructor: 'Gaga Permana',
    branch: 'Bekasi', branchId: 'bekasi', studio: 'Studio B',
    capacity: 4, taken: 2, waitlist: 0,
    usesPackage: true
  },
  {
    id: 'c14', day: hari(2),
    start: '17:00', end: '17:50',
    name: 'BSD Cadillac Strength',
    type: 'cadillac',
    level: 'Intermediate',
    instructor: 'Karin Utami',
    branch: 'BSD', branchId: 'bsd', studio: 'Studio A',
    capacity: 4, taken: 1, waitlist: 0,
    usesPackage: false
  },
  {
    id: 'c15', day: hari(3),
    start: '10:00', end: '10:50',
    name: 'Grand Indonesia Core & Posture',
    type: 'mat',
    level: 'All Levels',
    instructor: 'Nadia Prasetyo',
    branch: 'Grand Indonesia', branchId: 'grandindonesia', studio: 'Studio B',
    capacity: 12, taken: 6, waitlist: 0,
    usesPackage: true
  },
  {
    id: 'c16', day: hari(3),
    start: '15:00', end: '15:50',
    name: 'Bekasi Reformer Strength',
    type: 'reformer',
    level: 'Intermediate',
    instructor: 'Malik Hidayat',
    branch: 'Bekasi', branchId: 'bekasi', studio: 'Studio A',
    capacity: 5, taken: 2, waitlist: 0,
    usesPackage: true
  },
  {
    id: 'c17', day: hari(4),
    start: '08:30', end: '09:20',
    name: 'BSD Mat Basics',
    type: 'mat',
    level: 'Beginner',
    instructor: 'Gaga Permana',
    branch: 'BSD', branchId: 'bsd', studio: 'Studio B',
    capacity: 10, taken: 3, waitlist: 0,
    usesPackage: true
  },
  {
    id: 'c18', day: hari(5),
    start: '11:30', end: '12:20',
    name: 'Sunter Weekend Reformer',
    type: 'reformer',
    level: 'All Levels',
    instructor: 'Karin Utami',
    branch: 'Sunter', branchId: 'sunter', studio: 'Studio 1',
    capacity: 4, taken: 1, waitlist: 0,
    usesPackage: true
  },
  {
    id: 'c19', day: hari(6),
    start: '09:00', end: '09:50',
    name: 'Bekasi Sunday Reset',
    type: 'mat',
    level: 'All Levels',
    instructor: 'Sarah Adistya',
    branch: 'Bekasi', branchId: 'bekasi', studio: 'Studio A',
    capacity: 10, taken: 5, waitlist: 0,
    usesPackage: true
  },
  {
    id: 'c20', day: hari(6),
    start: '10:30', end: '11:20',
    name: 'BSD Reformer Power',
    type: 'reformer',
    level: 'Advanced',
    instructor: 'Nadia Prasetyo',
    branch: 'BSD', branchId: 'bsd', studio: 'Studio A',
    capacity: 6, taken: 4, waitlist: 0,
    usesPackage: true
  },

  /* Bintaro. Jumlah dan waktunya masih contoh -- koreksi sesuai jadwal asli.
     taken sengaja varies 0 / 1 / penuh supaya ketiga bentuk badge (Tersedia,
     Sisa, Penuh) langsung kelihatan di cabang ini saja. */
  {
    id: 'c21', day: hari(1),
    start: '07:30', end: '08:20',
    name: 'Bintaro Reformer Sculpt',
    type: 'reformer',
    level: 'All Levels',
    instructor: 'Sarah Adistya',
    branch: 'Bintaro', branchId: 'bintaro', studio: 'Studio A',
    capacity: 6, taken: 0, waitlist: 0,
    usesPackage: true
  },
  {
    id: 'c22', day: hari(3),
    start: '17:00', end: '17:50',
    name: 'Bintaro Tower Strength',
    type: 'tower',
    level: 'Intermediate',
    instructor: 'Nadia Prasetyo',
    branch: 'Bintaro', branchId: 'bintaro', studio: 'Studio B',
    capacity: 3, taken: 1, waitlist: 0,
    usesPackage: true
  },
  {
    id: 'c23', day: hari(5),
    start: '09:15', end: '10:05',
    name: 'Bintaro Cadillac Reset',
    type: 'cadillac',
    level: 'All Levels',
    instructor: 'Karin Utami',
    branch: 'Bintaro', branchId: 'bintaro', studio: 'Studio A',
    capacity: 4, taken: 4, waitlist: 1,
    usesPackage: false
  }
];

/* Jadwal berulang untukPekan-pekan berikutnya, supaya tanggal masa depan
   tidak kosong. Pola studio pada umumnya berulang tiap minggu. */
const JADWAL_MINGGUAN = [
  { hari: 1, start: '08:00', end: '08:50', name: 'Reformer Sculpt & Core',
    type: 'reformer', level: 'Beginner/Intermediate', instructor: 'Sarah Adistya',
    branch: 'Senopati Sanctuary', branchId: 'senopati', studio: 'Studio A',
    capacity: 6, usesPackage: true },
  { hari: 2, start: '10:00', end: '10:50', name: 'Cadillac Posture Alignment',
    type: 'cadillac', level: 'Intermediate', instructor: 'Nadia Prasetyo',
    branch: 'Senopati Sanctuary', branchId: 'senopati', studio: 'Studio B',
    capacity: 4, usesPackage: false },
  { hari: 2, start: '16:30', end: '17:20', name: 'Core & Fluid Flow',
    type: 'mat', level: 'All Levels', instructor: 'Karin Utami',
    branch: 'Senopati Sanctuary', branchId: 'senopati', studio: 'Studio B',
    capacity: 8, usesPackage: true },
  { hari: 3, start: '18:00', end: '18:50', name: 'Reformer Power Flow',
    type: 'reformer', level: 'Intermediate', instructor: 'Malik Hidayat',
    branch: 'PIK Avenue', branchId: 'pik', studio: 'Studio A',
    capacity: 6, usesPackage: true },
  { hari: 4, start: '07:30', end: '08:20', name: 'Reformer Morning Flow',
    type: 'reformer', level: 'All Levels', instructor: 'Sarah Adistya',
    branch: 'Senopati Sanctuary', branchId: 'senopati', studio: 'Studio A',
    capacity: 6, usesPackage: true },
  { hari: 5, start: '17:30', end: '18:20', name: 'Cadillac Full Body',
    type: 'cadillac', level: 'Advanced', instructor: 'Karin Utami',
    branch: 'Menteng', branchId: 'menteng', studio: 'Studio B',
    capacity: 4, usesPackage: false },
  { hari: 6, start: '08:30', end: '09:20', name: 'Weekend Reformer Reset',
    type: 'reformer', level: 'All Levels', instructor: 'Gaga Permana',
    branch: 'TB Simatupang', branchId: 'simatupang', studio: 'Studio A',
    capacity: 6, usesPackage: true },
  { hari: 0, start: '09:00', end: '09:50', name: 'Sunday Mat Reset',
    type: 'mat', level: 'All Levels', instructor: 'Wahyu Nugroho',
    branch: 'Senopati Sanctuary', branchId: 'senopati', studio: 'Studio A',
    capacity: 10, usesPackage: true }
];

/* Bangun kelas untuk tanggal masa depan dari JADWAL_MINGGUAN.
   Kapasitas terisi dibuat bergilir agar tampak seperti data nyata. */
(function seedFutureClasses() {
  let n = 0;
  const mulai = toDate(CAL_TODAY);

  for (let offset = 0; offset <= HORIZON_HARI; offset++) {
    const d = new Date(mulai);
    d.setDate(d.getDate() + offset);
    const key = toKey(d);

    JADWAL_MINGGUAN
      .filter(p => p.hari === d.getDay())
      .forEach(p => {
        n++;
        // Pola Pseudo-random yang stabil supaya tampilan tidak berubah tiap muat
        const seed = (n * 37 + offset * 11) % 100;
        const taken = Math.min(p.capacity, Math.floor((seed / 100) * (p.capacity + 1)));
        const waitlist = taken === p.capacity && seed % 3 === 0 ? 1 : 0;

        CLASSES.push({
          id: 'f' + n,
          day: key,
          start: p.start, end: p.end,
          name: p.name,
          type: p.type,
          level: p.level,
          instructor: p.instructor,
          branch: p.branch, branchId: p.branchId, studio: p.studio,
          capacity: p.capacity, taken, waitlist,
          usesPackage: p.usesPackage
        });
      });
  }
})();

/* Masa berlaku mengikuti aturan di database (packages.validity_days):
   paket 10 sesi 180 hari, paket group 90 hari. Dihitung dari hari ini, bukan
   ditulis sebagai tanggal mati -- kalau mati, kartu paket akan tetap menulis
   "Exp. 28 Nov 2026" bahkan setelah tanggal itu lewat, padahal statusnya
   masih Aktif. */
const VALIDITAS_HARI = { p10: 180, p5: 90 };

/* Paket yang dimiliki pengguna.

   validityDays disimpan di sini, bukan diturunkan dari expires, karena
   expires disimpan sebagai teks ringkas ("8 Okt 2026") untuk langsung
   ditampilkan. Kalau top up perlu memperpanjang masa berlaku, teks itu
   harus diurai dulu -- dan mengurai tanggal dari teks yang sudah diformat
   menghasilkan tanggal yang rapuh. Angkanya yang disimpan; teksnya yang
   diturunkan. */
const PACKAGES = [
  {
    id: 'p10',
    name: 'Paket 10 Sesi Pilates',
    status: 'Aktif',
    total: 10, remaining: 6,
    validityDays: VALIDITAS_HARI.p10,
    expires: ringkasTanggal(tanggalRelatif(VALIDITAS_HARI.p10)),
    includes: 'Termasuk Reformer & Cadillac',
    price: 3250000
  },
  {
    id: 'p5',
    name: 'Paket 5 Sesi Pilates Group',
    status: 'Habis',
    total: 5, remaining: 0,
    validityDays: VALIDITAS_HARI.p5,
    expires: ringkasTanggal(tanggalRelatif(VALIDITAS_HARI.p5)),
    includes: 'Termasuk Mat Flow',
    price: 1750000
  }
];

/* Peran instruktur — dipakai pada kartu kelas ("Lead Reformer Coach" dll) */
const INSTRUCTOR_ROLES = {
  'Sarah Adistya':  'Lead Reformer Coach',
  'Nadia Prasetyo': 'Senior Reformer Coach',
  'Karin Utami':    'Master Pilates Certified',
  'Wahyu Nugroho':  'Mat Flow Specialist',
  'Gaga Permana':   'Prenatal & Gentle Coach',
  'Malik Hidayat':  'Reformer Strength Coach'
};

/* Nama tampilan tipe kelas */
const TYPE_LABELS = {
  reformer: 'Reformer',
  mat:      'Mat Flow',
  cadillac: 'Cadillac',
  prenatal: 'Prenatal',
  tower:    'Tower'
};

const DROPIN_PRICE = 375000;

/* Katalog top up sesi — prototype.

   Berdampingan dengan PACKAGES, bukan bagiannya: paket yang dibeli orang
   adalah paket utuh dengan masa berlaku sendiri, sedangkan top up menambah
   kuota ke paket yang sudah dimiliki. Jadi katalognya terpisah, dan ui
   menampilkan efeknya ("bertambah N sesi ke Paket 10 Sesi") sebagai
   keterangan, bukan sebagai syarat.

   Sesi ditambahkan ke paket AKTIF -- paket milik pengguna yang sedang
   berjalan, bukan paket sembarangan. Kalau paket aktif sudah habis
   kuotanya, tombol top up tetap boleh dipakai: sisa sesi nol bukan
   berarti paket sudah tutup, dan masa berlakunya masih memberi ruang
   untuk menambah kuota.

   Badge hemat dihitung dari DROPIN_PRICE, bukan ditulis tangan, supaya
   tidak bisa melenceng dari harga yang benar-benar ditampilkan. Diskonto
   selalu terhadap harga sesi satuan drop-in, bukan terhadap harga paket,
   supaya angkanya bisa dibandingkan apples to apples.

   Letakkan setelah DROPIN_PRICE karena pemetaan di bawah membacanya; const
   tidak bisa dibaca sebelum baris deklarasinya. */
const TOPUP_OPTIONS = [
  {
    id: 'tu5',
    name: 'Top Up 5 Sesi',
    tag: 'Top Up',
    sessions: 5,
    price: 1625000,
    validDays: 90,
    includes: [
      'Bertambah 5 sesi pada paket aktif',
      'Berlaku 90 hari sejak dibayar',
      'Bisa dipakai semua kelas group'
    ]
  },
  {
    id: 'tu10',
    name: 'Top Up 10 Sesi',
    tag: 'Top Up',
    sessions: 10,
    price: 3000000,
    validDays: 180,
    popular: true,
    includes: [
      'Bertambah 10 sesi pada paket aktif',
      'Berlaku 180 hari sejak dibayar',
      'Bisa dibagikan ke 1 teman'
    ]
  },
  {
    id: 'tu20',
    name: 'Top Up 20 Sesi',
    tag: 'Top Up',
    sessions: 20,
    price: 5400000,
    validDays: 365,
    includes: [
      'Bertambah 20 sesi pada paket aktif',
      'Berlaku 365 hari sejak dibayar',
      'Gratis 1 sesi FREE Freeze Kuota'
    ]
  }
].map(t => ({ ...t, hemat: Math.round((1 - (t.price / t.sessions) / DROPIN_PRICE) * 100) }));

/* Data cabang - placeholder prototype.
   Ganti dengan data resmi dari The Body Project sebelum dipakai.

   cover: foto studio. Berkasnya di assets/branches/ dengan nama mengikuti
   id cabang, sudah diperkecil ke lebar maksimal 1200px supaya tidak membebani
   repo. Ganti fotonya cukup ubah path di sini.

   Motif abstrak di app.js tetap menggantung di belakang foto sebagai cadangan:
   gambar yang gagal dimuat dilepas sendiri, jadi kartu tidak pernah tampil
   dengan kotak rusak.

   Catatan: foto-foto ini milik studio masing-masing, belum foto resmi dari
   The Body Project. Ganti dengan foto asli sebelum dipakai. */
const BRANCH_DETAILS = [
  {
    id: 'senopati',
    name: 'Senopati Sanctuary',
    area: 'Jakarta Selatan',
    address: 'Jl. Senopati No. 42, Kebayoran Baru, Jakarta Selatan',
    hours: '06.30 – 20.30 WIB',
    phone: '+62 21 0000 0001',
    distance: '1.2 km',
    cover: 'assets/branches/senopati.jpg',
    status: 'Aktif',
    flag: true,
    facilities: [
      { icon: '⊞', label: '10 Reformer Beds' },
      { icon: '◫', label: '2 Private Suites' },
      { icon: '⚑', label: 'Valet Parking' },
      { icon: '◠', label: 'Rainforest Shower' }
    ]
  },
  {
    id: 'simatupang',
    name: 'TB Simatupang',
    area: 'Jakarta Selatan',
    address: 'Jl. TB Simatupang No. 18, Cilandak, Jakarta Selatan',
    hours: '06.30 – 20.30 WIB',
    phone: '+62 21 0000 0002',
    distance: '4.8 km',
    cover: 'assets/branches/simatupang.jpg',
    status: 'Aktif',
    facilities: [
      { icon: '⊞', label: '6 Reformer Beds' },
      { icon: '⚑', label: 'Valet Parking' }
    ]
  },
  {
    id: 'kemang',
    name: 'Kemang',
    area: 'Jakarta Selatan',
    address: 'Jl. Kemang Raya No. 7, Jakarta Selatan',
    hours: '07.00 – 21.00 WIB',
    phone: '+62 21 0000 0003',
    distance: '3.5 km',
    cover: 'assets/branches/kemang.jpg',
    status: 'Aktif',
    facilities: [
      { icon: '⊞', label: '6 Reformer Beds' },
      { icon: '◫', label: '1 Private Suite' },
      { icon: '⚑', label: 'Free Parking' }
    ]
  },
  {
    id: 'grandindonesia',
    name: 'Grand Indonesia',
    area: 'Jakarta Utara',
    address: 'Jl. Asia Afrika No. 3, Jakarta Pusat',
    hours: '06.00 – 21.00 WIB',
    phone: '+62 21 0000 0004',
    distance: '9.1 km',
    cover: 'assets/branches/grandindonesia.jpg',
    status: 'Aktif',
    facilities: [
      { icon: '⊞', label: '8 Reformer Beds' },
      { icon: '◫', label: '2 Private Suites' },
      { icon: '⚑', label: 'Valet Parking' }
    ]
  },
  {
    id: 'pik',
    name: 'PIK Avenue',
    area: 'Jakarta Utara',
    address: 'Jl. Ravel No. 1, Penjaringan, Jakarta Utara',
    hours: '06.30 – 20.30 WIB',
    phone: '+62 21 0000 0005',
    distance: '16.4 km',
    cover: 'assets/branches/pik.jpg',
    status: 'Aktif',
    facilities: [
      { icon: '⊞', label: '5 Reformer Beds' },
      { icon: '⚑', label: 'Free Parking' }
    ]
  },
  {
    id: 'sunter',
    name: 'Sunter',
    area: 'Jakarta Utara',
    address: 'Jl. MH Thamrin No. 155, Sunter, Jakarta Utara',
    hours: '07.00 – 20.00 WIB',
    phone: '+62 21 0000 0006',
    distance: '12.9 km',
    cover: 'assets/branches/sunter.jpg',
    status: 'Aktif',
    facilities: [
      { icon: '⊞', label: '4 Reformer Beds' },
      { icon: '◫', label: '1 Private Suite' }
    ]
  },
  {
    id: 'bekasi',
    name: 'Bekasi',
    area: 'Bekasi',
    address: 'Jl. Rukan Sentra Niaga 3 No.6, Jaka Setia, Bekasi',
    mapsUrl: 'https://www.google.com/maps/place/The+Body+Project+Galaxy/@-6.2751828,106.9740888,17z/data=!3m1!4b1!4m6!3m5!1s0x2e698d001feec333:0x19f204279cf1c5d6!8m2!3d-6.2751828!4d106.9740888!16s%2Fg%2F11lyjb0msz',
    hours: '06.30 – 20.30 WIB',
    phone: '+62 21 0000 0007',
    distance: '21.3 km',
    cover: 'assets/branches/bekasi.jpg',
    status: 'Aktif',
    facilities: [
      { icon: '⊞', label: '5 Reformer Beds' },
      { icon: '◫', label: '1 Private Suite' },
      { icon: '⚑', label: 'Free Parking' }
    ]
  },
  {
    id: 'bsd',
    name: 'BSD',
    area: 'Tangerang Selatan',
    address: 'Lengkong Kulon, Kec. Pagedangan, Kabupaten Tangerang',
    mapsUrl: 'https://www.google.com/maps/place/The+Body+Project+BSD/@-6.2889035,106.6396704,17z/data=!3m1!4b1!4m6!3m5!1s0x2e69fb29923e4177:0x8da9d608e29e53dc!8m2!3d-6.2889035!4d106.6396704!16s%2Fg%2F11kq7v638d',
    hours: '06.30 – 21.00 WIB',
    phone: '+62 21 0000 0008',
    distance: '28.6 km',
    cover: 'assets/branches/bsd.jpg',
    status: 'Aktif',
    facilities: [
      { icon: '⊞', label: '6 Reformer Beds' },
      { icon: '◫', label: '2 Private Suites' },
      { icon: '⚑', label: 'Free Parking' }
    ]
  },
  {
    // Tanpa phone: cabang ini tidak punya nomor yang bisa ditampilkan, dan
    // kolom phone tidak pernah dibaca app.js -- jadi tidak diisi apa pun,
    // bukan diisi placeholder.
    id: 'bintaro',
    name: 'Bintaro',
    area: 'Tangerang Selatan',
    address: 'Jl. Boulevard Bintaro Jaya No.10, Sektor 7, Tangerang Selatan',
    mapsUrl: 'https://www.google.com/maps/place/The+Body+Project+Bintaro+Studio/@-6.2738935,106.710822,17z/data=!3m1!4b1!4m6!3m5!1s0x2e69fb22f8011c8b:0xc6f5afd3eb3c624e!8m2!3d-6.2738935!4d106.710822',
    hours: '07.00 – 17.00 WIB',
    distance: '24.2 km',
    cover: 'assets/branches/bintaro.jpg',
    status: 'Aktif',
    facilities: [
      { icon: '⊞', label: '4 Reformer Beds' },
      { icon: '◫', label: '1 Tower Unit' },
      { icon: '⌂', label: 'Ruko Kebayoran Arcade 3' }
    ]
  }
];

const PAYMENT_METHODS = [
  { id: 'qris',  label: 'QRIS',            logo: '▦', desc: 'Scan QR di kasir' },
  { id: 'bca',   label: 'BCA Virtual Acct', logo: '◫', desc: 'Transfer bank' },
  { id: 'gopay', label: 'GoPay / OVO',     logo: '◉', desc: 'Dompet digital' },
  { id: 'card',  label: 'Kartu Kredit',     logo: '▤', desc: 'Visa / Mastercard' }
];

const CUSTOMER = {
  name: 'Anindya Kirana',
  email: 'anindya@kranulo.com',
  phone: '+62 812-3456-7890',
  memberSince: '5 Mei 2026',
  tier: 'Pengguna / Staff'
};

/* Ringkasan riwayat. Tanggal ditulis sebagai jumlah hari dari hari ini, bukan
   tanggal mati -- kalau ditulis mati, riwayatnya akan tertinggal di Oktober
   2026 padahal aplikasi sudah dipakai berbulan-bulan. */
const riwayatSesi = (cabang, hari, sesi) =>
  `${cabang} · ${ringkasTanggal(tanggalRelatif(hari))} · Sesi ke-${sesi}`;

const HISTORY = [
  { id: 'h1', icon: '✓', title: 'Reformer Sculpt & Core', sub: riwayatSesi('Senopati', -8, 5),  side: 'Selesai',    sideType: 'done' },
  { id: 'h2', icon: '✓', title: 'Mat Floor Basics',       sub: riwayatSesi('Senopati', -11, 4), side: 'Selesai',    sideType: 'done' },
  { id: 'h3', icon: '✗', title: 'Core & Fluid Flow',      sub: riwayatSesi('Senopati', -14, 3), side: 'Dibatalkan', sideType: 'void' },
  { id: 'h4', icon: '✓', title: 'Reformer Power Flow',    sub: riwayatSesi('Senopati', -17, 2), side: 'Selesai',    sideType: 'done' }
];

const POLICIES = [
  'Pembatalan gratis hingga H-3 jam sebelum kelas dimulai.',
  'Sesi tidak terpakai pada paket yang kedaluwarsa tidak dapat dipindahtangankan.',
  'Mohon hadir 10 menit sebelum sesi untuk pem Briefing bersama instruktur.',
  'Tersedia matras,Resistance band, dan hand towel di setiap studio.'
];
