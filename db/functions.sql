-- =============================================================================
--  The Body Project — booking system
--  Functions
--
--  The booking path is a single transaction that locks the session row before
--  counting seats. That is what stops two customers taking the last seat at
--  the same moment — the problem the prototype's WhatsApp process had.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Booking code, e.g. TBP-261015-0007
--
-- The serial comes from a sequence, not from COUNT(*) + 1. A sequence is the
-- only safe source for a human-readable id here:
--
--   - two customers booking at the same moment would both read the same
--     COUNT(*) and collide on the UNIQUE constraint;
--   - inside a multi-row INSERT every call sees the same snapshot, so
--     COUNT(*) would return one value for every row.
--
-- The counter is global rather than per-day, so codes read
-- TBP-261015-0001 ... TBP-261016-0014 across a midnight boundary. Gaps are
-- expected and harmless: a rolled-back booking burns its number.
-- -----------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS booking_code_seq AS bigint START 1 INCREMENT 1;

CREATE OR REPLACE FUNCTION fn_next_booking_code() RETURNS text
LANGUAGE sql AS $$
    SELECT 'TBP-'
        || to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYMMDD')
        || '-'
        || lpad(nextval('booking_code_seq')::text, 4, '0');
$$;

-- -----------------------------------------------------------------------------
-- Materialise bookable sessions from the weekly templates.
-- Replaces seedFutureClasses() in js/data.js.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_generate_sessions(
    from_date date,
    to_date   date
) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
    d           date;
    made        integer := 0;
BEGIN
    IF to_date < from_date THEN
        RAISE EXCEPTION 'to_date (%) is before from_date (%)', to_date, from_date;
    END IF;

    FOR d IN SELECT generate_series(from_date, to_date, interval '1 day')::date LOOP
        INSERT INTO class_sessions (
            template_id, branch_id, studio_id, class_type_code, instructor_id,
            title, level, starts_at, ends_at, capacity, uses_package
        )
        SELECT
            t.id, t.branch_id, t.studio_id, t.class_type_code, t.instructor_id,
            t.title, t.level,
            (d + t.starts_at) AT TIME ZONE 'Asia/Jakarta',
            (d + t.ends_at)   AT TIME ZONE 'Asia/Jakarta',
            t.capacity, t.uses_package
        FROM class_templates t
        WHERE t.active
          AND EXTRACT(ISODOW FROM d)::int - 1 = t.weekday   -- weekday 0 = Sunday
          AND NOT EXISTS (
              SELECT 1 FROM class_sessions s
              WHERE s.studio_id = t.studio_id
                AND s.starts_at = (d + t.starts_at) AT TIME ZONE 'Asia/Jakarta'
          );

        made := made + 1;
    END LOOP;

    RETURN made;
END;
$$;

-- -----------------------------------------------------------------------------
-- Book a session.
--
--   p_customer_id       the customer
--   p_session_id        the class
--   p_use_package       TRUE  = deduct an active package quota
--                       FALSE = charge the drop-in price
--   p_payment_method    NULL when a package quota is used
--
-- Returns the bookings row. Raises when the session cannot be booked.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_book_session(
    p_customer_id    bigint,
    p_session_id     bigint,
    p_use_package    boolean  DEFAULT true,
    p_payment_method text     DEFAULT NULL
) RETURNS bookings
LANGUAGE plpgsql AS $$
DECLARE
    s            class_sessions%ROWTYPE;
    u            users%ROWTYPE;
    pkg          customer_packages%ROWTYPE;
    dropin       numeric(12,2);
    new_booking  bookings%ROWTYPE;
    seats_taken         boolean;
