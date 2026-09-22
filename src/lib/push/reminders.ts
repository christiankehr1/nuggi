import { BREAST_CUE_GRACE_MINUTES, REMINDER_DEDUPE_ROUND_MINUTES, REMINDER_WINDOW_MINUTES } from "@/config";
import { de } from "@/i18n/de";
import { durationLabel, sideLabel } from "@/lib/format";
import type { Prediction } from "@/lib/sleep/predict";
import { addMinutes, fmtTime, isInLocalWindow, roundToMinutes } from "@/lib/time";
import type { BabyEvent, BabySettings, ReminderKind } from "@/lib/types";

/**
 * Pure reminder logic: which notifications are due right now for a baby.
 * The cron route feeds it a prediction and records what was sent.
 */

export interface DueReminder {
  kind: ReminderKind;
  /** the instant the reminder is about (rounded for dedupe) */
  at: Date;
  dedupeKey: string;
  title: string;
  body: string;
  url: string;
}

export interface ReminderContext {
  babyId: string;
  babyName: string;
  ageWeeks: number;
  settings: BabySettings;
  prediction: Prediction;
  now: Date;
  tz: string;
  /** the feed running right now, if any (breast feeds are timers) */
  runningFeed?: BabyEvent | null;
}

function inWindow(target: Date, now: Date, windowMinutes = REMINDER_WINDOW_MINUTES): boolean {
  const diff = target.getTime() - now.getTime();
  return Math.abs(diff) <= windowMinutes * 60_000;
}

export function dedupeKey(babyId: string, kind: ReminderKind, at: Date): string {
  const rounded = roundToMinutes(at, REMINDER_DEDUPE_ROUND_MINUTES);
  return `${babyId}:${kind}:${rounded.toISOString()}`;
}

export function dueReminders(ctx: ReminderContext): DueReminder[] {
  const { babyId, babyName, ageWeeks, settings, prediction, now, tz } = ctx;
  const out: DueReminder[] = [];

  // Nap: nextNapStart − lead, only while awake and while the next sleep is a nap
  if (settings.reminders.nap && prediction.state === "awake" && !prediction.nextIsBedtime) {
    const at = addMinutes(prediction.nextNapStart, -settings.napLeadMinutes);
    if (inWindow(at, now)) {
      out.push({
        kind: "nap",
        at,
        dedupeKey: dedupeKey(babyId, "nap", at),
        title: de.push.napTitle(babyName),
        body: de.push.napBody(settings.napLeadMinutes),
        url: "/heute",
      });
    }
  }

  // Feed: quiet hours at night unless the baby is under 12 weeks
  if (settings.reminders.feed && prediction.nextFeedAt && prediction.lastFeedStart) {
    const at = prediction.nextFeedAt;
    const quiet = ageWeeks >= 12 && isInLocalWindow(at, settings.nightStart, settings.nightEnd, tz);
    if (!quiet && inWindow(at, now)) {
      out.push({
        kind: "feed",
        at,
        dedupeKey: dedupeKey(babyId, "feed", at),
        title: de.push.feedTitle,
        body: de.push.feedBody(babyName, durationLabel(prediction.feedIntervalMinutes)),
        url: "/heute",
      });
    }
  }

  // Bedtime: napLead before the predicted bedtime, only while awake
  if (settings.reminders.bedtime && prediction.state === "awake") {
    const at = addMinutes(prediction.bedtime, -settings.napLeadMinutes);
    if (inWindow(at, now)) {
      out.push({
        kind: "bedtime",
        at,
        dedupeKey: dedupeKey(babyId, "bedtime", at),
        title: de.push.bedtimeTitle,
        body: de.push.bedtimeBody(babyName, fmtTime(prediction.bedtime, tz)),
        url: "/heute",
      });
    }
  }

  // Breast cue: once the running breast feed has lasted breastCueMinutes, exactly once per
  // feed (keyed by the event). No ±window: the first cron run after the threshold sends it,
  // so the scheduler's interval is the only lag. A feed still running an hour past the cue
  // is a forgotten timer and gets no cue.
  const feed = ctx.runningFeed;
  if (settings.reminders.breast && feed && feed.subtype === "breast" && feed.endedAt === null) {
    const start = new Date(feed.startedAt);
    const elapsed = (now.getTime() - start.getTime()) / 60_000;
    const cue = settings.breastCueMinutes;
    if (elapsed >= cue && elapsed < cue + BREAST_CUE_GRACE_MINUTES) {
      const side = feed.side === "L" || feed.side === "R" ? sideLabel(feed.side) : null;
      out.push({
        kind: "breast",
        at: addMinutes(start, cue),
        dedupeKey: `${babyId}:breast:${feed.id}`,
        title: de.push.breastTitle(cue),
        body: de.push.breastBody(babyName, cue, side),
        url: "/heute",
      });
    }
  }

  return out;
}
