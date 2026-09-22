# Decisions

Choices made while building Nuggi that are not obvious from the code.

## Phase 1 – Scaffold, data, login

- **Next.js 16.3 with Turbopack, Serwist in "configurator" mode.** `@serwist/next`'s
  webpack plugin does not support Turbopack. Instead `serwist.config.mts` +
  `serwist build` runs after `next build` (see `npm run build`). The service
  worker is registered by a small client component (`SwRegister`) instead of the plugin.
- **No Cache Components / `use cache`.** Every app route is dynamic (reads the
  session cookie). The data set per family is tiny; simplicity wins.
- **`proxy.ts` (Next 16 name for middleware) does optimistic auth only.** It
  redirects unauthenticated users to `/login`, renews the sliding session cookie,
  and enforces HTTP basic auth on `/admin`. Real authorization is
  `requireSession()` inside every server action / page / route handler.
- **Session = HS256 JWT (jose) in an httpOnly cookie, 180 days, renewed when
  fewer than 150 days remain.** Pure helpers in `src/lib/session.ts` are unit
  tested; cookie glue is in `src/lib/auth.ts`.
- **Family code alphabet** `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (31 chars, no 0 O 1 I L).
  The spec's example `WAL-7K2Q` contains an `L`, so the example became `NUG-7K2Q`.
  Login normalises input (case, spaces, missing dash). Prefix (3 chars) stored in
  plaintext and indexed; full code bcrypt-hashed (10 rounds). Lookup by prefix
  then `bcrypt.compare` per candidate.
- **Rate limit is in-memory per function instance.** On Vercel that means "10
  per 15 min per warm instance", which is enough against brute force on a
  31^7 ≈ 27 billion code space for a friends-and-family app. A shared store
  (Upstash) would be the upgrade path.
- **Data isolation is structural, not just disciplined.** Data functions take
  a `FamilyScope` that only `requireSession()` can create; `withFamily()` /
  `ownedBy()` add the filter. `tests/isolation.test.ts` scans the source to
  assert no action/route accepts a family id, every scoped module filters, and
  the three cross-family modules (`login.ts`, `admin.ts`, `cron.ts`) are only
  imported by their entry points.
- **RLS on with zero policies, plus `revoke all` from `anon`/`authenticated`.**
  The browser never receives a Supabase key; the service-role key is the only
  path. The revoke is a second belt for the case someone adds a policy later.
- **Migrations are tested with PGlite** (in-memory Postgres) so constraints
  (partial unique index for running timers, kind/subtype checks, case-insensitive
  member names, cascade) are verified without Docker or a Supabase project.
  `gen_random_uuid()` is built into Postgres 13+, so no `pgcrypto` extension.
- **`npm run db:migrate` uses `pg` + `DATABASE_URL`** as a convenience; the
  README also documents the Supabase SQL editor path. Migrations are idempotent.
- **Scripts do not import `server-only` modules.** `scripts/lib/supabase.ts`
  builds its own service-role client so `tsx` can run seeds locally.
- **Member names are unique per family, case-insensitively.** "Mama" and "mama"
  are the same person; logging in with an existing name reuses the member row.
- **Timestamps cross the server/client boundary as ISO strings.** Pure modules
  parse to `Date` internally. Family timezone defaults to Europe/Zurich and is
  passed explicitly to every formatting helper.
- **Demo seed data is generated deterministically** (`scripts/lib/demo-data.ts`,
  seeded PRNG) and validated by `tests/demo-data.test.ts` so the seed can never
  violate the schema.

## Local development stack

- **PGlite + pglite-socket + PostgREST binary = local Supabase stand-in**
  (`npm run dev:db`). A small Node proxy strips the `/rest/v1` prefix that
  supabase-js adds. Prepared statements are disabled in PostgREST because the
  bridge reuses statement names. A constraint violation kills the bridge
  connection (PostgREST reconnects); the app itself checks running timers before
  inserting so this does not surface in normal use. This stack was used to verify
  login, isolation, logging, statistics, export and the cron endpoint end to end.

## Phase 2 – Logging

- **Server actions take plain JSON, not FormData**, and return a uniform
  `ActionResult`. This lets the offline outbox serialise and replay them.
- **Bottle and solids are instant events** (`ended_at = started_at`); breast
  feeds and sleeps are running timers ended with one tap. At most one running
  sleep and one running feed per baby (partial unique index + action check).
- **Backdating uses the native `datetime-local` wheel** plus quick chips
  (Jetzt, −5, −15, −30, −60, −120 min). No custom wheel: the iOS one is better.
- **Selected baby lives in a cookie (`nuggi_baby`)** but is always matched
  against the session's own babies on read, so it cannot leak across families.
- **Undo restores the row with its original id and author**, but only if the
  author is a member of the current family; otherwise the restoring member is used.
- **Sheets mount their form only while open**, so forms initialise state from
  props without effects (React Compiler lint rules forbid setState in effects).
- **Custom CSS lives in `@layer base/components`** so Tailwind utilities keep
  winning. Unlayered CSS would silently override utilities like `px-0`.
- **`animate-fade-up` uses `backwards` fill**: a lingering transform would turn
  a page container into the containing block for `position: fixed` children
  (the floating "+" disappeared).

## Phase 3 – Prediction

- **Age brackets are in completed weeks** (0–4, 5–12, 13–21, 22–30, 31–43,
  44–56, 57–82, 83+), approximating the month ranges of the spec.
- **Position factor** (0.9 / 1.0 / 1.1) is decided by naps done today versus the
  expected number of naps for the age: 0 naps → first window, ≥ expected − 1 →
  last window before bedtime.
- **Nap length clamp** is `[0.6, 1.6] × prior default` (the prior is a single
  value, not a range).
- **Wake windows exclude night wakings, not early risers:** a gap counts unless
  both surrounding sleeps are night sleeps and the gap starts inside the night
  window. Used identically by prediction and statistics.
- **"Too late for a nap"**: if the next nap would start within half a nap
  length of bedtime, the next sleep is the night (`nextIsBedtime`).
- **The "too little daytime sleep → earlier bedtime" rule only fires from
  3 h before the bedtime target**; earlier in the day the deficit is expected.
- **No sleep data at all** anchors the first window at today's `nightEnd`.

## Phase 4 – Statistics

- **Bedtime of a day** = first night sleep starting ≥ 16:00 that day.
- **Rolling 7-day average** uses last week's days as history and stops at today.
- **WHO growth percentiles were not bundled.** Shipping LMS tables from memory
  risks wrong medical reference values; the chart component is ready for a
  reference series once the official WHO tables are added from
  <https://www.who.int/tools/child-growth-standards/standards>.
- **CSV export** carries local and UTC timestamps, a UTF-8 BOM for Excel, and
  the author name.

## Phase 5 – PWA and push

- **Outbox** = IndexedDB queue replayed oldest-first on `online`, tab visibility
  and mount. Permanent failures (validation, conflict) are dropped; network
  failures stop the replay to keep order.
- **Reminder dedupe key** = `${babyId}:${kind}:${time rounded to 10 min}` with a
  unique index, so overlapping cron runs cannot double-send. Rows older than
  3 days are pruned by the cron run itself.
- **Quiet hours** mute feed reminders inside the night window for babies ≥ 12
  weeks; nap and bedtime reminders only fire while the baby is awake.
- **Dead subscriptions**: 404/410 increments `failures`; the row is deleted at 3.
- **The cron route accepts GET and POST** so any scheduler works; both need the
  bearer secret. `vercel.json` only registers the daily `/api/health` ping.
- **Push status is per device**: the settings section checks this device's
  endpoint against the family's subscriptions, and explains the standalone
  requirement on iOS instead of failing silently.

## Phase 6 – Polish

- **Lighthouse 12+ removed the PWA category.** Installability is verified via the
  manifest/service-worker audits in "Best Practices" and on a real device
  (`docs/DEVICE-CHECKLIST.md`); performance, accessibility and best-practices
  scores are reported in the README.

## Phase 7 – iPhone 16 Pro polish

- **Page titles start below the status-bar glass.** iOS 26+ blurs the content
  under a `black-translucent` status bar in an installed web app, and the
  blur fades out ~40px below the bar – the Heute header sat right in that band
  and looked smeared. `--top-inset` = `safe-top + 2.75rem` whenever there is a
  status-bar inset (the `min(inset × 100, 2.75rem)` trick yields 0 without an
  inset), so a browser tab keeps its 1rem. Switching the status bar to `black`
  would avoid the blur too, but costs the translucent navy look.
- **The ring's viewBox includes the outside markers.** Sun/moon markers sit at
  `R + STROKE + 8` with radius 12, which exceeded the old 320px viewBox at 6 h
  and 18 h; the bedtime moon was cut in half. `SIZE` is derived from the marker
  geometry now.
- **Feeds are drawn on the ring, not next to it.** A mint disc with the
  breast/bottle/bowl icon at the feed's start minute, layered between the
  sleep arcs and the "now" dot. Inside the ring they would collide with the
  centre copy, outside with the hour labels and the sun/moon markers.
- **Floating tab bar.** The bar is a frosted pill `--tabbar-gap` above the
  home-indicator inset; its wrapper is `pointer-events: none` so the page keeps
  scrolling under it. Everything that floats above the bar (toast, install
  banner, the Verlauf "+") is positioned from `--tabbar-clearance`, and pages
  pad with `--content-bottom` so the last row scrolls fully clear of the pill.
