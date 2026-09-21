import { de } from "@/i18n/de";
import { durationLabel } from "@/lib/format";
import type { WeekStats } from "@/lib/stats/aggregate";
import { minutesToHm } from "@/lib/time";

/**
 * 3–5 German sentences comparing this week with last week.
 * Pure function over the aggregates – no LLM.
 */
export function weeklySummary(name: string, thisWeek: WeekStats, lastWeek: WeekStats | null): string[] {
  const out: string[] = [];
  if (thisWeek.avgSleepMinutes === null) return [de.summary.noData(name)];

  // 1. total sleep with comparison
  let sleep = de.summary.avgSleep(name, durationLabel(thisWeek.avgSleepMinutes));
  if (lastWeek?.avgSleepMinutes != null) {
    const diff = Math.round(thisWeek.avgSleepMinutes - lastWeek.avgSleepMinutes);
    if (Math.abs(diff) < 5) sleep += de.summary.sameAsLast;
    else if (diff > 0) sleep += de.summary.moreThanLast(durationLabel(diff));
    else sleep += de.summary.lessThanLast(durationLabel(-diff));
  } else {
    sleep += de.summary.noLastWeek;
  }
  out.push(sleep);

  // 2. bedtime
  if (thisWeek.avgBedtimeMinute !== null) {
    const hm = minutesToHm(thisWeek.avgBedtimeMinute);
    if (lastWeek?.avgBedtimeMinute != null) {
      const diff = Math.round(thisWeek.avgBedtimeMinute - lastWeek.avgBedtimeMinute);
      if (diff <= -5) out.push(de.summary.bedtimeEarlier(hm, -diff));
      else if (diff >= 5) out.push(de.summary.bedtimeLater(hm, diff));
      else out.push(de.summary.bedtimeAvg(hm));
    } else {
      out.push(de.summary.bedtimeAvg(hm));
    }
  }

  // 3. naps
  if (thisWeek.avgNaps !== null && thisWeek.avgNapLength !== null && thisWeek.avgNaps > 0) {
    out.push(de.summary.naps(fmt1(thisWeek.avgNaps), durationLabel(thisWeek.avgNapLength)));
  }

  // 4. wakings
  if (thisWeek.avgWakings !== null) {
    out.push(thisWeek.totalWakings === 0 ? de.summary.wakingsNone : de.summary.wakings(fmt1(thisWeek.avgWakings)));
  }

  // 5. longest sleep
  if (thisWeek.longest && out.length < 5) {
    out.push(de.summary.longest(durationLabel(thisWeek.longest.minutes), weekdayLong(thisWeek.longest.dayKey)));
  }

  // 6. feeds (only if there is still room)
  if (thisWeek.avgFeeds !== null && out.length < 5) {
    out.push(de.summary.feeds(fmt1(thisWeek.avgFeeds), thisWeek.avgMl !== null ? `${Math.round(thisWeek.avgMl)} ml` : null));
  }

  return out.slice(0, 5);
}

function fmt1(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace(".", ",");
}

function weekdayLong(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return de.time.weekdayLong[new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()]!;
}
