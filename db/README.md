# Database

PostgreSQL schema for The Body Project booking app. The front-end prototype is
static (`../js/data.js`), so this database exists to define the real data model
and to be the target the app is wired to later.

Vocabulary matches `../js/data.js` — same branch codes, instructor names, class
titles, package names, and payment methods.

## Run

```bash
docker compose up -d          # Postgres 16 on localhost:5433
```

The three SQL files run automatically on first start, in order:

| File | Contents |
|---|---|
| `schema.sql` | Extensions, 14 tables, indexes, constraints, triggers, 4 views |
| `functions.sql` | 7 functions and the booking-code sequence |
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
promotion, attendance, and a final invariant check that must print five zeros.

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
| Customers | 13 + 1 admin |
| Bookings | 239, including one full class with a 2-person waitlist |

Passwords are all `password123`, hashed with `crypt()` from `pgcrypto`.

One deliberate difference from `../js/data.js`: the Friday Cadillac template
points at branch id `menteng`, but `BRANCH_DETAILS` there has no Menteng branch
(it lists Kemang instead), so the reference dangles. Here it is assigned to
Kemang.

`fn_expire_packages()` and `fn_close_finished_sessions()` are called once at the
end of the seed. In production they belong in a nightly job.