import { overlapMinutes } from "@/lib/events-utils";
import { trimmedMedian } from "@/lib/sleep/predict";
import {
  addLocalDays,
  dayKeyToDate,
  hmToMinutes,
  isInLocalWindow,
  localDayKey,
  localMinuteOfDay,
  minutesBetween,
  toDate,
} from "@/lib/time";
import type { BabyEvent, BabySettings } from "@/lib/types";

/**
 * Pure weekly statistics.
 *
 * Definitions
 * - A day runs midnight–midnight in the family's timezone.
 * - Sleep per day = minutes of sleep overlapping that day (a night sleep counts
 *   for both days it touches).
 * - Bedtime of day D = local start time of the first night sleep that starts on
 *   D at or after 16:00.
 * - Night wakings of day D = gaps ≥ 5 min between consecutive night sleeps
 *   whose gap starts inside the night window that begins on D.
 * - Wake window = gap between a sleep's end and the next sleep's start, daytime
 *   only (the gap starts outside the night window); assigned to the day the gap starts.
 */

export interface DayStats {
  dayKey: string;
  sleepMinutes: number;
  napMinutes: number;
  nightMinutes: number;
  napCount: number;
  /** local minute of day, e.g. 19:24 → 1164 */
  bedtimeMinute: number | null;
  nightWakings: number;
  longestSleepMinutes: number;
  wakeWindowMedian: number | null;
  wakeWindows: number[];
  feeds: number;
  ml: number;
  hasData: boolean;
}

export interface WeekStats {
  weekStartKey: string;
  days: DayStats[];
  daysWithData: number;
  avgSleepMinutes: number | null;
  avgNapMinutes: number | null;
  avgNightMinutes: number | null;
  avgNaps: number | null;
  avgNapLength: number | null;
  avgBedtimeMinute: number | null;
  totalWakings: number;
  avgWakings: number | null;
  longest: { minutes: number; dayKey: string } | null;
  wakeWindowMedian: number | null;
  avgFeeds: number | null;
  avgMl: number | null;
}

const BEDTIME_EARLIEST_MIN = 16 * 60;

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Monday of the local week containing `value` as a day key. */
export function weekStartKey(value: Date, tz: string): string {
  const key = localDayKey(value, tz);
  const d = dayKeyToDate(key, tz);
  // weekday via the UTC date of the key (safe: the key is a plain calendar date)
  const [y, m, dd] = key.split("-").map(Number);
  const iso = new Date(Date.UTC(y!, m! - 1, dd!)).getUTCDay(); // 0 = Sunday
  const back = (iso + 6) % 7; // days since Monday
  return localDayKey(addLocalDays(d, -back, tz), tz);
}

export function addDaysToKey(key: string, n: number, tz: string): string {
  return localDayKey(addLocalDays(dayKeyToDate(key, tz), n, tz), tz);
}

