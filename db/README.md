# Database

PostgreSQL schema for The Body Project booking app. The front-end prototype
reads static data from `../js/data.js`; this database holds the real data model
and backs the OTP login endpoint in `../serve.js`.

Vocabulary matches `../js/data.js` — same branch codes, instructor names, class
titles, package names, and payment methods.

## Run

```bash
docker compose up -d          # Postgres 16 on localhost:5434
```

The three SQL files run automatically on first start, in order:

| File | Contents |
|---|---|
| `schema.sql` | Extensions, 15 tables, indexes, constraints, triggers, 4 views |
| `functions.sql` | 17 functions, the booking-code sequence, OTP settings |
| `seed.sql` | Reference data, 7 branches, 21 class templates, 30 days back and 90 days forward of sessions, demo bookings |

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
| Port | `5434` |
| Database | `the_body_project` |
| User / password | `tbp` / `tbp_dev_password` |
| Timezone | `Asia/Jakarta` |

To point the app at it later: `postgres://tbp:tbp_dev_password@localhost:5434/the_body_project`

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
| `branches` | 7 studios, hours, distance, flagship flag |
| `branch_facilities` | Facility chips per branch |
| `studios` | Rooms inside a branch |
| `instructors` | Name and role title |
| `class_types` | Reformer, Mat Flow, Cadillac, Prenatal, Tower |
| `class_templates` | The weekly recurring pattern |
| `class_sessions` | A bookable occurrence on a specific date |
| `users` | Customers and admins, identified by verified phone number |
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
| `fn_mark_attendance(booking, attended)` | Check-in for a class |
| `fn_expire_packages()` | Marks lapsed packages |
| `fn_close_finished_sessions()` | Retires past sessions |
| `fn_next_booking_code()` | `TBP-261015-0007` |
| `fn_request_otp(phone)` | Issues a six-digit code, returns it for the server to send |
| `fn_verify_otp(phone, code)` | `ok` / `invalid` / `expired` / `locked` |
| `fn_upsert_user(phone)` | Finds the account, or creates it after verification |
| `fn_set_full_name(user, name)` | Stores the name and sets `name_confirmed` |
| `fn_otp_ttl_seconds()` | 300 — how long a code stays valid |
| `fn_otp_resend_seconds()` | 60 — gap between two codes to the same number |
| `fn_otp_max_attempts()` | 3 — wrong guesses before the code is burned |

## Sign-in

There is no sign-up form. A customer types a phone number, proves they can
receive a code, and the account is created on the spot. Verifying the code *is*
the registration.

```
POST /api/auth/otp/request  { phone }
POST /api/auth/otp/verify   { phone, code }   → { token, needsName, user }
POST /api/auth/name         { name }          Authorization: Bearer <token>
GET  /api/me                Authorization: Bearer <token>
```

The app shows the name form only when `needsName` comes back true. That flag is
`users.name_confirmed` inverted, so a returning customer is never asked twice.
The name is required, not optional — it is what the e-ticket and the attendance
sheet are printed from.

`users` therefore has no `password_hash` and no email requirement.

### Phone numbers

Stored as `628xxxxxxxxx` — thirteen digits, no `+`, no spaces. That is exactly
what `+62 812-3456-7890`, `0812-3456-7890`, and `6281234567890` normalise to, so
all three reach the same account.

A `CHECK` constraint enforces the shape on both `users` and `otp_codes`. It
earns its keep: the sample data once carried a twelve-digit number, which
silently created a *second* account for Anindya instead of matching the first,
and she was asked for her name on every sign-in.

`fn_request_otp` enforces the rules that cost money if they are missing:

- one live code per number — asking again retires the old one
- a second code within 60 seconds is refused
- the plaintext code is never stored, only `crypt(code, gen_salt('bf', 6))`
- the code expires after 5 minutes
- three wrong guesses burn the code; the fourth attempt returns `locked`

Creating the account happens *after* verification, inside `fn_upsert_user`, so
nobody can register a number they cannot receive a code on.

`fn_set_full_name` records the name and flips `name_confirmed`, which is what
stops the app asking again on the next sign-in.

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
| Branches | 7, in the order the front-end lists them |
| Class templates | 21 weekly slots, three a day across seven branches |
| Sessions | 363, from 30 days back through 90 days forward of the seed date |
| Customers | 13 + 1 admin, all phone-verified and already named |
| Bookings | 127, one full class per branch, one of them with a 2-person waitlist |

Session dates are anchored on `CURRENT_DATE`, not written into the file, so
re-seeding always gives a fresh 30-days-back / 90-days-forward window. `js/data.js`
does the same with `CAL_TODAY`.

Bookings are spread over every branch, at three fill levels per branch: one class
right up, one with a single seat left, one about half full. That way all three
quota badges appear on every branch without filling the whole 90-day timetable.
Package quota is allocated against what each customer actually has left and is
decremented to match, so `remaining_sessions` never disagrees with the bookings
that point at it.

Seeded accounts never trigger the name form, so signing in with any of their
numbers goes straight into the app.

There is no password column and no password anywhere in the seed. Signing in is
phone number plus a one-time code; `verify.sql` test 21 asserts that neither
`password_hash` nor `loyalty_points` exists. The `pgcrypto` extension is still
installed for `gen_salt`/`crypt`, which is what a later revision would use if
password login were ever added.

There are no deliberate differences from `../js/data.js` any more. `class_templates`
holds the same 21 weekly patterns as `JADWAL_MINGGUAN`, every one pointing at a
branch that exists. The old seed had a Friday Cadillac template pointing at branch
id `menteng`, which `BRANCH_DETAILS` never defined, so it was quietly reassigned
to Kemang; that template is gone along with Menteng, Senopati, TB Simatupang,
Grand Indonesia, and PIK Avenue.

`fn_expire_packages()` and `fn_close_finished_sessions()` are called once at the
end of the seed. In production they belong in a nightly job.