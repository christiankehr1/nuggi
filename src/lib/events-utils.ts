import type { BabyEvent, Measurement } from "@/lib/types";
import { addLocalDays, dayKeyToDate, localDayKey, toDate } from "@/lib/time";

/**
 * Pure helpers over events: split sleeps at local midnight, group by day,
 * compute day totals. A "day" runs midnight–midnight in the family's timezone.
 */

export interface DayTotals {
  sleepMinutes: number;
  napMinutes: number;
  nightMinutes: number;
  feeds: number;
  ml: number;
}

export interface DayGroup {
  dayKey: string;
  totals: DayTotals;
  events: BabyEvent[];
  measurements: Measurement[];
}

/**
 * Minutes of `event` that fall inside [from, to). Running events are treated
 * as ending at `now`.
 */
export function overlapMinutes(
  event: Pick<BabyEvent, "startedAt" | "endedAt">,
  from: Date,
  to: Date,
  now: Date,
): number {
  const s = toDate(event.startedAt).getTime();
  const e = (event.endedAt ? toDate(event.endedAt) : now).getTime();
  const start = Math.max(s, from.getTime());
  const end = Math.min(e, to.getTime());
  return end > start ? (end - start) / 60_000 : 0;
}

/** Sleep minutes on the local day that starts at `dayStart`. */
export function sleepMinutesOnDay(
  events: BabyEvent[],
  dayStart: Date,
  tz: string,
  now: Date,
  subtype?: "nap" | "night",
): number {
  const dayEnd = addLocalDays(dayStart, 1, tz);
  let total = 0;
  for (const e of events) {
    if (e.kind !== "sleep") continue;
    if (subtype && e.subtype !== subtype) continue;
    total += overlapMinutes(e, dayStart, dayEnd, now);
  }
  return total;
}

export function dayTotals(events: BabyEvent[], dayKey: string, tz: string, now: Date): DayTotals {
  const start = dayKeyToDate(dayKey, tz);
  const end = addLocalDays(start, 1, tz);
  const totals: DayTotals = { sleepMinutes: 0, napMinutes: 0, nightMinutes: 0, feeds: 0, ml: 0 };
  for (const e of events) {
    if (e.kind === "sleep") {
      const mins = overlapMinutes(e, start, end, now);
      totals.sleepMinutes += mins;
      if (e.subtype === "night") totals.nightMinutes += mins;
      else totals.napMinutes += mins;
    } else if (localDayKey(e.startedAt, tz) === dayKey) {
      totals.feeds += 1;
      if (e.amountMl) totals.ml += e.amountMl;
    }
  }
  totals.sleepMinutes = Math.round(totals.sleepMinutes);
  totals.napMinutes = Math.round(totals.napMinutes);
  totals.nightMinutes = Math.round(totals.nightMinutes);
  return totals;
}

/**
 * Group events and measurements by the local day of their start, newest day
 * first, events newest first within a day. Totals count sleep overlap with the
 * day (so a night sleep contributes to both days it touches).
 */
export function groupByDay(
  events: BabyEvent[],
  measurements: Measurement[],
  tz: string,
  now: Date,
): DayGroup[] {
  const map = new Map<string, DayGroup>();
  const ensure = (dayKey: string) => {
    let g = map.get(dayKey);
    if (!g) {
      g = {
        dayKey,
        totals: { sleepMinutes: 0, napMinutes: 0, nightMinutes: 0, feeds: 0, ml: 0 },
        events: [],
        measurements: [],
      };
      map.set(dayKey, g);
    }
    return g;
  };
  for (const e of events) ensure(localDayKey(e.startedAt, tz)).events.push(e);
  for (const m of measurements) ensure(localDayKey(m.measuredAt, tz)).measurements.push(m);
  const groups = [...map.values()].sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1));
  for (const g of groups) {
    g.events.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
    g.measurements.sort((a, b) => (a.measuredAt < b.measuredAt ? 1 : -1));
    g.totals = dayTotals(events, g.dayKey, tz, now);
  }
  return groups;
}

export function runningOf(events: BabyEvent[], kind: BabyEvent["kind"]): BabyEvent | null {
  return events.find((e) => e.kind === kind && e.endedAt === null) ?? null;
}

export function lastEnded(events: BabyEvent[], kind: BabyEvent["kind"]): BabyEvent | null {
  let best: BabyEvent | null = null;
  for (const e of events) {
    if (e.kind !== kind || !e.endedAt) continue;
    if (!best || e.endedAt > best.endedAt!) best = e;
  }
  return best;
}

export function lastStarted(events: BabyEvent[], kind: BabyEvent["kind"]): BabyEvent | null {
  let best: BabyEvent | null = null;
  for (const e of events) {
    if (e.kind !== kind) continue;
    if (!best || e.startedAt > best.startedAt) best = e;
  }
  return best;
}
