-- =============================================================================
--  The Body Project - booking system
--  Seed data
--
--  Mirrors js/data.js so the prototype and the database agree on vocabulary:
--  branch codes, instructor names, class titles, package names, and the
--  four payment methods. The 21 class templates are checked field by field
--  against JADWAL_MINGGUAN there.
--
--  There is no password anywhere, here or in the schema. Customers sign in
--  with a phone number and a one-time code; verify.sql test 21 asserts that
--  no password_hash column exists.
--
--  Intended for an empty database only. It inserts reference rows without
--  truncating first, so running it twice would duplicate them -- rebuild with
--  "docker compose down -v && docker compose up -d" instead.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Reference
-- -----------------------------------------------------------------------------

-- 'tower' was added to match TYPE_LABELS in js/data.js. The Bintaro timetable
-- uses it, so without the row here the class_templates join below would silently
-- drop that pattern.
INSERT INTO class_types (code, label, sort_order) VALUES
    ('reformer', 'Reformer', 1),
    ('mat',      'Mat Flow', 2),
    ('cadillac', 'Cadillac',  3),
    ('prenatal', 'Prenatal',  4),
    ('tower',    'Tower',    5);

INSERT INTO payment_methods (code, label, description) VALUES
    ('qris',  'QRIS',            'Scan QR di kasir'),
    ('bca',   'BCA Virtual Acct', 'Transfer bank'),
    ('gopay', 'GoPay / OVO',     'Dompet digital'),
    ('card',  'Kartu Kredit',     'Visa / Mastercard');

INSERT INTO class_policies (body, sort_order) VALUES
    ('Pembatalan gratis hingga H-3 jam sebelum kelas dimulai.', 1),
    ('Sesi tidak terpakai pada paket yang kedaluwarsa tidak dapat dipindahtangankan.', 2),
    ('Mohon hadir 10 menit sebelum sesi untuk briefing bersama instruktur.', 3),
    ('Tersedia matras, resistance band, dan hand towel di setiap studio.', 4);

-- -----------------------------------------------------------------------------
-- Branches
-- -----------------------------------------------------------------------------

-- The seven branches that actually exist, in the order the front-end lists them.
-- Every field here is copied from BRANCH_DETAILS in js/data.js -- name, area,
-- address, hours, and distance_km -- so the database and the prototype cannot
-- drift apart. Bintaro, Sampoerna Strategic, and Pondok Indah are new; the four
-- that used to be here (senopati, simatupang, grandindonesia, pik) plus
-- tangerang-as-a-separate-code are gone. bsd replaces tangerang: same city,
-- same distance, but "BSD" is how the studio and Maps actually call it.
--
-- is_flagship is false everywhere on purpose. app.js can render a flagship badge
-- (b.flag), but no branch in BRANCH_DETAILS sets flag, so flagging one here
-- would put a badge on screen that the data does not justify.
--
-- phone is NULL for the three newest branches because the front-end has no
-- number for them, and an invented placeholder number would be worse than none.
INSERT INTO branches (code, name, area, address, phone, opens_at, closes_at, distance_km, is_flagship) VALUES
    ('kemang',       'Kemang',               'Jakarta Selatan',   'Jl. Kemang Selatan 11 No.77, Bangka',                       '+62 21 0000 0003', '07:00', '21:00',  3.50, false),
    ('sunter',       'Sunter',               'Jakarta Utara',     'Jl. Danau Sunter Utara No.9B Lt.3, Sunter',                 '+62 21 0000 0006', '07:00', '20:00', 12.90, false),
    ('sampoerna',    'Sampoerna Strategic',  'Jakarta Selatan',   'Sampoerna Strategic Square, Jl. Jenderal Sudirman No.45-46', NULL,               '07:30', '20:30',  4.60, false),
    ('pondokindah',  'Pondok Indah',         'Jakarta Selatan',   'Jl. Gedung Hijau Raya No.1A, Pd. Pinang',                    NULL,               '07:00', '20:00',  8.40, false),
    ('bintaro',      'Bintaro',              'Tangerang Selatan', 'Jl. Boulevard Bintaro Jaya No.10, Sektor 7, Tangerang Selatan', NULL,          '07:00', '17:00', 24.20, false),
    ('bekasi',       'Bekasi',               'Bekasi',            'Jl. Rukan Sentra Niaga 3 No.6, Jaka Setia, Bekasi',          '+62 21 0000 0007', '06:30', '20:30', 21.30, false),
    ('bsd',          'BSD',                  'Tangerang Selatan', 'Lengkong Kulon, Kec. Pagedangan, Kabupaten Tangerang',        '+62 21 0000 0008', '06:30', '21:00', 28.60, false);

