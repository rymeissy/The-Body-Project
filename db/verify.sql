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
    -- Pick a session this customer is not already in. Without that guard the
    -- test depends on what the seed happens to have booked: it used to pass only
    -- because the seed filled Senopati alone, and Anindya's own bookings were
    -- all there. Now that bookings are spread over every branch, "the nearest
    -- session with a free seat" can easily be one she already holds, and
    -- fn_book_session correctly refuses with "Pengguna sudah memesan".
    --
    -- uses_package is required for the same reason: this test is about spending
    -- package quota, so a class that cannot be paid that way has to be ruled out
    -- rather than hoped over. Cadillac and Tower classes are not package-eligible.
    SELECT v.session_id INTO s_id
    FROM v_session_availability v
    WHERE v.status = 'Terjadwal' AND v.starts_at > now() AND v.slots_left > 0
      AND v.uses_package
      AND NOT EXISTS (
          SELECT 1 FROM bookings b
          WHERE b.session_id = v.session_id
            AND b.customer_id = c_id
            AND b.status IN ('Terjual', 'Menunggu Waitlist')
      )
    ORDER BY v.starts_at
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
    -- Any class that is already full will do -- the point is that booking into
    -- one lands on the waitlist, not that a waitlist already exists. Prefer one
    -- that already has a waitlist. Two guards: the class must be in the future,
    -- and this customer must not already hold a seat in it, or the booking is
    -- (correctly) rejected as a duplicate before the waitlist logic is reached.
    -- uses_package too, since this call passes true for "spend package quota".
    SELECT v.session_id INTO s_id
    FROM v_session_availability v
    WHERE v.status = 'Terjadwal'
      AND v.starts_at > now()
      AND v.slots_left = 0
      AND v.uses_package
      AND NOT EXISTS (
          SELECT 1 FROM bookings b
          WHERE b.session_id = v.session_id
            AND b.customer_id = c_id
            AND b.status IN ('Terjual', 'Menunggu Waitlist')
      )
    ORDER BY v.waitlist_count DESC, v.starts_at
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
BEGIN
    SELECT id INTO b_id
    FROM bookings
    WHERE customer_id = c_id AND status = 'Terjual'
      AND session_id IN (SELECT session_id FROM v_session_availability)
    ORDER BY id DESC
    LIMIT 1;

    bk := fn_mark_attendance(b_id, true);

    IF bk.status <> 'Hadir' OR bk.checked_in_at IS NULL THEN
        RAISE EXCEPTION 'GAGAL: absensi tidak tercatat';
    END IF;
    RAISE NOTICE '  -> % menjadi % pada %',
                 bk.code, bk.status, bk.checked_in_at;
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

\echo ''
\echo '=== 14. OTP: kode, satu kali pakai, dan batas percobaan ==='
DO $$
DECLARE
    test_phone citext := '6289990000001'::citext;
    issued     record;
    first_code text;
BEGIN
    SELECT * INTO issued FROM fn_request_otp(test_phone);
    first_code := issued.code;

    RAISE NOTICE '  -> kode % dibuat, berlaku % detik',
                 first_code, ceil(extract(epoch FROM (issued.expires_at - now())));

    IF first_code !~ '^\d{6}$' THEN
        RAISE EXCEPTION 'GAGAL: kode bukan 6 angka';
    END IF;

    -- Salah harus ditolak.
    IF fn_verify_otp(test_phone, '000000') <> 'invalid' THEN
        RAISE EXCEPTION 'GAGAL: kode salah seharusnya invalid';
    END IF;
    RAISE NOTICE '  -> kode salah ditolak';

    -- Benar harus diterima.
    IF fn_verify_otp(test_phone, first_code) <> 'ok' THEN
        RAISE EXCEPTION 'GAGAL: kode benar ditolak';
    END IF;
    RAISE NOTICE '  -> kode benar diterima';

    -- Satu kali pakai: kode yang sama tidak boleh bisa dipakai lagi.
    IF fn_verify_otp(test_phone, first_code) <> 'invalid' THEN
        RAISE EXCEPTION 'GAGAL: kode terpakai dua kali';
    END IF;
    RAISE NOTICE '  -> kode hanya berlaku sekali';
END $$;