BEGIN
    -- Lock the session for the rest of the transaction. Any concurrent booking
    -- of the same class queues here, then re-reads booked_count.
    SELECT * INTO s
    FROM class_sessions
    WHERE id = p_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sesi % tidak ditemukan', p_session_id;
    END IF;

    IF s.status <> 'Terjadwal' THEN
        RAISE EXCEPTION 'Sesi % berstatus %', p_session_id, s.status;
    END IF;

    IF s.starts_at <= now() THEN
        RAISE EXCEPTION 'Sesi % sudah lewat', p_session_id;
    END IF;

    SELECT * INTO u FROM users WHERE id = p_customer_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pengguna % tidak ditemukan', p_customer_id;
    END IF;

    -- Refuse a second seat for the same class.
    IF EXISTS (
        SELECT 1 FROM bookings
        WHERE session_id = p_session_id
          AND customer_id = p_customer_id
          AND status IN ('Terjual', 'Menunggu Waitlist', 'Hadir', 'Tidak Hadir')
    ) THEN
        RAISE EXCEPTION 'Pengguna sudah memesan sesi %', p_session_id;
    END IF;

    seats_taken := s.booked_count >= s.capacity;

    IF p_use_package THEN
        IF NOT s.uses_package THEN
            RAISE EXCEPTION 'Kelas % tidak bisa dibayar dengan kuota paket', p_session_id;
        END IF;

        SELECT * INTO pkg
        FROM customer_packages
        WHERE customer_id = p_customer_id
          AND status = 'Aktif'
          AND remaining_sessions > 0
          AND expires_at > now()
        ORDER BY expires_at ASC
        LIMIT 1
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Kuota paket tidak tersedia';
        END IF;
    ELSE
        SELECT dropin_price INTO dropin FROM packages WHERE active
        ORDER BY id LIMIT 1;
    END IF;

    INSERT INTO bookings (
        code, customer_id, session_id, customer_package_id,
        customer_name, status, waitlist_position, amount, payment_method_code
    ) VALUES (
        fn_next_booking_code(),
        p_customer_id,
        p_session_id,
        CASE WHEN p_use_package THEN pkg.id ELSE NULL END,
        u.full_name,
        CASE WHEN seats_taken THEN 'Menunggu Waitlist' ELSE 'Terjual' END,
        CASE WHEN seats_taken THEN s.waitlist_count + 1 ELSE NULL END,
        CASE WHEN p_use_package OR seats_taken THEN 0 ELSE dropin END,
        CASE WHEN p_use_package OR seats_taken THEN NULL ELSE p_payment_method END
    )
    RETURNING * INTO new_booking;

    -- Deduct the quota only once the seat is actually secured.
    IF p_use_package AND NOT seats_taken THEN
        UPDATE customer_packages
           SET remaining_sessions = remaining_sessions - 1,
               status = CASE WHEN remaining_sessions - 1 = 0 THEN 'Habis' ELSE status END
         WHERE id = pkg.id;
    END IF;

    IF NOT seats_taken AND NOT p_use_package THEN
        INSERT INTO payments (booking_id, method_code, amount, status)
        VALUES (new_booking.id, p_payment_method, dropin, 'Berhasil');
    END IF;

    RETURN new_booking;
END;
$$;

-- -----------------------------------------------------------------------------
-- Cancel and hand the seat to whoever is first on the waitlist.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_cancel_booking(
    p_booking_id bigint,
    p_reason    text DEFAULT NULL
) RETURNS bookings
LANGUAGE plpgsql AS $$
DECLARE
    b            bookings%ROWTYPE;
    promoted     bookings;
    next_person  bookings;
    quota_refund integer := 0;
BEGIN
    SELECT * INTO b FROM bookings WHERE id = p_booking_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % tidak ditemukan', p_booking_id;
    END IF;

    IF b.status = 'Dibatalkan' THEN
        RAISE EXCEPTION 'Booking % sudah dibatalkan', p_booking_id;
    END IF;

    -- A quota can only be refunded before the class starts.
    IF b.customer_package_id IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM class_sessions
           WHERE id = b.session_id AND starts_at <= now()
       ) THEN
        UPDATE customer_packages
           SET remaining_sessions = remaining_sessions + 1,
               status = 'Aktif'
         WHERE id = b.customer_package_id;
        quota_refund := 1;
    END IF;

    UPDATE bookings
       SET status = 'Dibatalkan', cancelled_at = now(), note = COALESCE(p_reason, note)
     WHERE id = p_booking_id
    RETURNING * INTO b;

    -- The status trail is written by trg_bookings_status_log.

    -- Pass the freed seat down the waitlist.
    SELECT * INTO next_person
    FROM bookings
    WHERE session_id = b.session_id
      AND status = 'Menunggu Waitlist'
    ORDER BY waitlist_position
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        UPDATE bookings
           SET status = 'Terjual', waitlist_position = NULL
         WHERE id = next_person.id
        RETURNING * INTO promoted;

        IF promoted.customer_package_id IS NOT NULL THEN
            UPDATE customer_packages
               SET remaining_sessions = remaining_sessions - 1,
                   status = CASE WHEN remaining_sessions - 1 = 0 THEN 'Habis' ELSE status END
             WHERE id = promoted.customer_package_id;
        END IF;

        -- Renumber whoever is still waiting.
        WITH renumbered AS (
            SELECT id,
                   row_number() OVER (ORDER BY waitlist_position) AS pos
            FROM bookings
            WHERE session_id = b.session_id
              AND status = 'Menunggu Waitlist'
        )
        UPDATE bookings bo
           SET waitlist_position = r.pos
          FROM renumbered r
         WHERE bo.id = r.id;

        RETURN promoted;
    END IF;

    RETURN b;
