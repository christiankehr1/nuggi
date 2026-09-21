-- Nuggi initial schema
-- All access happens through the service-role key from server code.
-- RLS is enabled on every table with NO policies: anon/authenticated are denied.


-- ---------------------------------------------------------------------------
-- families
-- ---------------------------------------------------------------------------
create table if not exists families (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  code_prefix   text not null,
  code_hash     text not null,
  timezone      text not null default 'Europe/Zurich',
  created_at    timestamptz not null default now()
);
create index if not exists families_code_prefix_idx on families (code_prefix);

-- ---------------------------------------------------------------------------
-- members
-- ---------------------------------------------------------------------------
create table if not exists members (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  name          text not null,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now()
);
create unique index if not exists members_family_name_uidx on members (family_id, lower(name));

-- ---------------------------------------------------------------------------
-- babies
-- ---------------------------------------------------------------------------
create table if not exists babies (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  name          text not null,
  birth_date    date not null,
  sex           text check (sex in ('f', 'm')),
  settings      jsonb not null default '{
    "napLeadMinutes": 15,
    "feedIntervalMinutes": null,
    "bedtimeTarget": "19:00",
    "nightStart": "19:00",
    "nightEnd": "07:00",
    "reminders": { "nap": true, "feed": true, "bedtime": true }
  }'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists babies_family_idx on babies (family_id);

-- ---------------------------------------------------------------------------
-- events (sleep + feed)
-- ---------------------------------------------------------------------------
create table if not exists events (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  baby_id       uuid not null references babies(id) on delete cascade,
  member_id     uuid references members(id) on delete set null,
  kind          text not null check (kind in ('sleep', 'feed')),
  subtype       text not null check (
                  (kind = 'sleep' and subtype in ('nap', 'night')) or
                  (kind = 'feed' and subtype in ('breast', 'bottle', 'solids'))
                ),
  started_at    timestamptz not null,
  ended_at      timestamptz,
  amount_ml     int check (amount_ml is null or (amount_ml >= 0 and amount_ml <= 2000)),
  side          text check (side is null or side in ('L', 'R', 'both')),
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint events_ended_after_started check (ended_at is null or ended_at >= started_at)
);
create index if not exists events_family_baby_started_idx
  on events (family_id, baby_id, started_at desc);
-- at most one running sleep and one running feed per baby
create unique index if not exists events_one_running_per_kind_uidx
  on events (baby_id, kind) where ended_at is null;

-- ---------------------------------------------------------------------------
-- measurements
-- ---------------------------------------------------------------------------
create table if not exists measurements (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  baby_id       uuid not null references babies(id) on delete cascade,
  member_id     uuid references members(id) on delete set null,
  kind          text not null check (kind in ('weight_g', 'height_cm', 'head_cm', 'temp_c')),
  value         numeric not null,
  measured_at   timestamptz not null,
  note          text,
  created_at    timestamptz not null default now()
);
create index if not exists measurements_family_baby_kind_idx
  on measurements (family_id, baby_id, kind, measured_at desc);

-- ---------------------------------------------------------------------------
-- push_subscriptions
-- ---------------------------------------------------------------------------
create table if not exists push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references families(id) on delete cascade,
  member_id       uuid references members(id) on delete set null,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_success_at timestamptz,
  failures        int not null default 0
);
create index if not exists push_subscriptions_family_idx on push_subscriptions (family_id);

-- ---------------------------------------------------------------------------
-- reminders_sent
-- ---------------------------------------------------------------------------
create table if not exists reminders_sent (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  baby_id       uuid not null references babies(id) on delete cascade,
  kind          text not null,
  dedupe_key    text not null unique,
  sent_at       timestamptz not null default now()
);
create index if not exists reminders_sent_sent_at_idx on reminders_sent (sent_at);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on events;
create trigger events_set_updated_at
  before update on events
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Deny-all RLS (defence in depth: the browser never gets a Supabase key)
-- ---------------------------------------------------------------------------
alter table families            enable row level security;
alter table members             enable row level security;
alter table babies              enable row level security;
alter table events              enable row level security;
alter table measurements        enable row level security;
alter table push_subscriptions  enable row level security;
alter table reminders_sent      enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on all tables in schema public from authenticated;
  end if;
end $$;
