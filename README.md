# Nuggi – Baby-Tracker as iOS-PWA

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
2. Apply the schema. Either paste each file in `supabase/migrations/` (in order) into
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
older than 12 weeks. A running breast feed sends „Stillen läuft seit 15 Min“ once it
has lasted `breastCueMinutes` (per baby, default 15) – exactly once per feed. Dead
subscriptions (3× 404/410) are deleted.

The breast cue is sent by the first run after the threshold, so its lag is the
scheduler's interval: run the endpoint every minute if it should be punctual
(cron-job.org allows that; GitHub Actions' minimum is 5 minutes).

Vercel Hobby crons run at most once per day, so trigger the endpoint externally:

### Option A – cron-job.org (recommended, free)

1. Create an account at <https://cron-job.org>, **Create cronjob**.
2. URL: `https://<your-app>/api/cron/reminders`
3. Schedule: *Every 1 minute* (every 5 minutes is enough if the breast cue may lag).
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

## 4. How the sleep prediction works

`predict()` in [`src/lib/sleep/predict.ts`](src/lib/sleep/predict.ts) is a pure function:
no machine learning, no network, no `Date.now()` – the same events and `now` always give
the same answer. It starts from what is typical for the baby's age, trusts the baby's own
logged rhythm more as data accumulates, and counts forward from the last time the baby
woke up. Every step appends a German sentence to `reasoning`, which the *Warum?* panel on
the Heute screen shows as-is.

![Pipeline: age prior and last-7-days observations are blended into a wake window, which is added to an anchor time to give the next nap; bedtime is computed separately](docs/sleep-prediction/pipeline.svg)

The same diagrams as an interactive page with a day simulator:
[`docs/sleep-prediction/index.html`](docs/sleep-prediction/index.html) (download and open
locally) or as a [PDF](docs/sleep-prediction/sleep-prediction.pdf).

### 4.1 Age prior

The baby's age in completed weeks picks one row of `AGE_PRIORS`
([`src/lib/sleep/priors.ts`](src/lib/sleep/priors.ts)). The midpoint of the wake-window
range is the starting guess. The clamp range bounds the final window no matter what the
logs say.

| Bracket       | From week | Wake window | Midpoint | Naps | Nap length | Clamp range (0.8·min – 1.2·max) |
| ------------- | --------: | ----------- | -------: | ---- | ---------: | ------------------------------- |
| 0–4 weeks     | 0         | 35–60 min   | 47.5     | 4–6  | 40 min     | 28–72 min                       |
| 5–12 weeks    | 5         | 60–90 min   | 75       | 4–5  | 45 min     | 48–108 min                      |
| 3–4 months    | 13        | 75–120 min  | 97.5     | 3–4  | 45 min     | 60–144 min                      |
| 5–6 months    | 22        | 120–150 min | 135      | 3    | 60 min     | 96–180 min                      |
| 7–9 months    | 31        | 150–210 min | 180      | 2–3  | 75 min     | 120–252 min                     |
| 10–12 months  | 44        | 180–240 min | 210      | 2    | 75 min     | 144–288 min                     |
| 13–18 months  | 57        | 240–330 min | 285      | 1–2  | 90 min     | 192–396 min                     |
| 19+ months    | 83        | 300–360 min | 330      | 1    | 100 min    | 240–432 min                     |

### 4.2 Observed rhythm (`observe()`)

Finished sleeps of the last 7 days, sorted by start. The gap between one sleep's end and
the next one's start is a **wake window** if it lasts 10 min – 8 h and is not a night
waking (night→night gap ending inside `nightStart`–`nightEnd`). A sleep tagged `nap`
lasting 5–240 min is a **nap length**. Both lists are reduced with a **trimmed median**:
drop the top and bottom 10 % (rounded down), take the median.

![A day of logged sleeps; the gaps between them are measured as wake windows, the nap durations as nap lengths](docs/sleep-prediction/observe.svg)

### 4.3 Blend

With `n` observed wake windows:

```
w      = min(0.7, max(0, (n − 2) / 8))
window = (1 − w) · priorMidpoint · positionFactor  +  w · observedMedian
window = round(clamp(window, 0.8 · windowMin, 1.2 · windowMax))
```

Observations start counting after 2 windows and cap at 70 % from n ≈ 8, so the age norm
always keeps 30 %. The same `n` sets the confidence label: `niedrig` (< 3),
`mittel` (3–9), `hoch` (≥ 10). Nap length uses the same blend on the number of observed
naps, clamped to 0.6–1.6 × the prior nap length.

![Observed weight rises from 0 at n = 2 to the 70 % cap at n ≈ 8; background bands show the confidence levels](docs/sleep-prediction/blend-weight.svg)

### 4.4 Position in the day

The prior part is scaled by where the upcoming gap sits, counted by naps already done
today (a nap in progress counts as done): **×0.9** for the first window after waking,
**×1.1** once `napsDone ≥ round(avg naps) − 1`, **×1.0** in between.

![Day split into wake windows: first ×0.9, middle ×1.0, last before bed ×1.1](docs/sleep-prediction/position-factor.svg)

### 4.5 Anchor → next nap

`nextNapStart = anchor + window`, shown as a ±15 min window. The anchor is:

| State            | Anchor                                                          |
| ---------------- | --------------------------------------------------------------- |
| asleep (nap)     | predicted wake-up = nap start + nap length (at least now + 5 min) |
| asleep (night)   | `nightEnd`; tomorrow's bedtime is shown                          |
| awake            | end of the last sleep, if it ended within the last 16 h          |
| no usable data   | `nightEnd`, or now if it is still earlier (said in the reasoning) |

### 4.6 Bedtime

```
bedtime = max(lastNapEnd + lastWindow, target − 45)
bedtime = clamp(bedtime, target − 60, target + 45)
daytime naps today > expected + 30 min                  → +15 min
daytime naps today < expected − 45 min (after target − 3 h, ≥ 1 nap) → −15 min
nextNapStart > bedtime − napLength / 2                  → no more naps, next sleep is bedtime
```

Expected daytime sleep = average naps × prior nap length. Once the baby is asleep for the
night, or it is more than 90 min past bedtime, tomorrow's target is shown.

![Bedtime range around a 19:00 target: hard minimum 18:00, usual floor 18:15, maximum 19:45](docs/sleep-prediction/bedtime.svg)

### 4.7 Example day

A 4-month-old with 12 observed windows (median 110 min, naps 45 min), waking at 07:00 with
a 19:00 target: windows of 103 / 106 / 106 / 109 min give naps at 08:43, 11:14, 13:45 and
16:19; the next window would end after bedtime − 23 min, so the evening sleep follows at
18:53.

![Simulated day: four naps with their ±15 min windows and bedtime at 18:53](docs/sleep-prediction/simulated-day.svg)

### 4.8 Feeds

`nextFeedAt = lastFeedStart + interval`, where the interval is the baby's
`feedIntervalMinutes` setting or, by age, 150 min (≤ 4 weeks), 180 (≤ 12), 210 (≤ 30),
then 240. The reminder cron uses the same `Prediction` object, so the ring and the push
notifications never disagree.

---

## 5. Local development without a Supabase project

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

## 6. Quality

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

## 7. Project map

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
docs               German one-pager, real-device checklist, sleep-prediction diagrams
```

---

## 8. Datenschutz

Nuggi speichert Schlaf-, Mahlzeit- und Messdaten von Kindern. Die Datenbank liegt in
der Schweiz (Supabase eu-central-2). Es gibt keine Konten, keine E-Mail-Adressen und
kein Tracking. Nuggi ist eine Orientierungshilfe, kein medizinischer Rat.
