import { de } from "@/i18n/de";
import { ageInWeeks, ageLabel } from "@/lib/age";
import { sleepMinutesOnDay } from "@/lib/events-utils";
import {
  WINDOW_FACTOR_FIRST,
  WINDOW_FACTOR_LAST,
  WINDOW_FACTOR_MID,
  defaultFeedInterval,
  expectedDaytimeSleep,
  priorForWeeks,
  windowMidpoint,
  type AgePrior,
} from "@/lib/sleep/priors";
import {
  addLocalDays,
  addMinutes,
  atLocalTime,
  clampDate,
  fmtTime,
  isInLocalWindow,
  localDayKey,
  minutesBetween,
  startOfLocalDay,
  toDate,
} from "@/lib/time";
import type { BabyEvent, BabySettings } from "@/lib/types";

/**
 * Pure sleep prediction. No I/O, no Date.now(): everything derives from `now`.
 */

export type Confidence = "niedrig" | "mittel" | "hoch";

export interface PredictionInput {
  baby: { name: string; birthDate: string; settings: BabySettings };
  /** events of the last 14 days (any order) */
  events: BabyEvent[];
  now: Date;
  tz: string;
}

export interface Prediction {
  state: "awake" | "asleep";
  nextNapStart: Date;
  nextNapWindow: [Date, Date];
  /** set when asleep */
  predictedWakeTime?: Date;
  /** true when the next sleep is the night, not a nap */
  nextIsBedtime: boolean;
  bedtime: Date;
  confidence: Confidence;
  reasoning: string[];
  // extras for the UI and reminders
  ageWeeks: number;
  prior: AgePrior;
  wakeWindowMinutes: number;
  napLengthMinutes: number;
  observedWindows: number;
  lastSleepEnd: Date | null;
  currentSleep: BabyEvent | null;
  todayWakeUp: Date | null;
  nextFeedAt: Date | null;
  feedIntervalMinutes: number;
  lastFeedStart: Date | null;
}

export interface Observed {
  wakeWindows: number[];
  napLengths: number[];
}

// ---------------------------------------------------------------------------
// Statistics helpers
// ---------------------------------------------------------------------------

/** Drop the top and bottom 10 % (rounded down) and return the median. */
export function trimmedMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const trim = Math.floor(sorted.length * 0.1);
  const kept = sorted.slice(trim, sorted.length - trim);
  const mid = Math.floor(kept.length / 2);
  return kept.length % 2 === 1 ? kept[mid]! : (kept[mid - 1]! + kept[mid]!) / 2;
}