END;
$$;

-- -----------------------------------------------------------------------------
-- Attendance, for the admin check-in screen.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_mark_attendance(
    p_booking_id  bigint,
    p_attended    boolean
) RETURNS bookings
LANGUAGE plpgsql AS $$
DECLARE
    b bookings%ROWTYPE;
BEGIN
    SELECT * INTO b FROM bookings WHERE id = p_booking_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % tidak ditemukan', p_booking_id;
    END IF;

    UPDATE bookings
       SET status        = CASE WHEN p_attended THEN 'Hadir' ELSE 'Tidak Hadir' END,
           checked_in_at = now()
     WHERE id = p_booking_id
    RETURNING * INTO b;

    RETURN b;
END;
$$;

-- -----------------------------------------------------------------------------
-- Audit trail
--
-- Single source of truth for status changes. The functions above only flip
-- bookings.status and fill in bookings.note; the trigger writes the trail, so
-- a status change can never be logged twice or go unlogged.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_log_booking_status() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO booking_events (booking_id, from_status, to_status, note)
        VALUES (NEW.id, OLD.status, NEW.status,
                CASE WHEN NEW.status = 'Dibatalkan' THEN NEW.note END);
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_bookings_status_log
    AFTER UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION fn_log_booking_status();

-- -----------------------------------------------------------------------------
-- Expire packages that have passed their date.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_expire_packages() RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
    n integer;
BEGIN
    UPDATE customer_packages
       SET status = 'Kedaluwarsa'
     WHERE status = 'Aktif'
       AND expires_at <= now();
    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN n;
END;
$$;

-- -----------------------------------------------------------------------------
-- Edit the profile from the Profil tab.
--
-- Both fields are optional so a customer can add just an email, or just fix a
-- name, without touching the other. For email there are three cases:
--   NULL  = not sent, leave as it is
--   ''    = sent empty, clear it
--   value = set it
-- A blank email clears it — the account is reachable by phone number alone,
-- so email is never required.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_update_profile(
    p_user_id bigint,
    p_name    text,
    p_email   citext DEFAULT NULL
) RETURNS users
LANGUAGE plpgsql AS $$
DECLARE
    new_name  text   := NULLIF(btrim(coalesce(p_name, '')), '');
    new_email citext := NULLIF(btrim(coalesce(p_email::text, '')), '');
    saved     users%ROWTYPE;
BEGIN
    IF new_name IS NOT NULL AND length(new_name) < 3 THEN
        RAISE EXCEPTION 'Nama lengkap minimal 3 karakter';
    END IF;

    IF new_email IS NOT NULL AND new_email::text !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' THEN
        RAISE EXCEPTION 'Format email tidak valid';
    END IF;

    UPDATE users
       SET full_name = COALESCE(new_name, full_name),
           email     = CASE WHEN p_email IS NULL THEN email ELSE new_email END,
           -- punya nama berarti sudah mengetahuinya sendiri; inilah yang
           -- menghentikan aplikasi menanyakan nama lagi di masuk berikutnya.
           name_confirmed = name_confirmed OR (new_name IS NOT NULL)
     WHERE id = p_user_id
    RETURNING * INTO saved;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pengguna % tidak ditemukan', p_user_id;
    END IF;

    RETURN saved;
END;
$$;

-- -----------------------------------------------------------------------------
-- Roll up finished sessions and release the calendar.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_close_finished_sessions() RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
    n integer;
BEGIN
    UPDATE class_sessions
       SET status = 'Selesai'
     WHERE status = 'Terjadwal'
       AND ends_at < now();
    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN n;
END;
$$;

-- =============================================================================
--  OTP
--
--  A customer signs in with a phone number and a six-digit code sent over
--  WhatsApp. The code is generated here, stored only as a hash, and can be
--  spent exactly once.
-- =============================================================================

-- Tuning knobs, kept in one place so the server and the UI agree.
CREATE OR REPLACE FUNCTION fn_otp_ttl_seconds()        RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 300 $$;  -- 5 menit
CREATE OR REPLACE FUNCTION fn_otp_resend_seconds()    RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 60  $$;
CREATE OR REPLACE FUNCTION fn_otp_max_attempts()      RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 3   $$;