-- Only the label is stored. The glyph shown on the facility chip is chosen by
-- the front-end, not by the database.
--
-- Copied from the facilities array of each branch in BRANCH_DETAILS. Note
-- Bintaro, Sampoerna, and Pondok Indah advertise a Tower unit -- that is the
-- physical reason the 'tower' class type exists.
INSERT INTO branch_facilities (branch_id, label)
SELECT b.id, f.label
FROM (VALUES
    ('kemang',       '6 Reformer Beds'),
    ('kemang',       '1 Private Suite'),
    ('kemang',       'Free Parking'),
    ('sunter',       '4 Reformer Beds'),
    ('sunter',       '1 Private Suite'),
    ('sampoerna',    '4 Reformer Beds'),
    ('sampoerna',    '1 Private Suite'),
    ('sampoerna',    'Valet Parking'),
    ('pondokindah',  '4 Reformer Beds'),
    ('pondokindah',  '1 Tower Unit'),
    ('pondokindah',  'Gedung Hijau Raya'),
    ('bintaro',      '4 Reformer Beds'),
    ('bintaro',      '1 Tower Unit'),
    ('bintaro',      'Ruko Kebayoran Arcade 3'),
    ('bekasi',       '5 Reformer Beds'),
    ('bekasi',       '1 Private Suite'),
    ('bekasi',       'Free Parking'),
    ('bsd',          '6 Reformer Beds'),
    ('bsd',          '2 Private Suites'),
    ('bsd',          'Free Parking')
) AS f(branch_code, label)
JOIN branches b ON b.code = f.branch_code;

-- Only the studios the weekly timetable actually uses, so no empty studio rows
-- pile up. Taken straight from the studio field of the 21 timetable patterns.
INSERT INTO studios (branch_id, name)
SELECT b.id, s.name
FROM (VALUES
    ('kemang',       'Studio 1'),
    ('sunter',       'Studio 1'),
    ('sampoerna',    'Studio 1'),
    ('sampoerna',    'Studio A'),
    ('sampoerna',    'Studio B'),
    ('pondokindah',  'Studio 1'),
    ('pondokindah',  'Studio A'),
    ('bintaro',      'Studio A'),
    ('bintaro',      'Studio B'),
    ('bekasi',       'Studio A'),
    ('bekasi',       'Studio B'),
    ('bsd',          'Studio A'),
    ('bsd',          'Studio B')
) AS s(branch_code, name)
JOIN branches b ON b.code = s.branch_code;

-- -----------------------------------------------------------------------------
-- Instructors
-- -----------------------------------------------------------------------------

INSERT INTO instructors (name, role_title, email) VALUES
    ('Sarah Adistya',  'Lead Reformer Coach',       'sarah.adistya@tbp.id'),
    ('Nadia Prasetyo', 'Senior Reformer Coach',     'nadia.prasetyo@tbp.id'),
    ('Karin Utami',    'Master Pilates Certified',  'karin.utami@tbp.id'),
    ('Wahyu Nugroho',  'Mat Flow Specialist',       'wahyu.nugroho@tbp.id'),
    ('Gaga Permana',   'Prenatal & Gentle Coach',   'gaga.permana@tbp.id'),
    ('Malik Hidayat',  'Reformer Strength Coach',   'malik.hidayat@tbp.id');

-- -----------------------------------------------------------------------------
-- Accounts
-- -----------------------------------------------------------------------------

