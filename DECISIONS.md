# Decisions

Choices made while building Nuggi that are not obvious from the code.

## Phase 1 – Scaffold, data, login

- **Next.js 16.3 with Turbopack, Serwist in "configurator" mode.** `@serwist/next`'s
  webpack plugin does not support Turbopack. Instead `serwist.config.ts` +
  `serwist inject-manifest` runs after `next build` (see `npm run build`). The
  service worker is registered by a small client component instead of the plugin.
- **No Cache Components / `use cache`.** Every app route is dynamic (reads the
  session cookie). The data set per family is tiny; simplicity wins.
- **`proxy.ts` (Next 16 name for middleware) does optimistic auth only.** It
  redirects unauthenticated users to `/login`, renews the sliding session cookie,
  and enforces HTTP basic auth on `/admin`. Real authorization is
  `requireSession()` inside every server action / page.
- **Session = HS256 JWT (jose) in an httpOnly cookie, 180 days, renewed when
  fewer than 150 days remain.** Pure helpers in `src/lib/session.ts` are unit
  tested; cookie glue is in `src/lib/auth.ts`.
- **Family code alphabet** `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (31 chars, no 0 O 1 I L).
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
  seeded PRNG) so the same rhythm appears on every `npm run seed`, and the same
  generator can feed prediction tests.