-- -----------------------------------------------------------------------------
-- Issue a code.
--
--   p_phone  already normalised to 62xxxxxxxxx
--
-- Returns the six-digit code so the caller can put it in a WhatsApp message.
-- The code is never stored in the clear — only crypt() of it, with a per-row
-- salt, the same as a password hash.
--
-- There is only one purpose now: proving you own the number. Whether an
-- account already exists is decided later, in fn_upsert_user.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_request_otp(p_phone citext)
RETURNS TABLE (code text, expires_at timestamptz, resend_after int)
LANGUAGE plpgsql AS $$
DECLARE
    last_sent  timestamptz;
    new_code   text;
    new_expiry timestamptz;
BEGIN
    -- One live code per number: a fresh request retires the old one.
    UPDATE otp_codes
       SET consumed_at = now()
     WHERE phone = p_phone
       AND consumed_at IS NULL;

    -- Sending a message costs money, so hold off on an immediate resend.
    SELECT created_at INTO last_sent
    FROM otp_codes
    WHERE phone = p_phone
    ORDER BY created_at DESC
    LIMIT 1;

    IF last_sent IS NOT NULL
       AND last_sent > now() - make_interval(secs => fn_otp_resend_seconds()) THEN
        RAISE EXCEPTION 'Tunggu % detik sebelum meminta kode lagi',
              ceil(extract(epoch FROM (last_sent + make_interval(secs => fn_otp_resend_seconds()) - now())));
    END IF;

    new_code := lpad((floor(random() * 1000000))::integer::text, 6, '0');

    INSERT INTO otp_codes (phone, code_hash, expires_at)
    VALUES (p_phone,
            crypt(new_code, gen_salt('bf', 6)),
            now() + make_interval(secs => fn_otp_ttl_seconds()))
    RETURNING otp_codes.expires_at INTO new_expiry;

    RETURN QUERY SELECT new_code, new_expiry, fn_otp_resend_seconds();
END;
$$;

-- -----------------------------------------------------------------------------
-- Check a code. Does not create or sign in anybody — that is the server's job.
--
--   Returns 'ok'        the code matched
--           'expired'   the code timed out
--           'locked'    too many wrong guesses
--           'invalid'   no live code for this number
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_verify_otp(
    p_phone citext,
    p_code  text
) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
    row_otp otp_codes%ROWTYPE;
BEGIN
    SELECT * INTO row_otp
    FROM otp_codes
    WHERE phone = p_phone
      AND consumed_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN 'invalid';
    END IF;

    IF row_otp.expires_at <= now() THEN
        UPDATE otp_codes SET consumed_at = now() WHERE id = row_otp.id;
        RETURN 'expired';
    END IF;

    IF row_otp.attempts >= fn_otp_max_attempts() THEN
        UPDATE otp_codes SET consumed_at = now() WHERE id = row_otp.id;
        RETURN 'locked';
    END IF;

    IF crypt(p_code, row_otp.code_hash) = row_otp.code_hash THEN
        UPDATE otp_codes SET consumed_at = now() WHERE id = row_otp.id;
        RETURN 'ok';
    END IF;

    UPDATE otp_codes SET attempts = attempts + 1 WHERE id = row_otp.id;
    RETURN 'invalid';
END;
$$;

-- -----------------------------------------------------------------------------
-- Find or create the account behind a verified number.
--
-- This runs only after fn_verify_otp accepted a code, so creating on the fly
-- is safe: nobody can reach it without having received a message on this
-- number. There is no sign-up form anywhere in the product.
--
-- A fresh account gets a placeholder name and name_confirmed = false, which
-- is what makes the app ask for the real name once. Returning customers keep
-- whatever they typed last time.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_upsert_user(p_phone citext)
RETURNS users
LANGUAGE plpgsql AS $$
DECLARE
    found_user users%ROWTYPE;
BEGIN
    SELECT * INTO found_user FROM users WHERE phone = p_phone FOR UPDATE;

    IF FOUND THEN
        UPDATE users SET phone_verified_at = now()
         WHERE id = found_user.id
        RETURNING * INTO found_user;
        RETURN found_user;
    END IF;

    INSERT INTO users (full_name, name_confirmed, phone, phone_verified_at)
    VALUES ('Pelanggan ' || right(p_phone, 4), false, p_phone, now())
    RETURNING * INTO found_user;

    RETURN found_user;
END;
$$;