-- The demo customer from js/data.js (CUSTOMER).
INSERT INTO users (role, full_name, name_confirmed, email, phone, member_since, membership_tier)
VALUES ('customer', 'Anindya Kirana', true, 'anindya@kranulo.com', '6281234567890',
        '2026-05-05', 'Pengguna / Staff');

-- Extra customers so the capacity figures are not all zero.
INSERT INTO users (role, full_name, name_confirmed, email, phone, member_since, membership_tier) VALUES
    ('customer', 'Ratu Yuri Meissy',  true, 'ratuyuri@binus.ac.id',  '6281155551001', '2026-04-12', 'Pengguna / Staff'),
    ('customer', 'Dimas Rachman Hakim',true, 'dimas@binus.ac.id',     '6281155551002', '2026-06-02', 'Pengguna / Staff'),
    ('customer', 'Abdul Hafizh',      true, 'hafizh@binus.ac.id',     '6281155551003', '2026-07-19', 'Pengguna / Staff'),
    ('customer', 'Sarah Melinda',     true, 'sarah.melinda@mail.com', '6281155551004', '2026-05-28', 'Pengguna / Staff'),
    ('customer', 'Bagas Prakoso',     true, 'bagas@mail.com',        '6281155551005', '2026-08-14', 'Pengguna / Staff'),
    ('customer', 'Nadia Puspita',     true, 'nadia.puspita@mail.com','6281155551006', '2026-09-01', 'Pengguna / Staff'),
    ('customer', 'Rizky Firmansyah',  true, 'rizky@mail.com',        '6281155551007', '2026-06-23', 'Pengguna / Staff'),
    ('customer', 'Bagas Wicaksono',   true, 'wicak@mail.com',        '6281155551008', '2026-10-03', 'Pengguna / Staff'),
    ('customer', 'Fajar Nugroho',     true, 'fajar@mail.com',        '6281155551009', '2026-07-30', 'Pengguna / Staff'),
    ('customer', 'Dewi Lestari',      true, 'dewi@mail.com',         '6281155551010', '2026-05-16', 'Pengguna / Staff'),
    ('customer', 'Yoga Pratama',      true, 'yoga@mail.com',         '6281155551011', '2026-09-10', 'Pengguna / Staff'),
    ('customer', 'Intan Permata',     true, 'intan@mail.com',        '6281155551012', '2026-08-21', 'Pengguna / Staff');

INSERT INTO users (role, full_name, name_confirmed, email, phone, membership_tier)
VALUES ('admin', 'Admin The Body Project', true, 'admin@tbp.id', '6281199999999', 'Staff');

-- Seeded accounts are already phone-verified and already named, so signing in
-- with any of their numbers goes straight into the app — the name form never
-- appears for them.
UPDATE users SET phone_verified_at = now();

-- -----------------------------------------------------------------------------
-- Packages
-- -----------------------------------------------------------------------------

INSERT INTO packages (code, name, total_sessions, price, includes_text, validity_days, dropin_price) VALUES
    ('p10', 'Paket 10 Sesi Pilates',       10, 3250000, 'Termasuk Reformer & Cadillac', 180, 375000),
    ('p5',  'Paket 5 Sesi Pilates Group',    5, 1750000, 'Termasuk Mat Flow',            90, 375000);

-- Anindya Kirana: 6 of 10 left, expires 28 Nov 2026 (as in data.js).
INSERT INTO customer_packages (customer_id, package_id, total_sessions, remaining_sessions, price_paid, purchased_at, expires_at)
SELECT u.id, p.id, 10, 6, 3250000, '2026-05-05 10:00+07', '2026-11-28 23:59:59+07'
FROM users u, packages p
WHERE u.email = 'anindya@kranulo.com' AND p.code = 'p10';

-- The second package is already spent, matching data.js where Paket 5 Sesi
-- shows status "Habis".
INSERT INTO customer_packages (customer_id, package_id, total_sessions, remaining_sessions, price_paid, purchased_at, expires_at, status)
SELECT u.id, p.id, 5, 0, 1750000, '2026-07-15 10:00+07', '2026-11-05 23:59:59+07', 'Habis'
FROM users u, packages p
WHERE u.email = 'anindya@kranulo.com' AND p.code = 'p5';

