/**
 * Deterministic, realistic demo data for a baby. Pure – used by the seed
 * script and by tests. All timestamps are UTC ISO strings; the daily rhythm
 * is built in the family's timezone.
 */
import { fromZonedTime } from "date-fns-tz";
import { addDays, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export interface DemoEvent {
  kind: "sleep" | "feed";
  subtype: "nap" | "night" | "breast" | "bottle" | "solids";
  startedAt: string;
  endedAt: string | null;
  amountMl: number | null;
  side: "L" | "R" | "both" | null;
  note: string | null;
}

export interface DemoMeasurement {
  kind: "weight_g" | "height_cm" | "head_cm" | "temp_c";
  value: number;
  measuredAt: string;
  note: string | null;
}

/** Small seeded PRNG (mulberry32) so seeds are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function local(dayKey: string, minuteOfDay: number, tz: string): Date {
  const h = Math.floor(minuteOfDay / 60);
  const m = Math.round(minuteOfDay % 60);
  return fromZonedTime(
    `${dayKey}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`,
    tz,
  );
}

export interface DemoOptions {
  /** Local day keys are derived from this instant backwards. */
  now: Date;
  days: number;
  tz: string;
  seed?: number;
  /** Age-dependent rhythm; 4-month default */
  wakeWindowMin?: number;
  napLengthMin?: number;
  napsPerDay?: number;
  bottleMl?: number;
}

export function generateDemoEvents(opts: DemoOptions): DemoEvent[] {
  const {
    now,
    days,
    tz,
    seed = 42,
    wakeWindowMin = 100,
    napLengthMin = 45,
    napsPerDay = 3,
    bottleMl = 120,
  } = opts;
  const rand = rng(seed);
  const jitter = (range: number) => Math.round((rand() * 2 - 1) * range);
  const events: DemoEvent[] = [];

  const todayZoned = toZonedTime(now, tz);
  const nowMinute = todayZoned.getHours() * 60 + todayZoned.getMinutes();

  for (let d = days - 1; d >= 0; d--) {
    const dayKey = format(addDays(todayZoned, -d), "yyyy-MM-dd");
    const isToday = d === 0;
    const cutoff = isToday ? nowMinute : 24 * 60 + 60; // allow night sleep to run past midnight

    // Night sleep ending this morning (started the evening before)
    const wakeMinute = 6 * 60 + 45 + jitter(25);
    const prevDayKey = format(addDays(todayZoned, -d - 1), "yyyy-MM-dd");
    const bedMinutePrev = 19 * 60 + 10 + jitter(30);
    // Night wakings: split the night into 1–3 segments
    const wakings = rand() < 0.3 ? 0 : rand() < 0.6 ? 1 : 2;
    let segStart = local(prevDayKey, bedMinutePrev, tz);
    const nightEnd = local(dayKey, wakeMinute, tz);
    const totalNight = (nightEnd.getTime() - segStart.getTime()) / 60000;
    const cuts: number[] = [];
    for (let w = 0; w < wakings; w++) cuts.push(120 + rand() * (totalNight - 240));
    cuts.sort((a, b) => a - b);
    for (const cut of cuts) {
      const end = new Date(local(prevDayKey, bedMinutePrev, tz).getTime() + cut * 60000);
      events.push({
        kind: "sleep",
        subtype: "night",
        startedAt: segStart.toISOString(),
        endedAt: end.toISOString(),
        amountMl: null,
        side: null,
        note: null,
      });
      // night feed during the waking
      events.push({
        kind: "feed",
        subtype: "breast",
        startedAt: new Date(end.getTime() + 3 * 60000).toISOString(),
        endedAt: new Date(end.getTime() + 18 * 60000).toISOString(),
        amountMl: null,
        side: rand() < 0.5 ? "L" : "R",
        note: null,
      });
      segStart = new Date(end.getTime() + (12 + rand() * 15) * 60000);
    }
    if (d === days - 1) {
      // For the oldest day, skip the previous night (outside the window)
    } else {
      events.push({
        kind: "sleep",
        subtype: "night",
        startedAt: segStart.toISOString(),
        endedAt: nightEnd.toISOString(),
        amountMl: null,
        side: null,
        note: null,
      });
    }

    // Morning feed
    let t = wakeMinute + 10 + jitter(5);
    const pushFeed = (minute: number) => {
      if (minute > cutoff) return;
      const bottle = rand() < 0.45;
      events.push({
        kind: "feed",
        subtype: bottle ? "bottle" : "breast",
        startedAt: local(dayKey, minute, tz).toISOString(),
        endedAt: local(dayKey, minute + 15 + jitter(5), tz).toISOString(),
        amountMl: bottle ? bottleMl + jitter(30) : null,
        side: bottle ? null : (["L", "R", "both"] as const)[Math.floor(rand() * 3)]!,
        note: null,
      });
    };
    pushFeed(t);

    // Naps through the day
    let lastWake = wakeMinute;
    for (let n = 0; n < napsPerDay; n++) {
      const factor = n === 0 ? 0.9 : n === napsPerDay - 1 ? 1.1 : 1.0;
      const napStart = lastWake + Math.round(wakeWindowMin * factor) + jitter(15);
      const napLen = napLengthMin + jitter(15) + (n === 1 ? 20 : 0);
      if (napStart > cutoff) break;
      const napEnd = Math.min(napStart + napLen, isToday ? cutoff : napStart + napLen);
      const running = isToday && napStart + napLen > cutoff && napStart < cutoff;
      events.push({
        kind: "sleep",
        subtype: "nap",
        startedAt: local(dayKey, napStart, tz).toISOString(),
        endedAt: running ? null : local(dayKey, napEnd, tz).toISOString(),
        amountMl: null,
        side: null,
        note: null,
      });
      if (running) break;
      lastWake = napEnd;
      t = napEnd + 5 + jitter(5);
      pushFeed(t);
    }
    // Late afternoon / evening feed before bed
    pushFeed(18 * 60 + 30 + jitter(10));

    // Today's night sleep may already be running if it's late
    if (isToday && nowMinute > 19 * 60 + 15) {
      const running = events.some((e) => e.endedAt === null);
      if (!running) {
        events.push({
          kind: "sleep",
          subtype: "night",
          startedAt: local(dayKey, 19 * 60 + 5 + jitter(10), tz).toISOString(),
          endedAt: null,
          amountMl: null,
          side: null,
          note: null,
        });
      }
    }
  }

  // Ensure only one running sleep + one running feed
  let sawSleep = false;
  for (const e of events) {
    if (e.endedAt === null && e.kind === "sleep") {
      if (sawSleep) e.endedAt = e.startedAt;
      sawSleep = true;
    }
  }
  events.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  return events;
}

