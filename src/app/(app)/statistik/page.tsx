import { BabySwitcher } from "@/components/heute/BabySwitcher";
import {
  BedtimeChart,
  FeedsChart,
  GrowthChart,
  SleepPerDayChart,
  WakeWindowChart,
  WakingsChart,
  type GrowthPoint,
} from "@/components/statistik/charts";
import { WeekPicker } from "@/components/statistik/WeekPicker";
import { de } from "@/i18n/de";
import { ageInWeeks } from "@/lib/age";
import { requireSession } from "@/lib/auth";
import { listEventsBetween } from "@/lib/db/events";
import { listMeasurements } from "@/lib/db/measurements";
import { FEVER_THRESHOLD_C, durationLabel, measurementUnit } from "@/lib/format";
import { resolveBabyContext } from "@/lib/selected-baby";
import { priorForWeeks } from "@/lib/sleep/priors";
import { addDaysToKey, weekStartKey, weekStats } from "@/lib/stats/aggregate";
import { weeklySummary } from "@/lib/stats/summary";
import { addLocalDays, dayKeyToDate, fmtDate, fmtDayShort, minutesToHm } from "@/lib/time";
import type { MeasurementKind } from "@/lib/types";

function Card({ title, children, aside }: { title: string; children: React.ReactNode; aside?: string }) {
  return (
    <section className="card p-4 animate-fade-up">
      <header className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="font-semibold">{title}</h2>
        {aside ? <span className="num text-sm text-muted">{aside}</span> : null}
      </header>
      {children}
    </section>
  );
}