-- Give the other customers a mix of remaining and exhausted quotas.
INSERT INTO customer_packages
    (customer_id, package_id, total_sessions, remaining_sessions,
     price_paid, purchased_at, expires_at, status)
SELECT
    u.id,
    p.id,
    10,
    ((u.id * 3) % 11)                              AS left,
    3250000,
    '2026-06-01 10:00+07',
    '2026-12-15 23:59:59+07',
    CASE WHEN (u.id * 3) % 11 = 0 THEN 'Habis' ELSE 'Aktif' END
FROM users u
JOIN packages p ON p.code = 'p10'
WHERE u.role = 'customer'
  AND u.email <> 'anindya@kranulo.com';

-- -----------------------------------------------------------------------------
-- Weekly templates
--
-- Mirrors JADWAL_MINGGUAN in js/data.js exactly -- same 21 patterns, same
-- weekdays, same times, same instructors, same capacities. weekday is
-- 0 = Sunday, matching JavaScript's Date.getDay().
--
-- The old eight patterns all belonged to branches that no longer exist, and the
-- old seed quietly "fixed" one of them by moving a dangling 'menteng' class to
-- Kemang. That workaround is gone: every pattern below now points at a branch
-- that exists, so the two files can be diffed against each other without
-- exceptions.
-- -----------------------------------------------------------------------------

INSERT INTO class_templates
    (branch_id, studio_id, class_type_code, instructor_id, weekday,
     starts_at, ends_at, title, level, capacity, uses_package)
SELECT
    b.id, st.id, t.class_type_code, i.id, t.weekday,
    t.starts_at::time, t.ends_at::time, t.title, t.level, t.capacity, t.uses_package
FROM (VALUES
    -- Senin
    ('bintaro',      'Studio A', 'reformer', 'Sarah Adistya',  1, '07:30', '08:20', 'Bintaro Reformer Sculpt',       'All Levels',            6, true),
    ('sunter',       'Studio 1', 'mat',      'Wahyu Nugroho',  1, '11:00', '11:50', 'Sunter Mat Mobility',           'Beginner',             10, true),
    ('sampoerna',    'Studio A', 'reformer', 'Sarah Adistya',  1, '19:00', '19:50', 'Sampoerna Reformer Flow',       'Intermediate',          6, true),
    -- Selasa
    ('pondokindah',  'Studio 1', 'mat',      'Gaga Permana',   2, '08:00', '08:50', 'Pondok Indah Mat Basics',       'Beginner',             10, true),
    ('bekasi',       'Studio A', 'reformer', 'Malik Hidayat',  2, '15:00', '15:50', 'Bekasi Reformer Strength',      'Intermediate',          5, true),
    ('bsd',          'Studio A', 'cadillac', 'Karin Utami',    2, '17:00', '17:50', 'BSD Cadillac Strength',         'Intermediate',          4, false),
    -- Rabu
    ('kemang',       'Studio 1', 'mat',      'Nadia Prasetyo', 3, '09:15', '10:05', 'Kemang Core & Mobility',        'Beginner',             12, true),
    ('sampoerna',    'Studio B', 'cadillac', 'Karin Utami',    3, '10:00', '10:50', 'Sampoerna Cadillac Alignment',  'Intermediate',          4, false),
    ('bintaro',      'Studio B', 'tower',    'Nadia Prasetyo', 3, '17:00', '17:50', 'Bintaro Tower Strength',        'Intermediate',          3, true),
    -- Kamis
    ('bsd',          'Studio B', 'mat',      'Gaga Permana',   4, '08:30', '09:20', 'BSD Mat Basics',                'Beginner',             10, true),
    ('bekasi',       'Studio B', 'prenatal', 'Gaga Permana',   4, '09:30', '10:20', 'Bekasi Prenatal Pilates',       'All Levels',            4, true),
    ('pondokindah',  'Studio A', 'reformer', 'Nadia Prasetyo', 4, '18:30', '19:20', 'Pondok Indah Reformer Power',   'Intermediate',          6, true),
    -- Jumat
    ('bintaro',      'Studio A', 'cadillac', 'Karin Utami',    5, '09:15', '10:05', 'Bintaro Cadillac Reset',        'All Levels',            4, false),
    ('sunter',       'Studio 1', 'reformer', 'Karin Utami',    5, '11:30', '12:20', 'Sunter Weekend Reformer',       'All Levels',            4, true),
    ('kemang',       'Studio 1', 'reformer', 'Sarah Adistya',  5, '19:00', '19:50', 'Kemang Reformer Sculpt',        'Beginner/Intermediate', 6, true),
    -- Sabtu
    ('sampoerna',    'Studio 1', 'mat',      'Wahyu Nugroho',  6, '08:00', '08:50', 'Sampoerna Mat Flow',            'All Levels',           10, true),
    ('bekasi',       'Studio A', 'mat',      'Sarah Adistya',  6, '09:00', '09:50', 'Bekasi Weekend Reset',          'All Levels',           10, true),
    ('bsd',          'Studio A', 'reformer', 'Nadia Prasetyo', 6, '10:30', '11:20', 'BSD Reformer Power',            'Advanced',              6, true),
    -- Minggu
    ('bintaro',      'Studio A', 'reformer', 'Sarah Adistya',  0, '07:30', '08:20', 'Bintaro Reformer Morning',      'All Levels',            6, true),
    ('sunter',       'Studio 1', 'reformer', 'Malik Hidayat',  0, '08:00', '08:50', 'Sunter Sunday Reset',            'Intermediate',          6, true),
    ('pondokindah',  'Studio 1', 'mat',      'Gaga Permana',   0, '09:00', '09:50', 'Pondok Indah Mat Flow',         'All Levels',           10, true)
) AS t(branch_code, studio_name, class_type_code, instructor_name, weekday,
       starts_at, ends_at, title, level, capacity, uses_package)