export function generateDemoMeasurements(opts: {
  now: Date;
  birthDate: string;
  tz: string;
  seed?: number;
}): DemoMeasurement[] {
  const rand = rng(opts.seed ?? 7);
  const out: DemoMeasurement[] = [];
  const birth = fromZonedTime(`${opts.birthDate}T10:00:00`, opts.tz);
  const ageDays = Math.floor((opts.now.getTime() - birth.getTime()) / 86_400_000);
  // weekly weight since birth, roughly 3.4 kg → +180 g/week early, slowing down
  for (let day = 0; day <= ageDays; day += 7) {
    const weeks = day / 7;
    const weight = 3400 + weeks * 180 * Math.pow(0.97, weeks) + Math.round(rand() * 80 - 40);
    out.push({
      kind: "weight_g",
      value: Math.round(weight),
      measuredAt: new Date(birth.getTime() + day * 86_400_000).toISOString(),
      note: null,
    });
    if (day % 28 === 0) {
      out.push({
        kind: "height_cm",
        value: Math.round((50 + weeks * 0.85 + rand() * 0.6) * 10) / 10,
        measuredAt: new Date(birth.getTime() + day * 86_400_000 + 3600_000).toISOString(),
        note: null,
      });
      out.push({
        kind: "head_cm",
        value: Math.round((34.5 + weeks * 0.45 + rand() * 0.3) * 10) / 10,
        measuredAt: new Date(birth.getTime() + day * 86_400_000 + 7200_000).toISOString(),
        note: null,
      });
    }
  }
  // two temperatures in the last week, one feverish
  out.push({
    kind: "temp_c",
    value: 36.8,
    measuredAt: new Date(opts.now.getTime() - 5 * 86_400_000).toISOString(),
    note: null,
  });
  out.push({
    kind: "temp_c",
    value: 38.3,
    measuredAt: new Date(opts.now.getTime() - 2 * 86_400_000).toISOString(),
    note: "Nach der Impfung",
  });
  return out;
}