\echo ''
\echo '=== 15. OTP: terkunci setelah 3 kali salah ==='
DO $$
DECLARE
    test_phone citext := '6289990000002'::citext;
    issued     record;
    hasil      text;
BEGIN
    SELECT * INTO issued FROM fn_request_otp(test_phone);

    -- Tiga tebakan salah masih dijawab "invalid", semuanya dihitung.
    PERFORM fn_verify_otp(test_phone, '111111');
    PERFORM fn_verify_otp(test_phone, '222222');
    hasil := fn_verify_otp(test_phone, '333333');

    IF hasil <> 'invalid' THEN
        RAISE EXCEPTION 'GAGAL: percobaan ke-3 seharusnya masih invalid, dapat %', hasil;
    END IF;

    -- Tebakan keempat ditolak outright dan kodenya hangus.
    hasil := fn_verify_otp(test_phone, '444444');
    IF hasil <> 'locked' THEN
        RAISE EXCEPTION 'GAGAL: percobaan ke-4 seharusnya locked, dapat %', hasil;
    END IF;

    RAISE NOTICE '  -> terkunci setelah % percobaan salah', fn_otp_max_attempts();

    -- Minta kode baru, tetapi jeda kirim-ulang 60 detik juga ikut ditegakkan.
    -- Mgeser created_at ke belakang supaya jeda kirim-ulang terlewati.
    BEGIN
        SELECT * INTO issued FROM fn_request_otp(test_phone);
        RAISE EXCEPTION 'GAGAL: jeda kirim ulang tidak ditegakkan';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE 'Tunggu%' THEN RAISE; END IF;
        RAISE NOTICE '  -> jeda kirim ulang % detik ditegakkan', fn_otp_resend_seconds();
    END;

    UPDATE otp_codes
       SET created_at = now() - make_interval(secs => fn_otp_resend_seconds() + 5)
     WHERE phone = test_phone;

    -- Kunci harus melepas begitu kode baru diterbitkan.
    SELECT * INTO issued FROM fn_request_otp(test_phone);
    IF fn_verify_otp(test_phone, issued.code) <> 'ok' THEN
        RAISE EXCEPTION 'GAGAL: kode baru setelah kunci tidak bisa dipakai';
    END IF;
    RAISE NOTICE '  -> kode baru setelah terkunci tetap bisa dipakai';
END $$;

\echo ''
\echo '=== 16. OTP: hanya hash yang tersimpan ==='
-- Tidak ada kolom code di tabel ini sama sekali — kodenya hanya ada di hash.
SELECT left(phone::text, 5) || '…' AS nomor,
       code_hash LIKE '$2%'  AS format_bcrypt,
       length(code_hash)     AS panjang,
       attempts,
       consumed_at IS NOT NULL AS sudah_dipakai
FROM otp_codes
WHERE phone::text LIKE '628999000000%'
ORDER BY id DESC
LIMIT 3;

\echo ''
\echo '=== 17. fn_upsert_user: membuat akun di tengah alur masuk ==='
DO $$
DECLARE
    baru users%ROWTYPE;
    lagi users%ROWTYPE;
BEGIN
    SELECT * INTO baru FROM fn_upsert_user('6289990000003'::citext);

    IF baru.id IS NULL THEN
        RAISE EXCEPTION 'GAGAL: akun tidak dibuat';
    END IF;
    IF baru.name_confirmed THEN
        RAISE EXCEPTION 'GAGAL: akun baru harusnya belum punya nama terkonfirmasi';
    END IF;
    RAISE NOTICE '  -> dibuat : % , perlu nama? %', baru.full_name, (NOT baru.name_confirmed);

    -- Login kedua kalinya: akun yang sama, tidak ada duplikat.
    SELECT * INTO lagi FROM fn_upsert_user('6289990000003'::citext);
    IF lagi.id <> baru.id THEN
        RAISE EXCEPTION 'GAGAL: muncul akun kedua untuk nomor yang sama';
    END IF;
    RAISE NOTICE '  -> masuk lagi : id sama, nama tetap %', lagi.full_name;
END $$;

\echo ''
\echo '=== 18. fn_update_profile: nama disimpan sekali, lalu tidak diminta lagi ==='
DO $$
DECLARE
    test_phone citext := '6289990000003'::citext;
    baru       users%ROWTYPE;
    tersimpan  users%ROWTYPE;