JOIN branches    b  ON b.code   = t.branch_code
JOIN studios     st ON st.name  = t.studio_name AND st.branch_id = b.id
JOIN instructors i  ON i.name    = t.instructor_name;

-- -----------------------------------------------------------------------------
-- Sessions
--
-- Generate the same 90-day horizon the prototype uses (HORIZON_HARI = 90),
-- anchored on the server's own today rather than a date written into this file.
-- data.js does the same thing with CAL_TODAY = toKey(new Date()); a hardcoded
-- '2026-10-12' would leave the two drifting apart every time the seed is rerun.
--
-- Thirty days of history is generated as well, because the past-bookings block
-- below needs finished sessions to attach to.
-- -----------------------------------------------------------------------------

SELECT fn_generate_sessions(CURRENT_DATE - 30, CURRENT_DATE + 90) AS sessions_created;

-- -----------------------------------------------------------------------------
-- Demo bookings
--
-- Enough bookings that the capacity badges are not all "Sisa 6 dari 6 slot".
-- These go in through the normal INSERT path so the deferred counter trigger
-- keeps booked_count in step.
--
-- They do NOT go through fn_book_session, which is where package quota is
-- normally spent. That is a deliberate choice for volume, but it means the seed
-- has to do the quota bookkeeping itself, and it has to get the allocation
-- right: a customer holding three sessions left cannot be handed ten bookings
-- that all claim to come out of that package.
-- -----------------------------------------------------------------------------

-- Finished bookings in the past, so the History screen is not empty.
--
-- This runs before the demo bookings on purpose. Anindya's package starts with
-- six sessions left, these three come out of it, and the demo allocation below
-- has to see the smaller number or it will hand her bookings that her quota
-- cannot cover. That is also why remaining_sessions starts at 6 of 10 rather
-- than 10. cancelled_at is set in the same INSERT because of the table CHECK.
INSERT INTO bookings (code, customer_id, session_id, customer_package_id,
                      customer_name, status, amount, booked_at, checked_in_at, cancelled_at)
SELECT
    fn_next_booking_code(),
    u.id,
    s.id,
    (SELECT cp.id
       FROM customer_packages cp
       JOIN packages p ON p.id = cp.package_id
      WHERE cp.customer_id = u.id AND p.code = 'p10'),
    u.full_name,
    CASE WHEN v.n = 3 THEN 'Dibatalkan' ELSE 'Hadir' END,
    0,
    s.starts_at - interval '3 days',
    CASE WHEN v.n = 3 THEN NULL ELSE s.starts_at + interval '2 minutes' END,
    CASE WHEN v.n = 3 THEN s.starts_at - interval '1 day' ELSE NULL END
