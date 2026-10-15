# Database

PostgreSQL schema for The Body Project booking app. The front-end prototype
reads static data from `../js/data.js`; this database holds the real data model
and backs the OTP login endpoint in `../serve.js`.

Vocabulary matches `../js/data.js` — same branch codes, instructor names, class
titles, package names, and payment methods.

## Run

```bash
docker compose up -d          # Postgres 16 on localhost:5433
```

The three SQL files run automatically on first start, in order:

| File | Contents |
|---|---|
| `schema.sql` | Extensions, 15 tables, indexes, constraints, triggers, 4 views |
| `functions.sql` | 10 functions, the booking-code sequence, OTP settings |
| `seed.sql` | Reference data, 8 branches, 8 class templates, 90 days of sessions, demo bookings |

Rebuild from scratch after editing any of them:

```bash
docker compose down -v
docker compose up -d
```

Connect:

```bash
docker exec -it tbp-postgres psql -U tbp -d the_body_project
```

| | |
|---|---|
| Host | `localhost` |
| Port | `5433` |
| Database | `the_body_project` |
| User / password | `tbp` / `tbp_dev_password` |
| Timezone | `Asia/Jakarta` |

To point the app at it later: `postgres://tbp:tbp_dev_password@localhost:5433/the_body_project`

## Check it works

`verify.sql` exercises the full booking path and ends in `ROLLBACK`, so it is
safe to run repeatedly.

```bash
docker cp verify.sql tbp-postgres:/tmp/verify.sql
docker exec tbp-postgres psql -U tbp -d the_body_project -f /tmp/verify.sql
```

It covers package booking, duplicate rejection, drop-in payment, waitlist
promotion, attendance, OTP issue/verify/lockout, and a final invariant check
that must print five zeros.

## Tables

| Table | Holds |
|---|---|
| `branches` | 8 studios, hours, distance, flagship flag |
| `branch_facilities` | Facility chips per branch |
| `studios` | Rooms inside a branch |
| `instructors` | Name and role title |
| `class_types` | Reformer, Mat Flow, Cadillac, Prenatal |
| `class_templates` | The weekly recurring pattern |
| `class_sessions` | A bookable occurrence on a specific date |
| `users` | Customers and admins, bcrypt password hash |
| `packages` | Products for sale |
| `customer_packages` | A package held by one customer, with its remaining quota |
| `payment_methods` | QRIS, BCA VA, GoPay/OVO, credit card |
| `bookings` | One row per booking attempt, including cancelled ones |
| `payments` | Payment records |
| `booking_events` | Status trail |
| `otp_codes` | One-time login codes, stored as hashes |
| `class_policies` | The four policy lines on the booking sheet |

## Views

| View | Feeds |
|---|---|
| `v_session_availability` | Class cards — slots left, waitlist count |
| `v_customer_overview` | Profile screen — quota left, sessions booked |
| `v_booking_history` | History screen |
| `v_branch_occupancy` | Per-branch occupancy report |

## Functions

| Function | Does |
|---|---|
| `fn_book_session(customer, session, use_package, method)` | Books a seat, or joins the waitlist when full |
| `fn_cancel_booking(booking, reason)` | Refunds quota and promotes the first waitlister |
| `fn_generate_sessions(from, to)` | Materialises sessions from the weekly templates |
| `fn_mark_attendance(booking, attended)` | Check-in, awards loyalty points |
| `fn_expire_packages()` | Marks lapsed packages |
| `fn_close_finished_sessions()` | Retires past sessions |
| `fn_next_booking_code()` | `TBP-261015-0007` |
| `fn_request_otp(phone, purpose)` | Issues a six-digit code, returns it for the server to send |
| `fn_verify_otp(phone, code)` | `ok` / `invalid` / `expired` / `locked` |
| `fn_upsert_user(phone, name, email)` | Finds the account, or creates it after verification |
| `fn_otp_ttl_seconds()` | 300 — how long a code stays valid |
| `fn_otp_resend_seconds()` | 60 — gap between two codes to the same number |
| `fn_otp_max_attempts()` | 3 — wrong guesses before the code is burned |

## Sign-in

Customers sign in with a phone number and a six-digit code sent over WhatsApp.
There is no password anywhere in the flow.

```
POST /api/auth/otp/request  { phone, purpose, fullName?, email? }
POST /api/auth/otp/verify   { phone, code, fullName?, email? }
GET  /api/me                Authorization: Bearer <token>
```

`users.email` and `users.password_hash` are both nullable, and `users` carries
a `phone_verified_at` that is set the first time a number is verified.

Phone numbers are stored as `62xxxxxxxxx`, so `+62 812-3456-7890`,
`0812-3456-7890`, and `6281234567890` resolve to the same account.

`fn_request_otp` enforces the rules that cost money if they are missing:

- one live code per number — asking again retires the old one
- a second code within 60 seconds is refused
- the plaintext code is never stored, only `crypt(code, gen_salt('bf', 6))`
- the code expires after 5 minutes
- three wrong guesses burn the code; the fourth attempt returns `locked`

Creating the account happens *after* verification, inside `fn_upsert_user`, so
nobody can register a number they cannot receive a code on.

## How overbooking is prevented

Three layers, so no single mistake can oversell a class:

1. **`fn_book_session` locks the session row** with `SELECT … FOR UPDATE`
   before it counts seats. Two customers tapping *Book* at the same moment
   queue on that lock, and the second one re-reads `booked_count` after the
   first commits.
2. **`CHECK (booked_count <= capacity)`** on `class_sessions`. Even a
   hand-written `UPDATE` that skips the function cannot record more bookings
   than seats.
3. **A deferred trigger** recomputes `booked_count` and `waitlist_count` from
   the booking rows at commit, so the counters cannot drift.

The app should call `fn_book_session`, not insert into `bookings` directly.

## Design notes

- `COUNT(*) + 1` is not used for booking codes. Inside a multi-row `INSERT`
  every call sees the same snapshot, so all rows would get the same number;
  two concurrent transactions would collide too. A sequence is the only safe
  source, and codes have gaps by design.
- Money is `numeric(12,2)`, never float.
- Times are `timestamptz`, read and written in `Asia/Jakarta`.
- Status columns use `CHECK` + reference tables rather than `ENUM`, so adding a
  value does not need `ALTER TYPE` on a live table.
- `bookings.customer_name` is a deliberate snapshot, so an e-ticket still
  renders after the customer renames themselves.

## Seed data

| | |
|---|---|
| Branches | 8 |
| Class templates | 8 weekly slots |
| Sessions | 103, from 12 Oct 2026 through 9 Jan 2027 |
| Customers | 13 + 1 admin, all phone-verified |
| Bookings | 239, including one full class with a 2-person waitlist |

Passwords in the seed are all `password123`, hashed with `crypt()` from
`pgcrypto`. They are only there so the sample data has a value in the column —
the app never authenticates with one.

One deliberate difference from `../js/data.js`: the Friday Cadillac template
points at branch id `menteng`, but `BRANCH_DETAILS` there has no Menteng branch
(it lists Kemang instead), so the reference dangles. Here it is assigned to
Kemang.

`fn_expire_packages()` and `fn_close_finished_sessions()` are called once at the
end of the seed. In production they belong in a nightly job.