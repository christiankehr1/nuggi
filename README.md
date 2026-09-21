# Nuggi – Baby-Tracker als iOS-PWA

Nuggi tracks a baby's sleep, feeds and measurements, predicts the next nap, shows a
weekly dashboard and sends push reminders. It runs on iPhones as an installed
home-screen web app (iOS 16.4+) – no App Store, no TestFlight.

- **Stack:** Next.js 16 (App Router, Server Actions), TypeScript strict, Tailwind 4,
  Supabase Postgres (region Zurich), Serwist service worker, web-push, Recharts, Vitest.
- **Login:** one family code (`XXX-XXXX`) + your name. No accounts, no e-mail.
- **Isolation:** every query is scoped to the family in the signed session cookie.
  See [DECISIONS.md](DECISIONS.md) for the reasoning behind the design.
- **Für Familien:** [So installierst du Nuggi auf dem iPhone](docs/INSTALL-iphone.md)

---

## 1. Setup

### 1.1 Supabase project (Zurich)

1. Create a project at <https://supabase.com/dashboard> → **Region: Zurich (eu-central-2)**.
2. Apply the schema. Either paste `supabase/migrations/0001_init.sql` into
   **SQL Editor → New query → Run**, or with the direct connection string:

   ```bash
   DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-1-eu-central-2.pooler.supabase.com:5432/postgres" npm run db:migrate
   ```

   Migrations are idempotent. RLS is enabled on every table with no policies; the
   browser never receives a Supabase key.
3. Copy **Project URL** and the **service_role** key from *Settings → API*.

### 1.2 Environment

```bash
cp .env.example .env.local
```

| Variable                    | Purpose                                                        |
| --------------------------- | -------------------------------------------------------------- |
| `SUPABASE_URL`              | Project URL                                                    |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (server only)                                 |
| `SESSION_SECRET`            | ≥ 32 random chars: `openssl rand -base64 48`                   |
| `ADMIN_SECRET`              | Basic-auth password for `/admin` (any username)                |
| `CRON_SECRET`               | Bearer token for `/api/cron/reminders`                         |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web push: `npx web-push generate-vapid-keys`, subject `mailto:you@example.com` |
| `NEXT_PUBLIC_APP_URL`       | Public URL, e.g. `https://nuggi.vercel.app`                    |

### 1.3 Run

```bash
npm install
npm run dev            # http://localhost:3000
npm run seed           # demo family (code is printed) + a second family to prove isolation
npm run family:create -- "Familie Müller"
```

Checks: `npm run typecheck && npm run lint && npm run test && npm run build`

### 1.4 Create families

- **Admin UI:** open `/admin`, log in with any username and `ADMIN_SECRET`, create a
  family. The code is shown once – pass it on to the parents.
- **CLI:** `npm run family:create -- "Familie Müller" [Europe/Zurich]`

Both parents (and grandparents) enter the same code on their own phones.

---

## 2. Deploy to Vercel

1. Push the repo to GitHub and import it in Vercel (framework preset: Next.js).
2. Add all variables from the table above in *Settings → Environment Variables*.
3. Deploy. `vercel.json` pins the region to Frankfurt (`fra1`, closest to Zurich)
   and registers a **daily** cron that pings `/api/health` (Vercel Hobby only
   allows one run per day – it serves as a health check, not as the scheduler).
4. Open the deployment on an iPhone in Safari, install it (see the one-pager), and
   activate reminders under *Einstellungen → Erinnerungen*.

---

## 3. Reminder scheduler (every 5 minutes)

`POST /api/cron/reminders` with header `Authorization: Bearer <CRON_SECRET>` runs the
prediction for every baby, sends due reminders (nap lead time, next feed, bedtime)
to all of the family's devices and records them in `reminders_sent` so nothing is
sent twice. Feed reminders are muted between `nightStart` and `nightEnd` for babies
older than 12 weeks. Dead subscriptions (3× 404/410) are deleted.

Vercel Hobby crons run at most once per day, so trigger the endpoint externally:

### Option A – cron-job.org (recommended, free)

1. Create an account at <https://cron-job.org>, **Create cronjob**.
2. URL: `https://<your-app>/api/cron/reminders`
3. Schedule: *Every 5 minutes*.
4. Advanced → **Request method:** `POST`; **Headers:** add
   `Authorization` = `Bearer <CRON_SECRET>`.
5. Save and check the execution history: a successful run returns
   `{"ok":true,"babies":…,"due":…,"sent":…}`.

### Option B – Supabase pg_cron + pg_net

In the Supabase SQL editor (enable the `pg_cron` and `pg_net` extensions first under
*Database → Extensions*):

```sql
select cron.schedule(
  'nuggi-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<your-app>/api/cron/reminders',
    headers := '{"Authorization": "Bearer <CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

Remove with `select cron.unschedule('nuggi-reminders');`.

---

## 4. Local development without a Supabase project

A local stand-in runs PGlite (in-process Postgres) behind the Postgres wire protocol
with a PostgREST binary in front, so `supabase-js` works unchanged:

```bash
mkdir -p .local/bin
curl -L https://github.com/PostgREST/postgrest/releases/latest/download/postgrest-v16.3-macos-aarch64.tar.xz | tar -xJ -C .local/bin
brew install libpq          # PostgREST links against libpq
npm run dev:db              # prints SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY for .env.local
npm run seed
npm run dev
```

Data persists in `.local/db`. Constraint violations briefly drop the bridge
connection (PostgREST reconnects automatically) – that's a limitation of the bridge,
not of Supabase.

---

## 5. Quality

Lighthouse 13 (mobile, production build, Chrome headless) – the PWA category no
longer exists in Lighthouse 12+, installability is covered by the manifest /
service-worker audits inside *Best Practices* and by the real-device checklist:

| Page      | Performance | Accessibility | Best Practices | SEO |
| --------- | ----------- | ------------- | -------------- | --- |
| `/login`  | 98          | 100           | 100            | 100 |
| `/heute`  | 94          | 100           | 100            | 100 |

Before every commit: `npm run typecheck && npm run lint && npm run test && npm run build`
(88 unit tests: prediction, statistics, summary, family code, session, rate limit,
migrations on PGlite, isolation source scan, CSV, reminders, demo data).

Real-device QA: [docs/DEVICE-CHECKLIST.md](docs/DEVICE-CHECKLIST.md).

## 6. Project map

```
src/app            routes: login, (app)/{heute,verlauf,statistik,einstellungen}, admin, api/*, sw.ts, manifest.ts
src/actions        server actions (Zod-validated, session-scoped)
src/lib/db         data access; withFamily()/ownedBy() scope every query
src/lib/sleep      prediction (pure, tested) + age priors
src/lib/stats      weekly aggregates + summary sentences (pure, tested)
src/lib/push       reminder logic (pure, tested) + web-push sender
src/i18n/de.ts     every user-facing string
supabase/migrations
scripts            seed, family:create, migrate, icons, dev-db
docs               German one-pager, real-device checklist
```

---

## 7. Datenschutz

Nuggi speichert Schlaf-, Mahlzeit- und Messdaten von Kindern. Die Datenbank liegt in
der Schweiz (Supabase eu-central-2). Es gibt keine Konten, keine E-Mail-Adressen und
kein Tracking. Nuggi ist eine Orientierungshilfe, kein medizinischer Rat.