FROM (VALUES (1, 'bintaro'), (2, 'sunter'), (3, 'bekasi')) AS v(n, branch_code)
CROSS JOIN users u
JOIN branches bh ON bh.code = v.branch_code
JOIN LATERAL (
    SELECT s2.id, s2.starts_at
    FROM class_sessions s2
    WHERE s2.branch_id = bh.id
      AND s2.starts_at < now()
      AND s2.starts_at > now() - interval '20 days'
    ORDER BY s2.starts_at DESC
    LIMIT 1 OFFSET (v.n - 1)
) s ON true
WHERE u.email = 'anindya@kranulo.com';

UPDATE customer_packages cp
   SET remaining_sessions = cp.remaining_sessions - t.terpakai,
       status = CASE WHEN cp.remaining_sessions - t.terpakai = 0 THEN 'Habis'
                     ELSE cp.status END
  FROM (
      SELECT bk.customer_package_id, count(*) AS terpakai
      FROM bookings bk
      JOIN users u2 ON u2.id = bk.customer_id
      WHERE bk.customer_package_id IS NOT NULL
        AND u2.email = 'anindya@kranulo.com'
        AND bk.status IN ('Hadir', 'Dibatalkan')
      GROUP BY bk.customer_package_id
  ) t
 WHERE cp.id = t.customer_package_id;

