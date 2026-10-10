-- Daily family reminders (e.g. "Vitamine" at 08:00), configured in Einstellungen.
-- Stored as a JSON array on the family:
--   [{ "id": "...", "name": "Vitamine", "time": "08:00", "enabled": true, "push": true, "inApp": true }]
alter table families
  add column if not exists daily_reminders jsonb not null default '[]'::jsonb;

-- Daily reminders belong to the family, not to a baby.
alter table reminders_sent alter column baby_id drop not null;