export default async function StatistikPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const scope = await requireSession();
  const { babies, baby, tz } = await resolveBabyContext(scope);
  const params = await searchParams;
  const now = new Date();

  if (!baby) {
    return (
      <div className="flex flex-col gap-4 animate-fade-up">
        <h1 className="text-2xl font-bold">{de.stats.title}</h1>
        <div className="card p-6 text-center text-muted">
          <p className="font-medium text-text">{de.today.noBaby}</p>
          <p className="mt-1 text-sm">{de.today.noBabyHint}</p>
        </div>
      </div>
    );
  }

  const currentWeek = weekStartKey(now, tz);
  const requested = params.week && /^\d{4}-\d{2}-\d{2}$/.test(params.week) ? weekStartKey(dayKeyToDate(params.week, tz), tz) : currentWeek;
  const week = requested > currentWeek ? currentWeek : requested;
  const prevWeek = addDaysToKey(week, -7, tz);
  const nextWeek = week < currentWeek ? addDaysToKey(week, 7, tz) : null;
  const weekEndKey = addDaysToKey(week, 6, tz);

  // Fetch last week + this week (+1 day margin for night sleeps crossing the boundary)
  const from = addLocalDays(dayKeyToDate(prevWeek, tz), -1, tz);
  const to = addLocalDays(dayKeyToDate(weekEndKey, tz), 2, tz);
  const [events, measurements] = await Promise.all([
    listEventsBetween(scope, baby.id, from, to),
    listMeasurements(scope, baby.id, {}),
  ]);
  const thisWeek = weekStats(events, week, tz, baby.settings, now);
  const lastWeek = weekStats(events, prevWeek, tz, baby.settings, now);
  const summary = weeklySummary(baby.name, thisWeek, lastWeek.daysWithData > 0 ? lastWeek : null);

  const dayLabel = (i: number) => de.stats.daysShort[i]!;
  const hasData = thisWeek.daysWithData > 0;

  // --- chart data ------------------------------------------------------------
  const sleepData = thisWeek.days.map((d, i) => {
    // rolling 7-day average ending on this day (uses last week's days as history); no line into the future
    const isFuture = dayKeyToDate(d.dayKey, tz) > now;
    const history = isFuture ? [] : [...lastWeek.days, ...thisWeek.days].slice(i + 1, i + 8).filter((x) => x.hasData && x.sleepMinutes > 0);
    return {
      day: dayLabel(i),
      nap: d.hasData ? Math.round((d.napMinutes / 60) * 10) / 10 : 0,
      night: d.hasData ? Math.round((d.nightMinutes / 60) * 10) / 10 : 0,
      avg: history.length ? Math.round((history.reduce((s, x) => s + x.sleepMinutes, 0) / history.length / 60) * 10) / 10 : null,
    };
  });
  const bedtimeData = thisWeek.days.map((d, i) => ({
    day: dayLabel(i),
    offset: d.bedtimeMinute !== null ? Math.max(0, d.bedtimeMinute - 16 * 60) : null,
    minute: d.bedtimeMinute,
  }));
  const wakingsData = thisWeek.days.map((d, i) => ({ day: dayLabel(i), value: d.hasData ? d.nightWakings : null }));
  const weekMidDate = dayKeyToDate(addDaysToKey(week, 3, tz), tz);
  const prior = priorForWeeks(ageInWeeks(baby.birthDate, weekMidDate, tz));
  const wakeWindowData = thisWeek.days.map((d, i) => ({
    day: dayLabel(i),
    median: d.wakeWindowMedian !== null ? Math.round(d.wakeWindowMedian) : null,
    band: [prior.windowMin, prior.windowMax] as [number, number],
  }));
  const feedsData = thisWeek.days.map((d, i) => ({
    day: dayLabel(i),
    feeds: d.hasData ? d.feeds : null,
    ml: d.hasData && d.ml > 0 ? d.ml : null,
  }));

  const birth = dayKeyToDate(baby.birthDate, tz).getTime();
  const growth = (kind: MeasurementKind): GrowthPoint[] =>
    measurements
      .filter((m) => m.kind === kind)
      .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
      .map((m) => ({
        age: Math.round((new Date(m.measuredAt).getTime() - birth) / 86_400_000),
        value: m.value,
        label: fmtDate(m.measuredAt, tz),
      }));
  const growthSeries: { kind: MeasurementKind; title: string; color: string; reference?: number }[] = [
    { kind: "weight_g", title: de.stats.weight, color: "var(--sun)" },
    { kind: "height_cm", title: de.stats.height, color: "var(--mint)" },
    { kind: "head_cm", title: de.stats.head, color: "var(--lavender)" },
    { kind: "temp_c", title: de.stats.temperature, color: "var(--coral)", reference: FEVER_THRESHOLD_C },
  ];
  const anyGrowth = measurements.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3 animate-fade-up">
        <h1 className="text-2xl font-bold">{de.stats.title}</h1>
        <BabySwitcher babies={babies} selectedId={baby.id} />
        <WeekPicker
          weekStartKey={week}
          prevKey={prevWeek}
          nextKey={nextWeek}
          label={de.stats.week(fmtDayShort(dayKeyToDate(week, tz), tz), fmtDayShort(dayKeyToDate(weekEndKey, tz), tz))}
          isCurrent={week === currentWeek}
        />
      </header>

      <Card title={de.stats.summary}>
        <ul className="flex flex-col gap-2 px-1 text-sm leading-relaxed">
          {summary.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </Card>

      {!hasData ? (
        <div className="card p-6 text-center text-muted">{de.stats.noData}</div>
      ) : (
        <>
          <Card title={de.stats.sleepPerDay} aside={thisWeek.avgSleepMinutes !== null ? `Ø ${durationLabel(thisWeek.avgSleepMinutes)}` : undefined}>
            <SleepPerDayChart data={sleepData} />
            <p className="mt-1 px-1 text-xs text-muted">
              <span className="text-lavender">■</span> {de.stats.nightShare} <span className="ml-2 text-sun">■</span> {de.stats.napShare}{" "}
              <span className="ml-2 text-mint">┄</span> {de.stats.avg7}
            </p>
          </Card>
          <Card title={de.stats.bedtimePerDay} aside={thisWeek.avgBedtimeMinute !== null ? `Ø ${minutesToHm(thisWeek.avgBedtimeMinute)}` : undefined}>
            <BedtimeChart data={bedtimeData} />
          </Card>
          <div className="grid grid-cols-2 gap-4">
            <Card title={de.stats.nightWakings} aside={thisWeek.avgWakings !== null ? `Ø ${(Math.round(thisWeek.avgWakings * 10) / 10).toString().replace(".", ",")}` : undefined}>
              <WakingsChart data={wakingsData} />
            </Card>
            <Card title={de.stats.longestSleep}>
              {thisWeek.longest ? (
                <div className="flex h-[160px] flex-col items-center justify-center">
                  <p className="num text-4xl font-bold text-lavender">{durationLabel(thisWeek.longest.minutes)}</p>
                  <p className="mt-1 text-sm text-muted">
                    {de.time.weekdayLong[new Date(`${thisWeek.longest.dayKey}T00:00:00Z`).getUTCDay()]},{" "}
                    {fmtDayShort(dayKeyToDate(thisWeek.longest.dayKey, tz), tz)}
                  </p>
                </div>
              ) : (
                <p className="p-4 text-center text-sm text-muted">–</p>
              )}
            </Card>
          </div>
          <Card title={de.stats.wakeWindowTrend} aside={`${de.stats.ageBand} ${prior.windowMin}–${prior.windowMax} Min`}>
            <WakeWindowChart data={wakeWindowData} />
          </Card>
          <Card
            title={de.stats.feedsPerDay}
            aside={thisWeek.avgFeeds !== null ? `Ø ${(Math.round(thisWeek.avgFeeds * 10) / 10).toString().replace(".", ",")}${thisWeek.avgMl !== null ? ` · ${Math.round(thisWeek.avgMl)} ml` : ""}` : undefined}
          >
            <FeedsChart data={feedsData} />
          </Card>
        </>
      )}

      <h2 className="mt-2 px-1 text-lg font-semibold">{de.stats.growth}</h2>
      {!anyGrowth ? (
        <div className="card p-6 text-center text-muted">{de.stats.noGrowth}</div>
      ) : (
        growthSeries.map((g) => {
          const data = growth(g.kind);
          if (data.length === 0) return null;
          const last = data[data.length - 1]!;
          return (
            <Card key={g.kind} title={g.title} aside={`${last.value.toLocaleString("de-CH")} ${measurementUnit(g.kind)}`}>
              <GrowthChart data={data} unit={measurementUnit(g.kind)} color={g.color} reference={g.reference} />
            </Card>
          );
        })
      )}

      <a href="/api/export?type=events" className="btn btn-secondary w-full" download>
        {de.stats.export}
      </a>
    </div>
  );
}