export function blendWeight(n: number): number {
  return Math.min(0.7, Math.max(0, (n - 2) / 8));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function confidenceFor(n: number): Confidence {
  if (n < 3) return "niedrig";
  if (n < 10) return "mittel";
  return "hoch";
}

// ---------------------------------------------------------------------------
// Observation: daytime wake windows and nap lengths of the last 7 days
// ---------------------------------------------------------------------------

export function observe(
  events: BabyEvent[],
  settings: BabySettings,
  now: Date,
  tz: string,
  days = 7,
): Observed {
  const since = addLocalDays(startOfLocalDay(now, tz), -days, tz);
  const sleeps = events
    .filter((e) => e.kind === "sleep" && e.endedAt && toDate(e.startedAt) >= since)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  const wakeWindows: number[] = [];
  const napLengths: number[] = [];
  for (let i = 0; i < sleeps.length; i++) {
    const s = sleeps[i]!;
    const len = minutesBetween(s.startedAt, s.endedAt!);
    if (s.subtype === "nap" && len >= 5 && len <= 240) napLengths.push(len);

    const next = sleeps[i + 1];
    if (!next) continue;
    const gap = minutesBetween(s.endedAt!, next.startedAt);
    // daytime only: the wake period must start outside the night window
    const daytime = !isInLocalWindow(s.endedAt!, settings.nightStart, settings.nightEnd, tz);
    if (daytime && gap >= 10 && gap <= 8 * 60) wakeWindows.push(gap);
  }
  return { wakeWindows, napLengths };
}

// ---------------------------------------------------------------------------
// Prediction
// ---------------------------------------------------------------------------

export function predict(input: PredictionInput): Prediction {
  const { baby, events, now, tz } = input;
  const { settings } = baby;
  const reasoning: string[] = [];

  const ageWeeks = ageInWeeks(baby.birthDate, now, tz);
  const prior = priorForWeeks(ageWeeks);
  const age = ageLabel(baby.birthDate, now, tz);
  reasoning.push(de.prediction.prior(age, prior.windowMin, prior.windowMax));

  // --- today's context -----------------------------------------------------
  const todayStart = startOfLocalDay(now, tz);
  const todayKey = localDayKey(now, tz);
  const sleeps = events.filter((e) => e.kind === "sleep").sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const currentSleep = sleeps.find((e) => e.endedAt === null && toDate(e.startedAt) <= now) ?? null;
  const ended = sleeps.filter((e) => e.endedAt !== null && toDate(e.endedAt!) <= now);
  const lastEndedSleep = ended.length ? ended[ended.length - 1]! : null;
  const lastSleepEnd = lastEndedSleep ? toDate(lastEndedSleep.endedAt!) : null;

  const nightEndToday = atLocalTime(now, settings.nightEnd, tz);
  const todayWakeUp = (() => {
    // first sleep end today after the night ended (or the end of a night sleep today)
    const candidates = ended
      .filter((e) => localDayKey(e.endedAt!, tz) === todayKey)
      .map((e) => toDate(e.endedAt!));
    if (candidates.length === 0) return null;
    const night = ended.find((e) => e.subtype === "night" && localDayKey(e.endedAt!, tz) === todayKey);
    return night ? toDate(night.endedAt!) : candidates[0]!;
  })();

  const napsToday = ended.filter((e) => e.subtype === "nap" && localDayKey(e.startedAt, tz) === todayKey).length;
  const expectedNaps = (prior.napsMin + prior.napsMax) / 2;

  // --- observed ------------------------------------------------------------
  const observed = observe(events, settings, now, tz);
  const n = observed.wakeWindows.length;
  const obsWindow = trimmedMedian(observed.wakeWindows);
  const obsNap = trimmedMedian(observed.napLengths);
  if (obsWindow !== null && n > 0) reasoning.push(de.prediction.observed(baby.name, Math.round(obsWindow), n));
  else reasoning.push(de.prediction.noObserved(baby.name));

  // --- wake window for the upcoming gap ------------------------------------
  const positionFactor = (napsDone: number): number => {
    if (napsDone === 0) return WINDOW_FACTOR_FIRST;
    if (napsDone >= Math.max(1, Math.round(expectedNaps) - 1)) return WINDOW_FACTOR_LAST;
    return WINDOW_FACTOR_MID;
  };

  const windowFor = (napsDone: number): number => {
    const factor = positionFactor(napsDone);
    const priorWindow = windowMidpoint(prior) * factor;
    const w = blendWeight(n);
    const blended = obsWindow === null ? priorWindow : (1 - w) * priorWindow + w * obsWindow;
    return Math.round(clamp(blended, 0.8 * prior.windowMin, 1.2 * prior.windowMax));
  };

  const napsDoneForNext = currentSleep && currentSleep.subtype === "nap" ? napsToday + 1 : napsToday;
  const factorUsed = positionFactor(napsDoneForNext);
  const wakeWindowMinutes = windowFor(napsDoneForNext);
  const w = blendWeight(n);
  if (obsWindow !== null && n > 0) reasoning.push(de.prediction.blend(Math.round(w * 100), wakeWindowMinutes));
  if (factorUsed === WINDOW_FACTOR_FIRST) reasoning.push(de.prediction.factorFirst);
  if (factorUsed === WINDOW_FACTOR_LAST) reasoning.push(de.prediction.factorLast);

  // --- nap length ----------------------------------------------------------
  const nNaps = observed.napLengths.length;
  const wNap = blendWeight(nNaps);
  const napBlend = obsNap === null ? prior.napLength : (1 - wNap) * prior.napLength + wNap * obsNap;
  const napLengthMinutes = Math.round(clamp(napBlend, 0.6 * prior.napLength, 1.6 * prior.napLength));
  reasoning.push(de.prediction.napLength(prior.napLength, napLengthMinutes, nNaps));

  // --- bedtime -------------------------------------------------------------
  const bedtimeTarget = atLocalTime(now, settings.bedtimeTarget, tz);
  const daytimeSleepToday = sleepMinutesOnDay(events, todayStart, tz, now, "nap");
  const expectedDay = expectedDaytimeSleep(prior);

  // --- state ---------------------------------------------------------------
  let state: Prediction["state"] = "awake";
  let predictedWakeTime: Date | undefined;
  let anchor: Date;
  let anchorReason: "lastSleep" | "assumed" | "asleep" = "lastSleep";

  if (currentSleep) {
    state = "asleep";
    const start = toDate(currentSleep.startedAt);
    if (currentSleep.subtype === "night") {
      const nextNightEnd = now < nightEndToday ? nightEndToday : atLocalTime(addLocalDays(now, 1, tz), settings.nightEnd, tz);
      predictedWakeTime = nextNightEnd;
      reasoning.push(de.prediction.asleepNight(fmtTime(start, tz), fmtTime(predictedWakeTime, tz)));
    } else {
      predictedWakeTime = addMinutes(start, napLengthMinutes);
      if (predictedWakeTime < now) predictedWakeTime = addMinutes(now, 5);
      reasoning.push(de.prediction.asleepNap(fmtTime(start, tz), fmtTime(predictedWakeTime, tz)));
    }
    anchor = predictedWakeTime;
    anchorReason = "asleep";
  } else if (lastSleepEnd && minutesBetween(lastSleepEnd, now) <= 16 * 60) {
    anchor = lastSleepEnd;
  } else {
    // no usable sleep data: assume the baby woke at nightEnd (or just now, early in the day)
    anchor = now > nightEndToday ? nightEndToday : now;
    anchorReason = "assumed";
  }

  let nextNapStart = addMinutes(anchor, wakeWindowMinutes);
  let nextIsBedtime = false;

  // bedtime = later of (lastNapEnd + last window) and (target − 45), clamped, adjusted
  const lastWindow = windowFor(Math.max(1, Math.round(expectedNaps) - 1));
  const lastNapEndForBedtime = anchorReason === "asleep" ? anchor : (lastSleepEnd ?? todayWakeUp ?? anchor);
  let bedtime = new Date(Math.max(addMinutes(lastNapEndForBedtime, lastWindow).getTime(), addMinutes(bedtimeTarget, -45).getTime()));
  bedtime = clampDate(bedtime, addMinutes(bedtimeTarget, -60), addMinutes(bedtimeTarget, 45));
  if (daytimeSleepToday > expectedDay + 30) {
    bedtime = addMinutes(bedtime, 15);
    reasoning.push(de.prediction.bedtimeLater(Math.round(daytimeSleepToday - expectedDay)));
  } else if (
    daytimeSleepToday < expectedDay - 45 &&
    napsToday > 0 &&
    // only once the afternoon is well under way – earlier the day simply isn't over yet
    now >= addMinutes(bedtimeTarget, -180)
  ) {
    bedtime = addMinutes(bedtime, -15);
    reasoning.push(de.prediction.bedtimeEarlier(Math.round(expectedDay - daytimeSleepToday)));
  }
  // If the evening is over (baby asleep for the night or well past bedtime) show tomorrow's bedtime.
  if ((currentSleep && currentSleep.subtype === "night") || now > addMinutes(bedtime, 90)) {
    const tomorrow = addLocalDays(now, 1, tz);
    bedtime = atLocalTime(tomorrow, settings.bedtimeTarget, tz);
  }

  // A nap that would start too close to bedtime is not a nap: the next sleep is the night.
  if (state === "awake" && nextNapStart > addMinutes(bedtime, -Math.round(napLengthMinutes / 2))) {
    nextIsBedtime = true;
    nextNapStart = bedtime;
    reasoning.push(de.prediction.noMoreNaps);
  } else if (anchorReason === "assumed") {
    reasoning.push(de.prediction.anchorAssumedWake(fmtTime(anchor, tz), fmtTime(nextNapStart, tz)));
  } else if (anchorReason === "lastSleep") {
    reasoning.push(de.prediction.anchorLastSleep(fmtTime(anchor, tz), fmtTime(nextNapStart, tz)));
  }

  const nextNapWindow: [Date, Date] = [addMinutes(nextNapStart, -15), addMinutes(nextNapStart, 15)];
  reasoning.push(de.prediction.bedtime(fmtTime(bedtime, tz), settings.bedtimeTarget));

  const confidence = confidenceFor(n);
  const confLabel =
    confidence === "hoch" ? de.today.confidenceHigh : confidence === "mittel" ? de.today.confidenceMid : de.today.confidenceLow;
  reasoning.push(de.prediction.confidence(confLabel, n));

  // --- feeds ---------------------------------------------------------------
  const feedIntervalMinutes = settings.feedIntervalMinutes ?? defaultFeedInterval(ageWeeks);
  const feeds = events.filter((e) => e.kind === "feed" && toDate(e.startedAt) <= now);
  const lastFeed = feeds.length ? feeds.reduce((a, b) => (a.startedAt > b.startedAt ? a : b)) : null;
  const lastFeedStart = lastFeed ? toDate(lastFeed.startedAt) : null;
  const nextFeedAt = lastFeedStart ? addMinutes(lastFeedStart, feedIntervalMinutes) : null;
  if (nextFeedAt) reasoning.push(de.prediction.feed(feedIntervalMinutes, fmtTime(nextFeedAt, tz)));

  return {
    state,
    nextNapStart,
    nextNapWindow,
    predictedWakeTime,
    nextIsBedtime,
    bedtime,
    confidence,
    reasoning,
    ageWeeks,
    prior,
    wakeWindowMinutes,
    napLengthMinutes,
    observedWindows: n,
    lastSleepEnd,
    currentSleep,
    todayWakeUp,
    nextFeedAt,
    feedIntervalMinutes,
    lastFeedStart,
  };
}
