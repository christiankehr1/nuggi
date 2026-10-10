import { DAILY_REMINDER_LATE_MINUTES, REMINDER_WINDOW_MINUTES } from "@/config";
import { de } from "@/i18n/de";
import { atLocalTime, hmToMinutes, localDayKey, localMinuteOfDay } from "@/lib/time";
import type { DailyReminder } from "@/lib/types";
import type { DueReminder } from "@/lib/push/reminders";

/**
 * Pure logic for family-wide daily reminders ("Vitamine um 08:00").
 * Shared by the cron route (push) and the in-app pop-up.
 */

export interface DailyContext {
  familyId: string;
  reminders: DailyReminder[];
  now: Date;
  tz: string;
}

/** One key per reminder and local day, so a reminder is pushed at most once a day. */
export function dailyDedupeKey(familyId: string, reminderId: string, now: Date, tz: string): string {
  return `${familyId}:daily:${reminderId}:${localDayKey(now, tz)}`;
}

/**
 * Push reminders due right now: the target time is within
 * [now − late, now + window]. The dedupe key (per local day) makes the
 * generous late window safe.
 */
export function dueDailyReminders(ctx: DailyContext): DueReminder[] {
  const { familyId, reminders, now, tz } = ctx;
  const out: DueReminder[] = [];
  for (const r of reminders) {
    if (!r.enabled || !r.push) continue;
    const at = atLocalTime(now, r.time, tz);
    const diffMin = (at.getTime() - now.getTime()) / 60_000;
    if (diffMin > REMINDER_WINDOW_MINUTES || diffMin < -DAILY_REMINDER_LATE_MINUTES) continue;
    out.push({
      kind: "daily",
      at,
      dedupeKey: dailyDedupeKey(familyId, r.id, at, tz),
      title: de.push.dailyTitle(r.name),
      body: de.push.dailyBody(r.name, r.time),
      url: "/heute",
    });
  }
  return out;
}

/**
 * In-app pop-up: every enabled reminder whose time has passed on the current
 * local day. The caller filters out the ones already acknowledged today.
 */
export function pendingInAppReminders(reminders: DailyReminder[], now: Date, tz: string): DailyReminder[] {
  const minute = localMinuteOfDay(now, tz);
  return reminders.filter((r) => r.enabled && r.inApp && hmToMinutes(r.time) <= minute);
}