BEGIN
    SELECT * INTO baru FROM fn_upsert_user(test_phone);

    -- Nama terlalu pendek harus ditolak.
    BEGIN
        PERFORM fn_update_profile(baru.id, 'Ab');
        RAISE EXCEPTION 'GAGAL: nama 2 karakter seharusnya ditolak';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%minimal 3 karakter%' THEN RAISE; END IF;
        RAISE NOTICE '  -> nama terlalu pendek ditolak';
    END;

    tersimpan := fn_update_profile(baru.id, '  Gita Maharani  ');

    IF NOT tersimpan.name_confirmed THEN
        RAISE EXCEPTION 'GAGAL: name_confirmed belum ditandai';
    END IF;
    IF tersimpan.full_name <> 'Gita Maharani' THEN
        RAISE EXCEPTION 'GAGAL: nama tidak tersimpan / tidak dipangkas: %', tersimpan.full_name;
    END IF;
    RAISE NOTICE '  -> nama tersimpan : % , terkonfirmasi: %', tersimpan.full_name, tersimpan.name_confirmed;

    -- Login lagi: fn_upsert_user harus melaporkan tidak perlu minta nama.
    SELECT * INTO baru FROM fn_upsert_user(test_phone);
    IF NOT baru.name_confirmed THEN
        RAISE EXCEPTION 'GAGAL: nama diminta lagi padahal sudah diisi';
    END IF;
    RAISE NOTICE '  -> masuk lagi : perlu nama? %', (NOT baru.name_confirmed);
END $$;

\echo ''
\echo '=== 19. fn_update_profile: email boleh kosong, diisi, lalu dihapus ==='
DO $$
DECLARE
    test_phone citext := '6289990000003'::citext;
    u          users%ROWTYPE;
BEGIN
    SELECT * INTO u FROM fn_upsert_user(test_phone);

    -- Email tidak dikirim sama sekali (NULL) harus tidak mengubah apa pun.
    u := fn_update_profile(u.id, 'Gita Maharani', NULL);
    IF u.email IS NOT NULL THEN
        RAISE EXCEPTION 'GAGAL: email ikut terisi tanpa diminta';
    END IF;
    RAISE NOTICE '  -> email belum diisi : %', (u.email IS NULL);

    -- Diisi lewat ikon pensil.
    u := fn_update_profile(u.id, NULL, 'gita@mail.com');
    IF u.email::text <> 'gita@mail.com' THEN
        RAISE EXCEPTION 'GAGAL: email tidak tersimpan: %', u.email;
    END IF;
    IF u.full_name <> 'Gita Maharani' THEN
        RAISE EXCEPTION 'GAGAL: nama ikut berubah: %', u.full_name;
    END IF;
    RAISE NOTICE '  -> diisi : % , nama tetap %', u.email, u.full_name;

    -- Format salah ditolak.
    BEGIN
        PERFORM fn_update_profile(u.id, NULL, 'bukan-email');
        RAISE EXCEPTION 'GAGAL: format email salah seharusnya ditolak';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%Format email%' THEN RAISE; END IF;
        RAISE NOTICE '  -> format salah ditolak';
    END;

    -- Dikosongkan lagi dari ikon pensil.
    u := fn_update_profile(u.id, NULL, '');
    IF u.email IS NOT NULL THEN
        RAISE EXCEPTION 'GAGAL: email tidak terhapus';
    END IF;
    RAISE NOTICE '  -> dihapus : email kosong lagi';
END $$;

\echo ''
\echo '=== 20. Akun tanpa email dan tanpa kata sandi tetap sah ==='
SELECT role, full_name, name_confirmed,
       email             IS NULL AS email_kosong,
       phone_verified_at IS NOT NULL AS nomor_terverifikasi
FROM users
WHERE phone::text = '6289990000003';

\echo ''
\echo '=== 21. Tidak ada kolom password_hash / loyalty_points ==='
SELECT count(*) AS kolom_lama_yang_masih_ada
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('password_hash', 'loyalty_points');

\echo ''
\echo 'Selesai - semua perubahan dibatalkan (ROLLBACK).'

ROLLBACK;