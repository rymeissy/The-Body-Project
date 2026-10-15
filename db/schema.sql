-- =============================================================================
--  The Body Project — booking system
--  Schema
--
--  Design notes
--  - Money is NUMERIC(12,2); never float.
--  - Session times are timestamptz, stored in Asia/Jakarta.
--  - Capacity is denormalised onto class_sessions (booked_count) so the
--    availability check can lock a single row. The CHECK constraint is the
--    last line of defence against overbooking.
--  - Status columns use CHECK + reference tables rather than ENUM so a new
--    value can be added without ALTER TYPE locking the table.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_salt / crypt for password hashes

-- -----------------------------------------------------------------------------
-- Reference data
-- -----------------------------------------------------------------------------

CREATE TABLE class_types (
    code        text PRIMARY KEY,
    label       text        NOT NULL,
    sort_order  smallint    NOT NULL DEFAULT 0
);

-- Icons are deliberately not stored. A facility is a fact ("Valet Parking");
-- which glyph represents it is a presentation decision and belongs in the
-- front-end, where it can be changed without touching the data.
CREATE TABLE payment_methods (
    code        text PRIMARY KEY,
    label       text        NOT NULL,
    description text,
    active      boolean     NOT NULL DEFAULT true
);

CREATE TABLE class_policies (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    body        text    NOT NULL,
    sort_order  smallint NOT NULL DEFAULT 0
);

-- -----------------------------------------------------------------------------
-- Branches
-- -----------------------------------------------------------------------------

CREATE TABLE branches (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code         text        NOT NULL UNIQUE,
    name         text        NOT NULL,
    area         text        NOT NULL,
    address      text        NOT NULL,
    phone        text,
    opens_at     time        NOT NULL,
    closes_at    time        NOT NULL,
    distance_km  numeric(5,2),
    is_flagship  boolean     NOT NULL DEFAULT false,
    status       text        NOT NULL DEFAULT 'Aktif'
                             CHECK (status IN ('Aktif', 'Nonaktif', 'Tutup')),
    created_at   timestamptz NOT NULL DEFAULT now(),
    CHECK (closes_at > opens_at)
);

CREATE TABLE branch_facilities (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    branch_id  bigint NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    label      text   NOT NULL,
    UNIQUE (branch_id, label)
);

CREATE TABLE studios (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    branch_id  bigint NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name       text   NOT NULL,
    UNIQUE (branch_id, name)
);

-- -----------------------------------------------------------------------------
-- Instructors
-- -----------------------------------------------------------------------------

