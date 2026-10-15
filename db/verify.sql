-- =============================================================================
--  The Body Project — booking system
--  Booking flow check
--
--  Exercises the whole path: package booking, duplicate rejection, drop-in
--  payment, cancellation, and automatic waitlist promotion. The script ends in
--  ROLLBACK, so it can be run as often as you like without touching the data.
--
--  Run:
--    docker cp db/verify.sql tbp-postgres:/tmp/verify.sql
--    docker exec tbp-postgres psql -U tbp -d the_body_project -f /tmp/verify.sql
-- =============================================================================

\set ON_ERROR_STOP on
\pset border 2

BEGIN;

\echo ''
\echo '=== 1. Jadwal terdekat yang masih ada kursi ==='
SELECT session_id, branch_code, start_time, title, capacity, booked_count, slots_left
FROM v_session_availability
WHERE status = 'Terjadwal' AND starts_at > now() AND slots_left > 0
ORDER BY starts_at
LIMIT 3;

\echo ''
\echo '=== 2. Kelas penuh yang punya waitlist ==='
SELECT session_id, title, capacity, booked_count, slots_left, waitlist_count
FROM v_session_availability
WHERE waitlist_count > 0;

\echo ''
\echo '=== 3. Paket Anindya sebelum booking ==='
SELECT cp.id, p.name, cp.total_sessions, cp.remaining_sessions, cp.status, cp.expires_at
FROM customer_packages cp
JOIN packages p ON p.id = cp.package_id
JOIN users   u ON u.id = cp.customer_id
WHERE u.email = 'anindya@kranulo.com'
ORDER BY cp.id;

\echo ''
\echo '=== 4. Book pakai kuota paket (sisa harus berkurang) ==='
DO $$
DECLARE
    s_id bigint;
    bk   bookings%ROWTYPE;
    c_id bigint := (SELECT id FROM users WHERE email = 'anindya@kranulo.com');
BEGIN
    SELECT session_id INTO s_id
    FROM v_session_availability
    WHERE status = 'Terjadwal' AND starts_at > now() AND slots_left > 0
    ORDER BY starts_at
    LIMIT 1;

    bk := fn_book_session(c_id, s_id, true);
    RAISE NOTICE '  -> %  status=%  paket=%  nominal=%',
                 bk.code, bk.status, bk.customer_package_id, bk.amount;
END $$;

SELECT p.name, cp.remaining_sessions, cp.status
FROM customer_packages cp
JOIN packages p ON p.id = cp.package_id
JOIN users   u ON u.id = cp.customer_id
WHERE u.email = 'anindya@kranulo.com' AND cp.remaining_sessions > 0;

\echo ''
\echo '=== 5. Booking kedua di sesi yang sama harus DITOLAK ==='
DO $$
DECLARE
    s_id bigint;
    c_id bigint := (SELECT id FROM users WHERE email = 'anindya@kranulo.com');
BEGIN
    SELECT b.session_id INTO s_id
    FROM bookings b
    WHERE b.customer_id = c_id
      AND b.status = 'Terjual'
      AND b.session_id IN (SELECT session_id FROM v_session_availability)
    ORDER BY b.id DESC
    LIMIT 1;

    BEGIN
        PERFORM fn_book_session(c_id, s_id, true);
        RAISE EXCEPTION 'GAGAL: booking ganda seharusnya ditolak';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '  -> ditolak: %', SQLERRM;
    END;
END $$;

\echo ''
\echo '=== 6. Book tanpa kuota -> harga drop-in + pembayaran QRIS ==='
DO $$
DECLARE
    s_id bigint;
    bk   bookings%ROWTYPE;
    c_id bigint := (SELECT id FROM users WHERE email = 'dimas@binus.ac.id');
BEGIN
    SELECT session_id INTO s_id
    FROM v_session_availability
    WHERE status = 'Terjadwal' AND starts_at > now() AND slots_left > 0
    ORDER BY starts_at DESC
    LIMIT 1;

    bk := fn_book_session(c_id, s_id, false, 'qris');
    RAISE NOTICE '  -> %  nominal=%  metode=%', bk.code, bk.amount, bk.payment_method_code;
END $$;

SELECT b.code, p.method_code, p.amount, p.status AS status_bayar
FROM payments p JOIN bookings b ON b.id = p.booking_id
WHERE b.customer_id = (SELECT id FROM users WHERE email = 'dimas@binus.ac.id')
ORDER BY p.id DESC
LIMIT 1;

\echo ''
\echo '=== 7. Booking di kelas penuh -> otomatis masuk waitlist ==='
DO $$
DECLARE
    s_id bigint;
    bk   bookings%ROWTYPE;
    c_id bigint := (SELECT id FROM users WHERE email = 'intan@mail.com');
