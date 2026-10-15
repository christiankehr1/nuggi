-- Care events (e.g. "Baden"): logged manually from the Verlauf "+" sheet.
-- kind = 'care', subtype = 'bath'. No running timer on Heute, but the
-- one-running-per-kind index still applies should one ever be left open.
--
-- 0001 declared the checks without names, so Postgres auto-named them:
-- the single-column one `events_kind_check`, the kind+subtype one `events_check`.
alter table events drop constraint if exists events_kind_check;
alter table events drop constraint if exists events_check;
alter table events drop constraint if exists events_subtype_check;
alter table events
  add constraint events_kind_check check (kind in ('sleep', 'feed', 'care')),
  add constraint events_subtype_check check (
    (kind = 'sleep' and subtype in ('nap', 'night')) or
    (kind = 'feed' and subtype in ('breast', 'bottle', 'solids')) or
    (kind = 'care' and subtype in ('bath'))
  );