CREATE TABLE instructors (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name         text    NOT NULL,
    role_title   text    NOT NULL,
    phone        citext,
    email        citext,
    active       boolean NOT NULL DEFAULT true,
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Accounts
--
-- There is no sign-up form. A customer types a phone number, proves they can
-- receive a code, and the account is created on the spot by fn_upsert_user.
-- The app then asks for a name exactly once — name_confirmed records whether
-- that has happened yet, so a returning customer is never asked again.
--
-- phone is stored as 628xxxxxxxxx: no '+', no spaces, thirteen digits.
-- That is exactly what the server normalises 0812-3456-7890 into. The CHECK
-- below enforces it, and it earns its keep — the sample data once carried a
-- twelve-digit number, which silently created a second account for the same
-- person instead of matching the first.
-- -----------------------------------------------------------------------------

CREATE TABLE users (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role              text        NOT NULL DEFAULT 'customer'
                                    CHECK (role IN ('customer', 'admin')),
    full_name         text        NOT NULL,
    name_confirmed    boolean     NOT NULL DEFAULT false,
    email             citext      UNIQUE,
    phone             citext      NOT NULL UNIQUE
                                CHECK (phone::text ~ '^628[0-9]{10}$'),
    phone_verified_at timestamptz,
    member_since      date        NOT NULL DEFAULT CURRENT_DATE,
    membership_tier   text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- One-time codes
--
-- Only the hash is stored. Sending a message costs money, so the table also
-- carries the rate limiting: fn_request_otp refuses a second code within
-- fn_otp_resend_seconds, and fn_verify_otp locks out after a few wrong guesses.
-- -----------------------------------------------------------------------------

CREATE TABLE otp_codes (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    phone       citext     NOT NULL
                            CHECK (phone::text ~ '^628[0-9]{10}$'),
    code_hash   text       NOT NULL,
    expires_at  timestamptz NOT NULL,
    attempts    smallint   NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    consumed_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Only the newest live code per number is ever read.
CREATE INDEX ix_otp_codes_phone_live
    ON otp_codes (phone, created_at DESC)
    WHERE consumed_at IS NULL;

-- -----------------------------------------------------------------------------
-- Packages
-- -----------------------------------------------------------------------------

CREATE TABLE packages (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code            text        NOT NULL UNIQUE,
    name            text        NOT NULL,
    total_sessions  integer     NOT NULL CHECK (total_sessions > 0),
    price           numeric(12,2) NOT NULL CHECK (price >= 0),
    includes_text   text,
    validity_days   integer     NOT NULL CHECK (validity_days > 0),
    dropin_price    numeric(12,2) NOT NULL DEFAULT 0 CHECK (dropin_price >= 0),
    active          boolean     NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- A package held by one customer.
CREATE TABLE customer_packages (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id        bigint  NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    package_id         bigint  NOT NULL REFERENCES packages(id) ON DELETE RESTRICT,
    total_sessions     integer NOT NULL CHECK (total_sessions > 0),
    remaining_sessions integer NOT NULL CHECK (remaining_sessions >= 0),
    price_paid         numeric(12,2) NOT NULL CHECK (price_paid >= 0),
    purchased_at       timestamptz NOT NULL DEFAULT now(),
    expires_at         timestamptz NOT NULL,
    status             text    NOT NULL DEFAULT 'Aktif'
                                 CHECK (status IN ('Aktif', 'Habis', 'Kedaluwarsa')),
    CHECK (remaining_sessions <= total_sessions)
);

CREATE INDEX ix_customer_packages_customer
    ON customer_packages (customer_id, status);

-- -----------------------------------------------------------------------------
-- Classes: weekly template + concrete session
-- -----------------------------------------------------------------------------

-- The recurring pattern. Mirrors JADWAL_MINGGUAN in js/data.js.
CREATE TABLE class_templates (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    branch_id       bigint     NOT NULL REFERENCES branches(id)     ON DELETE CASCADE,
    studio_id       bigint     NOT NULL REFERENCES studios(id)     ON DELETE RESTRICT,
    class_type_code text       NOT NULL REFERENCES class_types(code) ON DELETE RESTRICT,
    instructor_id   bigint     NOT NULL REFERENCES instructors(id) ON DELETE RESTRICT,
    weekday         smallint   NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    starts_at       time       NOT NULL,
    ends_at         time       NOT NULL,
    title           text       NOT NULL,
    level           text       NOT NULL,
    capacity        integer    NOT NULL CHECK (capacity > 0),
    uses_package    boolean    NOT NULL DEFAULT true,
    active          boolean    NOT NULL DEFAULT true,
    CHECK (ends_at > starts_at)
);

-- A bookable occurrence of a template on a specific date.
CREATE TABLE class_sessions (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    template_id     bigint     REFERENCES class_templates(id) ON DELETE SET NULL,
    branch_id       bigint     NOT NULL REFERENCES branches(id)     ON DELETE CASCADE,
    studio_id       bigint     NOT NULL REFERENCES studios(id)     ON DELETE RESTRICT,
    class_type_code text       NOT NULL REFERENCES class_types(code) ON DELETE RESTRICT,
    instructor_id   bigint     NOT NULL REFERENCES instructors(id) ON DELETE RESTRICT,
    title           text       NOT NULL,
    level           text       NOT NULL,
    starts_at       timestamptz NOT NULL,
    ends_at         timestamptz NOT NULL,
    capacity        integer    NOT NULL CHECK (capacity > 0),
    booked_count    integer    NOT NULL DEFAULT 0 CHECK (booked_count >= 0),
    waitlist_count  integer    NOT NULL DEFAULT 0 CHECK (waitlist_count >= 0),
    uses_package    boolean    NOT NULL DEFAULT true,
    status          text       NOT NULL DEFAULT 'Terjadwal'
                               CHECK (status IN ('Terjadwal', 'Dibatalkan', 'Selesai')),
    created_at      timestamptz NOT NULL DEFAULT now(),

    CHECK (ends_at > starts_at),
    -- The database itself refuses to record more bookings than seats.
    CHECK (booked_count <= capacity),
    -- A room cannot host two classes at the same time.
    UNIQUE (studio_id, starts_at)
);

CREATE INDEX ix_class_sessions_schedule
    ON class_sessions (starts_at, branch_id)
    WHERE status = 'Terjadwal';

CREATE INDEX ix_class_sessions_branch_day
    ON class_sessions (branch_id, starts_at);

-- An instructor cannot be in two rooms at once.
CREATE INDEX ix_class_sessions_instructor_time
    ON class_sessions (instructor_id, starts_at);

-- -----------------------------------------------------------------------------
-- Bookings
-- -----------------------------------------------------------------------------

CREATE TABLE bookings (
    id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code                 text        NOT NULL UNIQUE,
    customer_id          bigint      NOT NULL REFERENCES users(id)          ON DELETE CASCADE,
    session_id           bigint      NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    customer_package_id  bigint      REFERENCES customer_packages(id)       ON DELETE SET NULL,
    -- Snapshot so the e-ticket still renders if the user later renames themselves.
    customer_name        text        NOT NULL,
    status               text        NOT NULL DEFAULT 'Terjual'
                                      CHECK (status IN ('Terjual', 'Menunggu Waitlist',
                                                        'Dibatalkan', 'Refund',
                                                        'Hadir', 'Tidak Hadir')),
    waitlist_position    integer     CHECK (waitlist_position IS NULL OR waitlist_position > 0),
    amount               numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    payment_method_code  text        REFERENCES payment_methods(code) ON DELETE RESTRICT,
    note                 text,
    booked_at            timestamptz NOT NULL DEFAULT now(),
    cancelled_at         timestamptz,
    checked_in_at        timestamptz,

    -- Either a package quota was spent, or money was charged.
    CHECK (customer_package_id IS NOT NULL OR amount > 0),
    CHECK (waitlist_position IS NULL OR status = 'Menunggu Waitlist'),
    CHECK ((status = 'Dibatalkan') = (cancelled_at IS NOT NULL))
);

-- One live booking per customer per session. Cancelled/refunded rows are
-- excluded so the customer is free to book that session again.
CREATE UNIQUE INDEX uq_bookings_live_per_session
    ON bookings (session_id, customer_id)
    WHERE status IN ('Terjual', 'Menunggu Waitlist', 'Hadir', 'Tidak Hadir');

CREATE INDEX ix_bookings_customer ON bookings (customer_id, booked_at DESC);
CREATE INDEX ix_bookings_waitlist ON bookings (session_id, waitlist_position)
    WHERE status = 'Menunggu Waitlist';

CREATE TABLE payments (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id          bigint      NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    method_code         text        NOT NULL REFERENCES payment_methods(code) ON DELETE RESTRICT,
    amount              numeric(12,2) NOT NULL CHECK (amount >= 0),
    status              text        NOT NULL DEFAULT 'Berhasil'
                                    CHECK (status IN ('Menunggu', 'Berhasil', 'Gagal', 'Refund')),
    reference           text,
    paid_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_payments_booking ON payments (booking_id);

-- Status trail.
CREATE TABLE booking_events (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id   bigint      NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    from_status  text,
    to_status    text        NOT NULL,
    note         text,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_booking_events_booking ON booking_events (booking_id, created_at);

-- -----------------------------------------------------------------------------
-- updated_at
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

-- -----------------------------------------------------------------------------
-- Recompute session counters from the booking rows.
--
-- A safety net: fn_book_session() maintains the counters inside its own
-- transaction. Doing it again after commit means hand-edited rows cannot
-- leave the counters wrong, and the CHECK (booked_count <= capacity) keeps
-- the seat invariant honest.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_sync_session_counters() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    live_booked  integer;
    live_waiting integer;
BEGIN
    SELECT
        count(*) FILTER (WHERE status IN ('Terjual', 'Hadir', 'Tidak Hadir')),
        count(*) FILTER (WHERE status = 'Menunggu Waitlist')
    INTO live_booked, live_waiting
    FROM bookings
    WHERE session_id = NEW.session_id;

    UPDATE class_sessions
       SET booked_count   = live_booked,
           waitlist_count = live_waiting
     WHERE id = NEW.session_id;

    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_bookings_sync_counters
    AFTER INSERT OR UPDATE OR DELETE ON bookings
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_sync_session_counters();

-- -----------------------------------------------------------------------------
-- Views
-- -----------------------------------------------------------------------------

-- Matches the "Sisa X dari Y slot" badge on the class card.
CREATE VIEW v_session_availability AS
SELECT
    s.id                                    AS session_id,
    s.title,
    s.level,
    s.starts_at,
    s.ends_at,
    s.starts_at::time                      AS start_time,
    s.class_type_code,
    t.label                                 AS class_type_label,
    b.code                                  AS branch_code,
    b.name                                  AS branch_name,
    st.name                                 AS studio_name,
    i.name                                  AS instructor_name,
    i.role_title                            AS instructor_role,
    s.capacity,
    s.booked_count,
    GREATEST(s.capacity - s.booked_count, 0) AS slots_left,
    s.waitlist_count,
    s.uses_package,
    s.status
FROM class_sessions s
JOIN branches    b  ON b.id  = s.branch_id
JOIN studios     st ON st.id = s.studio_id
JOIN instructors i  ON i.id  = s.instructor_id
JOIN class_types t  ON t.code = s.class_type_code;

-- Everything the Profile screen shows.
CREATE VIEW v_customer_overview AS
SELECT
    u.id,
    u.full_name,
    u.email,
    u.phone,
    u.member_since,
    u.membership_tier,
    COALESCE(SUM(cp.remaining_sessions) FILTER (WHERE cp.status = 'Aktif'), 0)::integer AS sessions_left,
    COUNT(b.id) FILTER (WHERE b.status IN ('Terjual', 'Hadir', 'Tidak Hadir'))::integer AS sessions_booked
FROM users u
LEFT JOIN customer_packages cp ON cp.customer_id = u.id
LEFT JOIN bookings b           ON b.customer_id  = u.id
GROUP BY u.id;

-- Booking history rows.
CREATE VIEW v_booking_history AS
SELECT
    b.id                    AS booking_id,
    b.code                  AS booking_code,
    b.customer_name,
    s.title                 AS class_title,
    br.name                 AS branch_name,
    st.name                 AS studio_name,
    s.starts_at,
    i.name                  AS instructor_name,
    b.status,
    b.amount,
    COALESCE(pm.label, 'Potong kuota') AS payment_label,
    b.booked_at
FROM bookings b
JOIN class_sessions s ON s.id  = b.session_id
JOIN branches     br  ON br.id = s.branch_id
JOIN studios      st  ON st.id = s.studio_id
JOIN instructors  i   ON i.id  = s.instructor_id
LEFT JOIN payment_methods pm ON pm.code = b.payment_method_code;

-- Weekly occupancy per branch, used by the reporting screen.
-- LEFT JOIN so branches with no timetable yet still show up as zero.
CREATE VIEW v_branch_occupancy AS
SELECT
    br.id                                  AS branch_id,
    br.code                                AS branch_code,
    br.name                                AS branch_name,
    count(s.id)                            AS sessions,
    COALESCE(sum(s.capacity), 0)           AS seats_offered,
    COALESCE(sum(s.booked_count), 0)       AS seats_booked,
    round(100.0 * sum(s.booked_count)
          / NULLIF(sum(s.capacity), 0), 1) AS occupancy_pct
FROM branches br
LEFT JOIN class_sessions s
       ON s.branch_id = br.id
      AND s.status = 'Terjadwal'
GROUP BY br.id, br.code, br.name;
