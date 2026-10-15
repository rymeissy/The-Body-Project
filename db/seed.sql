-- =============================================================================
--  The Body Project — booking system
--  Seed data
--
--  Mirrors js/data.js so the prototype and the database agree on vocabulary:
--  branch codes, instructor names, class titles, package names, and the
--  four payment methods.
--
--  Passwords are all "password123", stored as bcrypt via pgcrypto. This is
--  development data only.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Reference
-- -----------------------------------------------------------------------------

INSERT INTO class_types (code, label, sort_order) VALUES
    ('reformer', 'Reformer', 1),
    ('mat',      'Mat Flow', 2),
    ('cadillac', 'Cadillac',  3),
    ('prenatal', 'Prenatal',  4);

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

INSERT INTO branches (code, name, area, address, phone, opens_at, closes_at, distance_km, is_flagship) VALUES
    ('senopati',       'Senopati Sanctuary', 'Jakarta Selatan',    'Jl. Senopati No. 42, Kebayoran Baru, Jakarta Selatan',          '+62 21 0000 0001', '06:30', '20:30',  1.20, true),
    ('simatupang',     'TB Simatupang',      'Jakarta Selatan',    'Jl. TB Simatupang No. 18, Cilandak, Jakarta Selatan',        '+62 21 0000 0002', '06:30', '20:30',  4.80, false),
    ('kemang',         'Kemang',            'Jakarta Selatan',    'Jl. Kemang Raya No. 7, Jakarta Selatan',                          '+62 21 0000 0003', '07:00', '21:00',  3.50, false),
    ('grandindonesia', 'Grand Indonesia',    'Jakarta Utara',      'Jl. Asia Afrika No. 3, Jakarta Pusat',                           '+62 21 0000 0004', '06:00', '21:00',  9.10, false),
    ('pik',            'PIK Avenue',        'Jakarta Utara',      'Jl. Ravel No. 1, Penjaringan, Jakarta Utara',                     '+62 21 0000 0005', '06:30', '20:30', 16.40, false),
    ('sunter',         'Sunter',            'Jakarta Utara',      'Jl. MH Thamrin No. 155, Sunter, Jakarta Utara',                  '+62 21 0000 0006', '07:00', '20:00', 12.90, false),
    ('bekasi',         'Bekasi',            'Bekasi',             'Jl. Ahmad Yani No. 65, Bekasi',                                  '+62 21 0000 0007', '06:30', '20:30', 21.30, false),
    ('tangerang',      'Tangerang Selatan',  'Tangerang Selatan',  'Jl. BSD Utama No. 1, BSD City, Tangerang Selatan',               '+62 21 0000 0008', '06:30', '21:00', 28.60, false);

-- Only the label is stored. The glyph shown on the facility chip is chosen by
-- the front-end, not by the database.
INSERT INTO branch_facilities (branch_id, label)
SELECT b.id, f.label
FROM (VALUES
    ('senopati',       '10 Reformer Beds'),
    ('senopati',       '2 Private Suites'),
    ('senopati',       'Valet Parking'),
    ('senopati',       'Rainforest Shower'),
    ('simatupang',     '6 Reformer Beds'),
    ('simatupang',     'Valet Parking'),
    ('kemang',         '6 Reformer Beds'),
    ('kemang',         '1 Private Suite'),
    ('kemang',         'Free Parking'),
    ('grandindonesia', '8 Reformer Beds'),
    ('grandindonesia', '2 Private Suites'),
    ('grandindonesia', 'Valet Parking'),
    ('pik',            '5 Reformer Beds'),
    ('pik',            'Free Parking'),
    ('sunter',         '4 Reformer Beds'),
    ('sunter',         '1 Private Suite'),
    ('bekasi',         '5 Reformer Beds'),
    ('bekasi',         '1 Private Suite'),
    ('bekasi',         'Free Parking'),
    ('tangerang',      '6 Reformer Beds'),
    ('tangerang',      '2 Private Suites'),
    ('tangerang',      'Free Parking')
) AS f(branch_code, label)
JOIN branches b ON b.code = f.branch_code;

