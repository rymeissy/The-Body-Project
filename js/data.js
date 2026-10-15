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
   DATA_MIN dipakai sebagai "hari ini" pada prototype; pada implementasi
   nyata nilai ini diambil dari tanggal sistem.
   ========================================================================== */
const DATA_MIN = '2026-10-12';
const HORIZON_HARI = 90;          // berapa hari ke depan boleh di-booking

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
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

const CAL_MAX = (() => {
  const d = toDate(DATA_MIN);
  d.setDate(d.getDate() + HORIZON_HARI);
  return toKey(d);
})();

const CAL_MIN = DATA_MIN;
const CAL_TODAY = DATA_MIN;   // "hari ini" pada prototype

/** True bila tanggal boleh dipilih (tidak lampau, masih dalam horizon). */
function isSelectable(key) {
  return key >= CAL_MIN && key <= CAL_MAX;
}

/**
 * Deret 7 hari untuk strip kalender di halaman Jadwal.
 * Selalu dimulai dari tanggal yang sedang dipilih agar tanggal itu
 * tetap terlihat setelah dipilih lewat date picker.
 */
function stripDays(fromKey) {
  const start = toDate(fromKey || CAL_TODAY);
  const out = [];
  for (let i = 0; i < 7; i++) {
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
    id: 'c1', day: '2026-10-13',
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
    id: 'c2', day: '2026-10-13',
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
    id: 'c3', day: '2026-10-13',
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
    id: 'c4', day: '2026-10-13',
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
    id: 'c5', day: '2026-10-14',
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
    id: 'c6', day: '2026-10-14',
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
    id: 'c7', day: '2026-10-15',
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
    id: 'c8', day: '2026-10-15',
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
    id: 'c9', day: '2026-10-16',
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
    id: 'c10', day: '2026-10-17',
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
    id: 'c11', day: '2026-10-13',
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
    id: 'c12', day: '2026-10-13',
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
    id: 'c13', day: '2026-10-14',
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
    id: 'c14', day: '2026-10-14',
    start: '17:00', end: '17:50',
    name: 'BSD Cadillac Strength',
    type: 'cadillac',
    level: 'Intermediate',
    instructor: 'Karin Utami',
    branch: 'Tangerang Selatan', branchId: 'tangerang', studio: 'Studio A',
    capacity: 4, taken: 1, waitlist: 0,
    usesPackage: false
  },
  {
    id: 'c15', day: '2026-10-15',
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
    id: 'c16', day: '2026-10-15',
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
    id: 'c17', day: '2026-10-16',
    start: '08:30', end: '09:20',
    name: 'Tangerang Mat Basics',
    type: 'mat',
    level: 'Beginner',
    instructor: 'Gaga Permana',
    branch: 'Tangerang Selatan', branchId: 'tangerang', studio: 'Studio B',
    capacity: 10, taken: 3, waitlist: 0,
    usesPackage: true
  },
  {
    id: 'c18', day: '2026-10-17',
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
    id: 'c19', day: '2026-10-18',
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
    id: 'c20', day: '2026-10-18',
    start: '10:30', end: '11:20',
    name: 'BSD Reformer Power',
    type: 'reformer',
    level: 'Advanced',
    instructor: 'Nadia Prasetyo',
    branch: 'Tangerang Selatan', branchId: 'tangerang', studio: 'Studio A',
    capacity: 6, taken: 4, waitlist: 0,
    usesPackage: true
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

const PACKAGES = [
  {
    id: 'p10',
    name: 'Paket 10 Sesi Pilates',
    status: 'Aktif',
    total: 10, remaining: 6,
    expires: '28 Nov 2026',
    includes: 'Termasuk Reformer & Cadillac',
    price: 3250000
  },
  {
    id: 'p5',
    name: 'Paket 5 Sesi Pilates Group',
    status: 'Habis',
    total: 5, remaining: 0,
    expires: '5 Nov 2026',
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
  prenatal: 'Prenatal'
};

const DROPIN_PRICE = 375000;

/* Data cabang — placeholder prototype.
/* Data cabang — placeholder prototype.
   Ganti dengan data resmi dari The Body Project sebelum dipakai. */
const BRANCH_DETAILS = [
  {
    id: 'senopati',
    name: 'Senopati Sanctuary',
    area: 'Jakarta Selatan',
    address: 'Jl. Senopati No. 42, Kebayoran Baru, Jakarta Selatan',
    hours: '06.30 – 20.30 WIB',
    phone: '+62 21 0000 0001',
    distance: '1.2 km',
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
    address: 'Jl. Ahmad Yani No. 65, Bekasi',
    hours: '06.30 – 20.30 WIB',
    phone: '+62 21 0000 0007',
    distance: '21.3 km',
    status: 'Aktif',
    facilities: [
      { icon: '⊞', label: '5 Reformer Beds' },
      { icon: '◫', label: '1 Private Suite' },
      { icon: '⚑', label: 'Free Parking' }
    ]
  },
  {
    id: 'tangerang',
    name: 'Tangerang Selatan',
    area: 'Tangerang Selatan',
    address: 'Jl. BSD Utama No. 1, BSD City, Tangerang Selatan',
    hours: '06.30 – 21.00 WIB',
    phone: '+62 21 0000 0008',
    distance: '28.6 km',
    status: 'Aktif',
    facilities: [
      { icon: '⊞', label: '6 Reformer Beds' },
      { icon: '◫', label: '2 Private Suites' },
      { icon: '⚑', label: 'Free Parking' }
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

const HISTORY = [
  { id: 'h1', icon: '✓', title: 'Reformer Sculpt & Core', sub: 'Senopati · 8 Okt 2026 · Sesi ke-5', side: 'Selesai', sideType: 'done' },
  { id: 'h2', icon: '✓', title: 'Mat Floor Basics',       sub: 'Senopati · 5 Okt 2026 · Sesi ke-4', side: 'Selesai', sideType: 'done' },
  { id: 'h3', icon: '✕', title: 'Core & Fluid Flow',      sub: 'Senopati · 2 Okt 2026 · Sesi ke-3', side: 'Dibatalkan', sideType: 'void' },
  { id: 'h4', icon: '✓', title: 'Reformer Power Flow',    sub: 'Senopati · 29 Sep 2026 · Sesi ke-2', side: 'Selesai', sideType: 'done' }
];

const POLICIES = [
  'Pembatalan gratis hingga H-3 jam sebelum kelas dimulai.',
  'Sesi tidak terpakai pada paket yang kedaluwarsa tidak dapat dipindahtangankan.',
  'Mohon hadir 10 menit sebelum sesi untuk pem Briefing bersama instruktur.',
  'Tersedia matras,Resistance band, dan hand towel di setiap studio.'
];
