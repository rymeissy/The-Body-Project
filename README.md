# The Body Project — Booking App Prototype

Mobile web application prototype for booking Pilates classes at Studio Pilates
The Body Project. Front-end only, no backend.

`db/` holds the PostgreSQL schema the app is meant to be wired to — see
[db/README.md](db/README.md).

## Run

```bash
node serve.js          # http://localhost:4173
node serve.js 8080     # custom port
```

| URL | Purpose |
|---|---|
| `/` | Application (starts at the auth screen) |
| `/preview.html` | The app rendered at 390 / 820 / 1366px side by side |
| `/index.html?demo=1` | Skip the auth gate and open the app directly |

No build step and no dependencies — vanilla JS and CSS custom properties.

## Structure

```
prototype/
├── index.html      # Markup, auth screen, five views, booking sheet
├── preview.html    # Side-by-side responsive preview
├── serve.js        # Dependency-free static server
├── css/style.css   # Design tokens, components, media queries
├── db/             # PostgreSQL schema, functions, and seed data
└── js/
    ├── data.js     # Sample data: classes, packages, instructors, branches
    └── app.js      # Auth, navigation, filtering, rendering, booking flow
```

## Database

```bash
cd db && docker compose up -d     # Postgres 16 on localhost:5433
```

`schema.sql` (14 tables, 4 views), `functions.sql` (booking, cancellation,
waitlist promotion, session generation), and `seed.sql` (8 branches, 103
sessions, 239 bookings) run automatically on first start. `db/verify.sql`
exercises the whole booking path and rolls back afterwards.

## Layout

The app column is fixed at **512px** on every screen size. The bottom
navigation is **430px** and stays at the bottom of the viewport. There is no
desktop layout — on wide screens the column stays narrow and centred with white
gutters on both sides.

| Viewport | Adjustment |
|---|---|
| `< 300px` | Smaller nav and calendar fonts |
| `300–480px` | Tighter padding, shorter calendar cells |
| `≥ 768px` | Rounded top corners and soft shadow on the nav |
| Height `< 560px` | Shorter sheet, progress bar, and chart |

## Design tokens

| Token | Value | Used for |
|---|---|---|
| `--green-800` | `#26513F` | Header, primary buttons, active tab |
| `--green-700` | `#2E5B4A` | Accent text, tags, selected borders |
| `--cream-50` | `#FBF9F5` | Content background |
| `--cream-100` | `#F5F1E9` | Page background, panel headers |
| `--cream-200` | `#EDE7DA` | Dividers, progress track |
| `--gold-600` | `#A8863C` | Slot status badges |
| `--red-700` | `#B23B2E` | Full / waitlist badges |
| `--ink-900` | `#1C2620` | Primary text |

Typefaces: `Fraunces` for headings, `Inter` for UI, with system fallbacks.

## Screens

**Auth** — sign in with email or WhatsApp number, or register with name, email,
phone, and password. Inline validation, password strength meter, and
show/hide toggle. Session persists in `localStorage`; signing out from Profile
clears it.

**Schedule** — branch picker and opening hours, active package card with
remaining sessions and progress bar, a 7-day strip, class-type filters, and
class cards. Full classes show a red badge and a secondary **Gabung Waitlist**
button instead of **Book Sesi**.

**Branches** — 8 studios with hero image, opening hours, distance, address,
facility chips, a **Lihat Jadwal (N Sesi)** button, and a map icon that opens
Google Maps.

**Packages**, **History**, **Profile** — session packages, booking activity,
and account details.

## Booking flow

```
Class card
  └─ Book Sesi / Gabung Waitlist
       └─ Step 1 — Package
            • Use package quota (deducted automatically)
            • Buy drop-in          Rp 375.000
            • Join waitlist        (class is full)
            └─ Step 2 — Attendee details + policies
                 └─ Step 3 — Payment
                      (QRIS · BCA VA · GoPay/OVO · Credit card)
                      └─ Confirmation → e-ticket + history entry
```

Booking deducts the package quota, updates the capacity badge, and appends the
booking to History.

## Notes

- Classes for dates beyond the current week are generated from
  `JADWAL_MINGGUAN` in `data.js` using a fixed seed, so the demo data stays
  stable across reloads.
- The calendar strip shifts to the selected week, so a date picked in the
  date picker stays visible.
- Sample branch data (addresses, phone numbers, opening hours, distances) is
  placeholder and should be replaced with real data.
- Images are placeholders: replace `.branch-card__hero` with a
  `background-image`, and swap `.avatar--ring` initials for an `<img>` in
  `classCard()`.

## Not implemented

1. Admin screens for schedules, capacity, packages, and attendance
2. Merchandise storefront
3. Class search (`state.search` exists in `app.js` but has no input)
4. Persistent state — resets on reload
5. Backend integration — the app still reads `data.js` instead of `db/`
