-- Stillen-Hinweis: a running breast feed sends one push once it has lasted
-- breastCueMinutes (reminders.breast toggles it). The app merges its defaults
-- over stored JSON, so existing rows need no backfill; the column default is
-- kept in sync for rows inserted without settings. Idempotent.
alter table babies alter column settings set default '{
  "napLeadMinutes": 15,
  "feedIntervalMinutes": null,
  "breastCueMinutes": 15,
  "bedtimeTarget": "19:00",
  "nightStart": "19:00",
  "nightEnd": "07:00",
  "reminders": { "nap": true, "feed": true, "bedtime": true, "breast": true }
}'::jsonb;