-- Spread bookings across all seven branches, not just one. The old seed only
-- filled Senopati, which would have left the other six showing a completely
-- empty timetable in the demo -- the prototype shows varied quota on every
-- branch, and the database should not contradict it.
--
-- Three upcoming sessions per branch is enough to produce every quota state the
-- badges need without inflating the bookings table to the size of the whole
-- 90-day timetable. Each class gets a realistic spread of attendees, and every
-- booking either spends a package quota or pays the drop-in price, so the
-- bookings table CHECK always holds.
--
-- No id-based thinning here. The old seed used `s.id % 3 <> 0` to spread things
-- out, which was invisible when only Senopati mattered but silently wiped out
-- every other branch: session ids rise by a multiple of three from one day to
-- the next, so a branch's three earliest sessions always share the same residue.
-- Sunter ended up with 38 upcoming classes and not one booking.
WITH target_sessions AS (
    SELECT session_id, capacity, uses_package, starts_at, branch_id, rn
    FROM (
        SELECT s.id           AS session_id,
               s.capacity,
               s.uses_package,
               s.starts_at,
               s.branch_id,
               row_number() OVER (PARTITION BY s.branch_id ORDER BY s.starts_at) AS rn
        FROM class_sessions s
        WHERE s.starts_at > now()
    ) per_branch
    WHERE per_branch.rn <= 3
),
-- Three fill levels, so all three badge states appear on every branch:
--   rn = 1   right up      -> "Penuh"
--   rn = 2   one seat left -> "Sisa 1"
--   rn = 3   about half    -> plainly "Tersedia"
--
-- The first rule partitions by branch, giving one full class per branch -- seven
-- in total. The old seed filled only two classes in the whole database (one per
-- payment kind), which left most branches unable to show a "Penuh" badge at all
-- and left verify.sql with nowhere to test the waitlist. A real studio has a
-- dependable class in every location, so one each is also the honest picture.
ranked AS (
    SELECT session_id,
           capacity,
           uses_package,
           branch_id,
           rn,
           row_number() OVER (PARTITION BY branch_id ORDER BY starts_at) AS rn_awal_cabang
    FROM target_sessions
),
seats AS (
    SELECT r.session_id,
           r.uses_package,
           n,
           CASE
               WHEN r.rn_awal_cabang = 1 THEN r.capacity
               WHEN r.rn = 2               THEN r.capacity - 1
               ELSE greatest(2, r.capacity / 2)
           END AS seats_to_fill
    FROM ranked r
    CROSS JOIN LATERAL generate_series(1, r.capacity) AS n
),
-- Rotate which customers fill which session, so nobody attends every class.
-- The old seed matched seat n to customer id n, which put customer 1 in every
-- session and left verify.sql with no full class its test customer could join.
pelanggan AS (
    SELECT u.id,
           u.full_name,
           row_number() OVER (ORDER BY u.id) AS no
    FROM users u
    WHERE u.role = 'customer'
),
kursi AS (
    SELECT s.session_id,
           s.n,
           s.seats_to_fill,
           s.uses_package,
           p.id AS customer_id,
           p.full_name
    FROM seats s
    CROSS JOIN pelanggan p
    WHERE p.no = (s.n + s.session_id) % (SELECT count(*) FROM pelanggan) + 1
),
-- Number each customer's package-eligible seats in booking order, so the nth one
-- gets the nth slice of quota.
butuh_paket AS (
    SELECT k.*,
           count(*) OVER (PARTITION BY k.customer_id
                          ORDER BY k.session_id, k.n) AS urut
    FROM kursi k
    WHERE k.uses_package
),
-- Give every active package a slot range carved out of the quota that is
-- actually left: [sebelum + 1 .. sebelum + remaining_sessions].
--
-- This is the part the old seed got wrong. It handed every seat the customer's
-- first package with remaining_sessions > 0 and never counted how many were
-- already attached to it, so a customer with six sessions left ended up with
-- twelve bookings all pointing at the same package. Nothing complained at seed
-- time -- the CHECK only fires on the next decrement or refund -- but cancelling
-- one of those bookings then pushed remaining_sessions above total_sessions.
sisa_kuota AS (
    SELECT package_id, customer_id, quota_demo,
           COALESCE(sum(quota_demo) OVER (
               PARTITION BY customer_id
               ORDER BY expires_at, package_id
               ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS sebelum
    FROM (
        SELECT p.id          AS package_id,
               p.customer_id,
               p.expires_at,
               -- The demo spends only about half of what each customer has
               -- left. Spending all of it would leave every profile reading
               -- "0 sesi tersisa", and would hand verify.sql no quota left to
               -- test a package booking with.
               greatest(1, p.remaining_sessions / 2) AS quota_demo
        FROM customer_packages p
        WHERE p.status = 'Aktif'
          AND p.expires_at > now()
    ) batas
),
assignments AS (
    SELECT k.session_id,
           k.n,
           k.seats_to_fill,
           k.uses_package,
           k.customer_id,
           k.full_name,
           -- A seat with no quota behind it falls back to paying drop-in, as
           -- does every third customer so both payment paths appear.
           (a.package_id IS NULL OR k.customer_id % 3 = 0) AS pays_dropin,
           a.package_id AS cp
    FROM kursi k
    LEFT JOIN (
        SELECT b.session_id, b.n, q.package_id
        FROM butuh_paket b
        LEFT JOIN sisa_kuota q
               ON q.customer_id = b.customer_id
              AND b.urut > q.sebelum
              AND b.urut <= q.sebelum + q.quota_demo
    ) a ON a.session_id = k.session_id AND a.n = k.n
)
INSERT INTO bookings (code, customer_id, session_id, customer_package_id,
                      customer_name, status, amount, payment_method_code, booked_at)
SELECT
    fn_next_booking_code(),
    a.customer_id,
    a.session_id,
    CASE WHEN NOT a.uses_package OR a.pays_dropin OR a.cp IS NULL
         THEN NULL ELSE a.cp END,
    a.full_name,
    'Terjual',
    CASE WHEN NOT a.uses_package OR a.pays_dropin OR a.cp IS NULL
         THEN 375000 ELSE 0 END,
    CASE WHEN NOT a.uses_package OR a.pays_dropin OR a.cp IS NULL
         THEN 'qris' ELSE NULL END,
    now() - make_interval(hours => a.customer_id::int)
FROM assignments a
WHERE a.n <= a.seats_to_fill;

-- Spend the package quota these bookings just claimed. This is what
-- fn_book_session does, skipped above because the rows go in by direct INSERT.
-- Counting the bookings afterwards is safer than decrementing as we go: the
-- allocation above already guarantees the count cannot exceed what is left, and
-- this UPDATE cannot push remaining_sessions below zero.
UPDATE customer_packages cp
   SET remaining_sessions = cp.remaining_sessions - t.terpakai,
       status = CASE WHEN cp.remaining_sessions - t.terpakai = 0 THEN 'Habis'
                     WHEN cp.status = 'Habis' THEN 'Aktif'
                     ELSE cp.status END
  FROM (
      SELECT bk.customer_package_id, count(*) AS terpakai
      FROM bookings bk
      WHERE bk.customer_package_id IS NOT NULL
        AND bk.status = 'Terjual'
      GROUP BY bk.customer_package_id
  ) t
 WHERE cp.id = t.customer_package_id;

-- Payments for the drop-in bookings just created.
INSERT INTO payments (booking_id, method_code, amount, status)
SELECT b.id, b.payment_method_code, b.amount, 'Berhasil'
FROM bookings b
WHERE b.amount > 0
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.booking_id = b.id);

-- Two customers on the waitlist of a full package-eligible class, matching
-- the "Penuh · Waitlist 2" badge on the class card.
WITH full_session AS (
    SELECT s.id AS session_id
    FROM class_sessions s
    WHERE s.starts_at > now()
      AND s.uses_package
      AND s.booked_count = s.capacity
      AND s.waitlist_count = 0
    ORDER BY s.starts_at
    LIMIT 1
),
queue AS (
    SELECT u.id AS customer_id,
           u.full_name,
           (SELECT cp.id
              FROM customer_packages cp
             WHERE cp.customer_id = u.id
               AND cp.status = 'Aktif'
               AND cp.remaining_sessions > 0
               AND cp.expires_at > now()
             ORDER BY cp.expires_at
             LIMIT 1) AS cp,
           row_number() OVER (ORDER BY u.id) AS pos
    FROM full_session f
    CROSS JOIN users u
    WHERE u.role = 'customer'
      AND EXISTS (SELECT 1 FROM customer_packages cp
                   WHERE cp.customer_id = u.id AND cp.status = 'Aktif'
                     AND cp.remaining_sessions > 0 AND cp.expires_at > now())
      AND NOT EXISTS (SELECT 1 FROM bookings bk
                       WHERE bk.session_id = f.session_id
                         AND bk.customer_id = u.id)
    LIMIT 2
)
INSERT INTO bookings (code, customer_id, session_id, customer_package_id,
                      customer_name, status, waitlist_position, amount, payment_method_code)
SELECT fn_next_booking_code(), q.customer_id, f.session_id, q.cp, q.full_name,
       'Menunggu Waitlist', q.pos, 0, NULL
FROM queue q
CROSS JOIN full_session f;

-- -----------------------------------------------------------------------------
-- Wrap up
--
-- Everything between the first session date and now is in the past, so close
-- it off. In production these two calls belong in a nightly job rather than
-- in the seed.
-- -----------------------------------------------------------------------------

SELECT fn_close_finished_sessions() AS sesi_yang_sudah_selesai;

COMMIT;

\echo '--- row counts ---'
SELECT 'branches'           AS tabel, count(*) FROM branches           UNION ALL
SELECT 'branch_facilities',         count(*) FROM branch_facilities   UNION ALL
SELECT 'studios',                   count(*) FROM studios             UNION ALL
SELECT 'instructors',               count(*) FROM instructors         UNION ALL
SELECT 'users',                     count(*) FROM users               UNION ALL
SELECT 'packages',                  count(*) FROM packages            UNION ALL
SELECT 'customer_packages',         count(*) FROM customer_packages   UNION ALL
SELECT 'class_templates',           count(*) FROM class_templates     UNION ALL
SELECT 'class_sessions',            count(*) FROM class_sessions      UNION ALL
SELECT 'bookings',                  count(*) FROM bookings            UNION ALL
SELECT 'payments',                  count(*) FROM payments            UNION ALL
SELECT 'booking_events',            count(*) FROM booking_events      ORDER BY 1;