BEGIN
    SELECT session_id INTO s_id
    FROM v_session_availability
    WHERE waitlist_count > 0
    LIMIT 1;

    bk := fn_book_session(c_id, s_id, true);
    RAISE NOTICE '  -> %  status=%  posisi waitlist=%', bk.code, bk.status, bk.waitlist_position;
END $$;

\echo ''
\echo '=== 8. Batalkan -> kuota kembali + waitlist naik ==='
DO $$
DECLARE
    s_id     bigint;
    b_id     bigint;
    promoted bookings;
BEGIN
    SELECT session_id INTO s_id
    FROM v_session_availability
    WHERE waitlist_count > 0
    ORDER BY waitlist_count DESC
    LIMIT 1;

    SELECT id INTO b_id
    FROM bookings
    WHERE session_id = s_id AND status = 'Terjual'
    ORDER BY id
    LIMIT 1;

    promoted := fn_cancel_booking(b_id, 'Uji otomatis');
    RAISE NOTICE '  -> dibatalkan booking % ; % dipromosikan dari waitlist',
                 b_id, promoted.code;
END $$;

SELECT b.code, b.status, b.waitlist_position,
       s.booked_count, s.capacity, s.waitlist_count
FROM bookings b JOIN class_sessions s ON s.id = b.session_id
WHERE b.session_id = (
    SELECT session_id FROM v_session_availability
    WHERE waitlist_count > 0 ORDER BY waitlist_count DESC LIMIT 1)
ORDER BY b.status = 'Menunggu Waitlist' DESC, b.waitlist_position NULLS FIRST, b.booked_at;

\echo ''
\echo '=== 9. Jejak status (booking_events) ==='
SELECT b.code, e.from_status, e.to_status, e.note, e.created_at
FROM booking_events e JOIN bookings b ON b.id = e.booking_id
ORDER BY e.id DESC
LIMIT 6;

\echo ''
\echo '=== 10. Absensi ==='
DO $$
DECLARE
    b_id bigint;
    bk   bookings%ROWTYPE;
    c_id bigint := (SELECT id FROM users WHERE email = 'anindya@kranulo.com');
    pts  integer;
BEGIN
    SELECT id INTO b_id
    FROM bookings
    WHERE customer_id = c_id AND status = 'Terjual'
      AND session_id IN (SELECT session_id FROM v_session_availability)
    ORDER BY id DESC
    LIMIT 1;

    SELECT loyalty_points INTO pts FROM users WHERE id = c_id;
    bk := fn_mark_attendance(b_id, true);

    RAISE NOTICE '  -> % menjadi % ; poin % -> %',
                 bk.code, bk.status, pts,
                 (SELECT loyalty_points FROM users WHERE id = c_id);
END $$;

\echo ''
\echo '=== 11. Tingkat hunian per cabang ==='
SELECT branch_code, branch_name, sessions, seats_offered, seats_booked, occupancy_pct
FROM v_branch_occupancy
ORDER BY occupancy_pct DESC NULLS LAST;

\echo ''
\echo '=== 12. Invarian yang harus selalu nol ==='
SELECT
    (SELECT count(*) FROM class_sessions WHERE booked_count > capacity)              AS sesi_melebihi_kapasitas,
    (SELECT count(*) FROM bookings b JOIN class_sessions s ON s.id = b.session_id
      WHERE b.status = 'Menunggu Waitlist' AND s.booked_count < s.capacity)          AS waitlist_di_kursi_kosong,
    (SELECT count(*) FROM bookings b JOIN customer_packages cp ON cp.id = b.customer_package_id
      WHERE b.status IN ('Terjual', 'Hadir') AND cp.remaining_sessions > cp.total_sessions) AS kuota_berlebihan,
    (SELECT count(*) FROM (SELECT code FROM bookings GROUP BY code HAVING count(*) > 1) x) AS kode_booking_ganda,
    (SELECT count(*) FROM (SELECT session_id, customer_id FROM bookings
      WHERE status IN ('Terjual', 'Menunggu Waitlist', 'Hadir', 'Tidak Hadir')
      GROUP BY session_id, customer_id HAVING count(*) > 1) y)                     AS pelanggan_ganda;

\echo ''
\echo '=== 13. Riwayat booking Anindya ==='
SELECT booking_code, class_title, branch_name, starts_at, status, payment_label
FROM v_booking_history
WHERE customer_name = 'Anindya Kirana'
ORDER BY starts_at DESC
LIMIT 5;

ROLLBACK;

\echo ''
\echo 'Selesai - semua perubahan dibatalkan (ROLLBACK).'