-- Only the studios the weekly timetable actually uses.
INSERT INTO studios (branch_id, name)
SELECT b.id, s.name
FROM (VALUES
    ('senopati',   'Studio A'),
    ('senopati',   'Studio B'),
    ('kemang',     'Studio B'),
    ('pik',        'Studio A'),
    ('simatupang', 'Studio A')
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
INSERT INTO users (role, full_name, email, phone, password_hash, member_since, membership_tier, loyalty_points)
VALUES ('customer', 'Anindya Kirana', 'anindya@kranulo.com', '+628123457890',
        crypt('password123', gen_salt('bf')), '2026-05-05', 'Pengguna / Staff', 340);

-- Extra customers so the capacity figures are not all zero.
INSERT INTO users (role, full_name, email, phone, password_hash, member_since, membership_tier) VALUES
    ('customer', 'Ratu Yuri Meissy',  'ratuyuri@binus.ac.id',  '+628115551001', crypt('password123', gen_salt('bf')), '2026-04-12', 'Pengguna / Staff'),
    ('customer', 'Dimas Rachman Hakim','dimas@binus.ac.id',     '+628115551002', crypt('password123', gen_salt('bf')), '2026-06-02', 'Pengguna / Staff'),
    ('customer', 'Abdul Hafizh',     'hafizh@binus.ac.id',     '+628115551003', crypt('password123', gen_salt('bf')), '2026-07-19', 'Pengguna / Staff'),
    ('customer', 'Sarah Melinda',    'sarah.melinda@mail.com', '+628115551004', crypt('password123', gen_salt('bf')), '2026-05-28', 'Pengguna / Staff'),
    ('customer', 'Bagas Prakoso',    'bagas@mail.com',        '+628115551005', crypt('password123', gen_salt('bf')), '2026-08-14', 'Pengguna / Staff'),
    ('customer', 'Nadia Puspita',    'nadia.puspita@mail.com','+628115551006', crypt('password123', gen_salt('bf')), '2026-09-01', 'Pengguna / Staff'),
    ('customer', 'Rizky Firmansyah', 'rizky@mail.com',        '+628115551007', crypt('password123', gen_salt('bf')), '2026-06-23', 'Pengguna / Staff'),
    ('customer', 'Bagas Wicaksono', 'wicak@mail.com',        '+628115551008', crypt('password123', gen_salt('bf')), '2026-10-03', 'Pengguna / Staff'),
    ('customer', 'Fajar Nugroho',    'fajar@mail.com',        '+628115551009', crypt('password123', gen_salt('bf')), '2026-07-30', 'Pengguna / Staff'),
    ('customer', 'Dewi Lestari',     'dewi@mail.com',         '+628115551010', crypt('password123', gen_salt('bf')), '2026-05-16', 'Pengguna / Staff'),
    ('customer', 'Yoga Pratama',     'yoga@mail.com',         '+628115551011', crypt('password123', gen_salt('bf')), '2026-09-10', 'Pengguna / Staff'),
    ('customer', 'Intan Permata',    'intan@mail.com',        '+628115551012', crypt('password123', gen_salt('bf')), '2026-08-21', 'Pengguna / Staff');

INSERT INTO users (role, full_name, email, phone, password_hash, membership_tier)
VALUES ('admin', 'Admin The Body Project', 'admin@tbp.id', '+628110000001',
        crypt('password123', gen_salt('bf')), 'Staff');

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
-- Mirrors JADWAL_MINGGUAN in js/data.js. weekday is 0 = Sunday, matching
-- JavaScript's Date.getDay().
--
-- One deliberate difference: data.js points the Friday Cadillac class at
-- branchId 'menteng', but BRANCH_DETAILS has no Menteng branch (it lists
-- Kemang instead), so that reference is dangling in the prototype. Here it
-- is assigned to Kemang. See the note in db/README.md.
-- -----------------------------------------------------------------------------

INSERT INTO class_templates
    (branch_id, studio_id, class_type_code, instructor_id, weekday,
     starts_at, ends_at, title, level, capacity, uses_package)
SELECT
    b.id, st.id, t.class_type_code, i.id, t.weekday,
    t.starts_at::time, t.ends_at::time, t.title, t.level, t.capacity, t.uses_package
FROM (VALUES
    ('senopati',   'Studio A', 'reformer', 'Sarah Adistya',  1, '08:00', '08:50', 'Reformer Sculpt & Core',   'Beginner/Intermediate',  6, true),
    ('senopati',   'Studio B', 'cadillac', 'Nadia Prasetyo', 2, '10:00', '10:50', 'Cadillac Posture Alignment','Intermediate',          4, false),
    ('senopati',   'Studio B', 'mat',      'Karin Utami',    2, '16:30', '17:20', 'Core & Fluid Flow',       'All Levels',             8, true),
    ('pik',        'Studio A', 'reformer', 'Malik Hidayat',  3, '18:00', '18:50', 'Reformer Power Flow',     'Intermediate',           6, true),
    ('senopati',   'Studio A', 'reformer', 'Sarah Adistya',  4, '07:30', '08:20', 'Reformer Morning Flow',   'All Levels',             6, true),
    ('kemang',     'Studio B', 'cadillac', 'Karin Utami',    5, '17:30', '18:20', 'Cadillac Full Body',      'Advanced',               4, false),
    ('simatupang', 'Studio A', 'reformer', 'Gaga Permana',   6, '08:30', '09:20', 'Weekend Reformer Reset', 'All Levels',             6, true),
    ('senopati',   'Studio A', 'mat',      'Wahyu Nugroho',  0, '09:00', '09:50', 'Sunday Mat Reset',       'All Levels',            10, true)
) AS t(branch_code, studio_name, class_type_code, instructor_name, weekday,
       starts_at, ends_at, title, level, capacity, uses_package)
JOIN branches    b  ON b.code   = t.branch_code
JOIN studios     st ON st.name  = t.studio_name AND st.branch_id = b.id
JOIN instructors i  ON i.name    = t.instructor_name;

-- -----------------------------------------------------------------------------
-- Sessions
--
-- Generate the same 90-day horizon the prototype uses (HORIZON_HARI = 90),
-- starting at the prototype's "today" so the earlier history exists too.
-- -----------------------------------------------------------------------------

SELECT fn_generate_sessions(DATE '2026-10-12', DATE '2027-01-09') AS sessions_created;

-- -----------------------------------------------------------------------------
-- Demo bookings
--
-- Enough bookings that the capacity badges are not all "Sisa 6 dari 6 slot".
-- These go in through the normal INSERT path so the deferred counter trigger
-- keeps booked_count in step.
-- -----------------------------------------------------------------------------

-- Fill a spread of upcoming Senopati sessions. Each class gets a realistic
-- spread of attendees, and every booking either spends a package quota or pays
-- the drop-in price, so the bookings table CHECK always holds.
WITH target_sessions AS (
    SELECT s.id           AS session_id,
           s.capacity,
           s.uses_package,
           s.starts_at
    FROM class_sessions s
    JOIN branches b ON b.id = s.branch_id
    WHERE b.code = 'senopati'
      AND s.starts_at > now()
      AND s.id % 3 <> 0
),
-- Fill the first session of each kind (package-eligible and not) right up, so
-- the waitlist has somewhere to attach and the "Penuh" badge is visible.
ranked AS (
    SELECT session_id,
           capacity,
           uses_package,
           row_number() OVER (PARTITION BY uses_package ORDER BY starts_at) AS rn
    FROM target_sessions
),
seats AS (
    SELECT r.session_id,
           r.uses_package,
           n,
           CASE WHEN r.rn = 1 THEN r.capacity ELSE r.capacity - 1 END AS seats_to_fill
    FROM ranked r
    CROSS JOIN LATERAL generate_series(1, r.capacity) AS n
),
assignments AS (
    SELECT s.session_id,
           s.n,
           s.seats_to_fill,
           s.uses_package,
           u.id AS customer_id,
           u.full_name,
           u.id % 3 = 0 AS pays_dropin,
           (SELECT cp.id
              FROM customer_packages cp
             WHERE cp.customer_id = u.id
               AND cp.status = 'Aktif'
               AND cp.remaining_sessions > 0
               AND cp.expires_at > now()
             ORDER BY cp.expires_at
             LIMIT 1) AS cp
    FROM seats s
    JOIN users u ON u.role = 'customer' AND u.id = s.n
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
    JOIN branches b ON b.id = s.branch_id
    WHERE b.code = 'senopati'
      AND s.starts_at > now()
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

-- A few finished bookings in the past, so the History screen is not empty.
-- These were paid from Anindya's 10-session package, which is why her quota
-- starts at 6 of 10. cancelled_at is set in the same INSERT because of the
-- table CHECK.
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
FROM (VALUES (1), (2), (3)) AS v(n)
CROSS JOIN users u
JOIN LATERAL (
    SELECT s2.id, s2.starts_at
    FROM class_sessions s2
    JOIN branches b2 ON b2.id = s2.branch_id
    WHERE b2.code = 'senopati'
      AND s2.starts_at < now()
      AND s2.starts_at > now() - interval '20 days'
    ORDER BY s2.starts_at DESC
    LIMIT 1 OFFSET (v.n - 1)
) s ON true
WHERE u.email = 'anindya@kranulo.com';

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