export function dayStats(
  events: BabyEvent[],
  dayKey: string,
  tz: string,
  settings: BabySettings,
  now: Date,
): DayStats {
  const start = dayKeyToDate(dayKey, tz);
  const end = addLocalDays(start, 1, tz);
  const sleeps = events
    .filter((e) => e.kind === "sleep")
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  let sleepMinutes = 0;
  let napMinutes = 0;
  let nightMinutes = 0;
  let napCount = 0;
  let bedtimeMinute: number | null = null;
  let longestSleepMinutes = 0;
  let hasData = false;

  for (const e of sleeps) {
    const mins = overlapMinutes(e, start, end, now);
    if (mins > 0) hasData = true;
    sleepMinutes += mins;
    if (e.subtype === "night") nightMinutes += mins;
    else napMinutes += mins;

    const startsToday = localDayKey(e.startedAt, tz) === dayKey;
    if (startsToday) {
      if (e.subtype === "nap") napCount += 1;
      const total = minutesBetween(e.startedAt, e.endedAt ?? now);
      if (total > longestSleepMinutes) longestSleepMinutes = total;
      if (e.subtype === "night" && bedtimeMinute === null) {
        const m = localMinuteOfDay(e.startedAt, tz);
        if (m >= BEDTIME_EARLIEST_MIN) bedtimeMinute = m;
      }
    }
  }

  // night wakings for the night starting on this day
  const nightStart = new Date(start.getTime() + hmToMinutes(settings.nightStart) * 60_000);
  const nightEndMin = hmToMinutes(settings.nightEnd);
  const nightEnd =
    nightEndMin <= hmToMinutes(settings.nightStart)
      ? new Date(end.getTime() + nightEndMin * 60_000)
      : new Date(start.getTime() + nightEndMin * 60_000);
  let nightWakings = 0;
  const nights = sleeps.filter((e) => e.subtype === "night" && e.endedAt);
  for (let i = 0; i < nights.length - 1; i++) {
    const a = nights[i]!;
    const b = nights[i + 1]!;
    const gapStart = toDate(a.endedAt!);
    if (gapStart < nightStart || gapStart >= nightEnd) continue;
    if (minutesBetween(a.endedAt!, b.startedAt) >= 5) nightWakings += 1;
  }

  // daytime wake windows starting on this day
  const wakeWindows: number[] = [];
  const endedSleeps = sleeps.filter((e) => e.endedAt);
  for (let i = 0; i < endedSleeps.length; i++) {
    const a = endedSleeps[i]!;
    if (localDayKey(a.endedAt!, tz) !== dayKey) continue;
    const b = sleeps.find((s) => s.startedAt >= a.endedAt! && s.id !== a.id);
    if (!b) continue;
    // night → night inside the night window is a night waking, not a wake window
    if (a.subtype === "night" && b.subtype === "night" && isInLocalWindow(a.endedAt!, settings.nightStart, settings.nightEnd, tz)) continue;
    const gap = minutesBetween(a.endedAt!, b.startedAt);
    if (gap >= 10 && gap <= 8 * 60) wakeWindows.push(gap);
  }

  let feeds = 0;
  let ml = 0;
  for (const e of events) {
    if (e.kind !== "feed" || localDayKey(e.startedAt, tz) !== dayKey) continue;
    feeds += 1;
    hasData = true;
    if (e.amountMl) ml += e.amountMl;
  }

  return {
    dayKey,
    sleepMinutes: Math.round(sleepMinutes),
    napMinutes: Math.round(napMinutes),
    nightMinutes: Math.round(nightMinutes),
    napCount,
    bedtimeMinute,
    nightWakings,
    longestSleepMinutes: Math.round(longestSleepMinutes),
    wakeWindowMedian: trimmedMedian(wakeWindows),
    wakeWindows,
    feeds,
    ml,
    hasData,
  };
}

export function weekStats(
  events: BabyEvent[],
  weekStart: string,
  tz: string,
  settings: BabySettings,
  now: Date,
): WeekStats {
  const days: DayStats[] = [];
  for (let i = 0; i < 7; i++) {
    const key = addDaysToKey(weekStart, i, tz);
    // don't compute days in the future
    if (dayKeyToDate(key, tz) > now) {
      days.push({ ...dayStats([], key, tz, settings, now), hasData: false });
      continue;
    }
    days.push(dayStats(events, key, tz, settings, now));
  }
  const withData = days.filter((d) => d.hasData);
  const sleepDays = withData.filter((d) => d.sleepMinutes > 0);
  const napLengths: number[] = [];
  for (const e of events) {
    if (e.kind !== "sleep" || e.subtype !== "nap" || !e.endedAt) continue;
    const key = localDayKey(e.startedAt, tz);
    if (key < weekStart || key > addDaysToKey(weekStart, 6, tz)) continue;
    napLengths.push(minutesBetween(e.startedAt, e.endedAt));
  }
  const longestDay = sleepDays.reduce<DayStats | null>(
    (best, d) => (!best || d.longestSleepMinutes > best.longestSleepMinutes ? d : best),
    null,
  );
  const allWindows = withData.flatMap((d) => d.wakeWindows);
  const bedtimes = withData.map((d) => d.bedtimeMinute).filter((b): b is number => b !== null);
  const feedDays = withData.filter((d) => d.feeds > 0);

  return {
    weekStartKey: weekStart,
    days,
    daysWithData: withData.length,
    avgSleepMinutes: avg(sleepDays.map((d) => d.sleepMinutes)),
    avgNapMinutes: avg(sleepDays.map((d) => d.napMinutes)),
    avgNightMinutes: avg(sleepDays.map((d) => d.nightMinutes)),
    avgNaps: avg(sleepDays.map((d) => d.napCount)),
    avgNapLength: avg(napLengths),
    avgBedtimeMinute: avg(bedtimes),
    totalWakings: withData.reduce((s, d) => s + d.nightWakings, 0),
    avgWakings: sleepDays.length ? withData.reduce((s, d) => s + d.nightWakings, 0) / sleepDays.length : null,
    longest: longestDay && longestDay.longestSleepMinutes > 0 ? { minutes: longestDay.longestSleepMinutes, dayKey: longestDay.dayKey } : null,
    wakeWindowMedian: trimmedMedian(allWindows),
    avgFeeds: avg(feedDays.map((d) => d.feeds)),
    avgMl: avg(feedDays.filter((d) => d.ml > 0).map((d) => d.ml)),
  };
}
