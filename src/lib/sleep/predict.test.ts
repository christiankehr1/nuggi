import { describe, expect, it } from "vitest";
import { blendWeight, confidenceFor, observe, predict, trimmedMedian } from "./predict";
import { AGE_PRIORS, defaultFeedInterval, priorForWeeks } from "./priors";
import { DEFAULT_BABY_SETTINGS, type BabyEvent, type BabySettings } from "@/lib/types";
import { fmtTime } from "@/lib/time";

const TZ = "Europe/Zurich";
// 2026-09-21 is a Monday in CEST (UTC+2)
const NOW = new Date("2026-09-21T11:00:00Z"); // 13:00 local

function birthDateForWeeks(weeks: number, now = NOW): string {
  const d = new Date(now.getTime() - weeks * 7 * 86_400_000 - 12 * 3600_000);
  return d.toISOString().slice(0, 10);
}

let counter = 0;
function sleep(start: string, end: string | null, subtype: "nap" | "night" = "nap"): BabyEvent {
  counter++;
  return {
    id: `s${counter}`,
    familyId: "f",
    babyId: "b",
    memberId: null,
    kind: "sleep",
    subtype,
    startedAt: new Date(start).toISOString(),
    endedAt: end ? new Date(end).toISOString() : null,
    amountMl: null,
    side: null,
    note: null,
    createdAt: start,
    updatedAt: start,
  };
}
function feed(start: string): BabyEvent {
  counter++;
  return { ...sleep(start, start), id: `f${counter}`, kind: "feed", subtype: "bottle", amountMl: 120 };
}

/** local "YYYY-MM-DDTHH:mm" in CEST → UTC ISO */
const L = (local: string) => new Date(`${local}:00+02:00`).toISOString();

/** A regular 4-month rhythm for `days` days ending yesterday: wake 07:00, naps 08:40–09:25, 11:05–11:55, 13:40–14:30, 16:20–16:50, bed 19:00 */
function rhythm(days: number, windowMin = 100): BabyEvent[] {
  const out: BabyEvent[] = [];
  for (let d = days; d >= 1; d--) {
    const day = new Date(NOW.getTime() - d * 86_400_000).toISOString().slice(0, 10);
    const prev = new Date(NOW.getTime() - (d + 1) * 86_400_000).toISOString().slice(0, 10);
    out.push(sleep(L(`${prev}T19:00`), L(`${day}T07:00`), "night"));
    let wake = 7 * 60;
    for (let n = 0; n < 3; n++) {
      const start = wake + windowMin;
      const end = start + 45;
      const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      out.push(sleep(L(`${day}T${hm(start)}`), L(`${day}T${hm(end)}`)));
      wake = end;
    }
  }
  return out;
}

const settings: BabySettings = { ...DEFAULT_BABY_SETTINGS };

describe("priors", () => {
  it("maps weeks to the right bracket", () => {
    expect(priorForWeeks(0).label).toBe("0–4 Wochen");
    expect(priorForWeeks(4).label).toBe("0–4 Wochen");
    expect(priorForWeeks(5).label).toBe("5–12 Wochen");
    expect(priorForWeeks(12).label).toBe("5–12 Wochen");
    expect(priorForWeeks(13).label).toBe("3–4 Monate");
    expect(priorForWeeks(21).label).toBe("3–4 Monate");
    expect(priorForWeeks(22).label).toBe("5–6 Monate");
    expect(priorForWeeks(31).label).toBe("7–9 Monate");
    expect(priorForWeeks(44).label).toBe("10–12 Monate");
    expect(priorForWeeks(57).label).toBe("13–18 Monate");
    expect(priorForWeeks(83).label).toBe("ab 19 Monaten");
    expect(priorForWeeks(200).label).toBe("ab 19 Monaten");
  });

  it("feed interval defaults", () => {
    expect(defaultFeedInterval(2)).toBe(150);
    expect(defaultFeedInterval(8)).toBe(180);
    expect(defaultFeedInterval(20)).toBe(210);
    expect(defaultFeedInterval(40)).toBe(240);
  });
});

describe("statistics helpers", () => {
  it("trimmedMedian drops 10% each side", () => {
    expect(trimmedMedian([])).toBeNull();
    expect(trimmedMedian([50])).toBe(50);
    expect(trimmedMedian([10, 100, 90, 95, 92, 91, 93, 94, 96, 500])).toBe(93.5);
    expect(trimmedMedian([1, 2, 3])).toBe(2);
  });

  it("blendWeight ramps from 0 at n≤2 to 0.7 at n≥7.6", () => {
    expect(blendWeight(0)).toBe(0);
    expect(blendWeight(2)).toBe(0);
    expect(blendWeight(4)).toBeCloseTo(0.25);
    expect(blendWeight(6)).toBeCloseTo(0.5);
    expect(blendWeight(10)).toBe(0.7);
    expect(blendWeight(100)).toBe(0.7);
  });

  it("confidence buckets", () => {
    expect(confidenceFor(0)).toBe("niedrig");
    expect(confidenceFor(2)).toBe("niedrig");
    expect(confidenceFor(3)).toBe("mittel");
    expect(confidenceFor(9)).toBe("mittel");
    expect(confidenceFor(10)).toBe("hoch");
  });
});

describe("observe", () => {
  it("collects daytime wake windows and nap lengths, ignoring night wakings", () => {
    const events = [
      sleep(L("2026-09-20T19:00"), L("2026-09-20T23:30"), "night"),
      sleep(L("2026-09-20T23:50"), L("2026-09-21T07:00"), "night"), // 20-min night waking → not a wake window
      sleep(L("2026-09-21T08:40"), L("2026-09-21T09:25")),
      sleep(L("2026-09-21T11:05"), L("2026-09-21T11:55")),
    ];
    const o = observe(events, settings, NOW, TZ);
    expect(o.wakeWindows).toEqual([100, 100]);
    expect(o.napLengths).toEqual([45, 50]);
  });
});

describe("predict – prior only (no data)", () => {
  for (const p of AGE_PRIORS) {
    it(`uses the ${p.label} bracket with low confidence`, () => {
      const res = predict({
        baby: { name: "Emma", birthDate: birthDateForWeeks(p.fromWeeks + 1), settings },
        events: [],
        now: NOW,
        tz: TZ,
      });
      expect(res.prior.label).toBe(p.label);
      expect(res.confidence).toBe("niedrig");
      expect(res.state).toBe("awake");
      // first window after (assumed) wake-up: midpoint × 0.9, clamped to ≥ 0.8·min
      const expected = Math.round(Math.max(((p.windowMin + p.windowMax) / 2) * 0.9, 0.8 * p.windowMin));
      expect(res.wakeWindowMinutes).toBe(expected);
      expect(res.napLengthMinutes).toBe(p.napLength);
      expect(res.reasoning.length).toBeGreaterThan(3);
    });
  }

  it("anchors on nightEnd when nothing is logged", () => {
    const res = predict({ baby: { name: "Emma", birthDate: birthDateForWeeks(17), settings }, events: [], now: NOW, tz: TZ });
    // 07:00 + 88 min (97.5 × 0.9 = 87.75) → 08:28 local
    expect(fmtTime(res.nextNapStart, TZ)).toBe("08:28");
    expect(res.nextNapWindow.map((d) => fmtTime(d, TZ))).toEqual(["08:13", "08:43"]);
  });
});

describe("predict – blending with observations", () => {
  it("moves toward the observed median with weight 0.7 after ≥10 windows", () => {
    // 5 days × 3 naps → wake windows: per day 3 gaps of 100 (7:00→8:40, 9:25→11:05, 11:55→13:40) … actually 2 daytime gaps + the bedtime gap
    const events = rhythm(7, 130);
    const res = predict({
      baby: { name: "Emma", birthDate: birthDateForWeeks(17), settings },
      events: [...events, sleep(L("2026-09-21T10:00"), L("2026-09-21T10:45"))],
      now: NOW,
      tz: TZ,
    });
    expect(res.observedWindows).toBeGreaterThanOrEqual(10);
    expect(res.confidence).toBe("hoch");
    // prior midpoint 97.5 (×1.0 midday, one nap done) blended 30/70 with 130 → 120.25 → clamp ≤ 144
    expect(res.wakeWindowMinutes).toBe(120);
    expect(fmtTime(res.nextNapStart, TZ)).toBe("12:45");
  });

  it("clamps to [0.8·min, 1.2·max] of the prior", () => {
    const events = rhythm(7, 250); // far longer observed windows than the 75–120 prior
    const res = predict({
      baby: { name: "Emma", birthDate: birthDateForWeeks(17), settings },
      events: [...events, sleep(L("2026-09-21T10:00"), L("2026-09-21T10:45"))],
      now: NOW,
      tz: TZ,
    });
    expect(res.wakeWindowMinutes).toBe(Math.round(1.2 * 120));
  });

  it("uses no observation weight with fewer than 3 windows", () => {
    const events = rhythm(1, 130); // 2 daytime windows + bedtime gap
    const res = predict({
      baby: { name: "Emma", birthDate: birthDateForWeeks(17), settings },
      events: [...events, sleep(L("2026-09-21T10:00"), L("2026-09-21T10:45"))],
      now: NOW,
      tz: TZ,
    });
    expect(res.observedWindows).toBeLessThanOrEqual(3);
    expect(res.wakeWindowMinutes).toBe(Math.round(97.5 * 1.0 * (1 - blendWeight(res.observedWindows)) + 130 * blendWeight(res.observedWindows)));
  });
});

describe("predict – asleep branch", () => {
  it("predicts wake time from nap length and the next nap after that", () => {
    const events = [...rhythm(3), sleep(L("2026-09-21T12:40"), null)];
    const res = predict({ baby: { name: "Emma", birthDate: birthDateForWeeks(17), settings }, events, now: NOW, tz: TZ });
    expect(res.state).toBe("asleep");
    expect(res.currentSleep?.id).toBeDefined();
    expect(fmtTime(res.predictedWakeTime!, TZ)).toBe("13:25"); // 12:40 + 45
    expect(res.nextNapStart.getTime()).toBe(res.predictedWakeTime!.getTime() + res.wakeWindowMinutes * 60_000);
  });

  it("night sleep: wakes at nightEnd, bedtime moves to tomorrow", () => {
    const now = new Date("2026-09-21T20:00:00Z"); // 22:00 local
    const events = [sleep(L("2026-09-21T19:05"), null, "night")];
    const res = predict({ baby: { name: "Emma", birthDate: birthDateForWeeks(17), settings }, events, now, tz: TZ });
    expect(res.state).toBe("asleep");
    expect(fmtTime(res.predictedWakeTime!, TZ)).toBe("07:00");
    expect(res.predictedWakeTime!.toISOString().slice(0, 10)).toBe("2026-09-22");
    expect(res.bedtime.toISOString().slice(0, 10)).toBe("2026-09-22");
  });
});

describe("predict – bedtime rules", () => {
  const baby = { name: "Emma", birthDate: birthDateForWeeks(17), settings };

  it("is the later of lastNapEnd + last window and target − 45, clamped", () => {
    // last nap ended 17:30. Last window: prior 97.5×1.1 = 107.25 blended (w = 1/8) with the
    // observed median 135 (windows 120/135/240) → 111 → 19:21, later than target − 45 (18:15),
    // inside the clamp [18:00, 19:45].
    const now = new Date("2026-09-21T15:45:00Z"); // 17:45 local
    const events = [
      sleep(L("2026-09-20T19:00"), L("2026-09-21T07:00"), "night"),
      sleep(L("2026-09-21T09:00"), L("2026-09-21T09:45")),
      sleep(L("2026-09-21T12:00"), L("2026-09-21T12:45")),
      sleep(L("2026-09-21T16:45"), L("2026-09-21T17:30")),
    ];
    const res = predict({ baby, events, now, tz: TZ });
    expect(fmtTime(res.bedtime, TZ)).toBe("19:21");
    expect(res.nextIsBedtime).toBe(true);
  });

  it("pushes bedtime 15 min later when daytime sleep exceeds the age share by > 30 min", () => {
    const now = new Date("2026-09-21T15:45:00Z");
    // 3–4 Mo: expected daytime = 3.5 × 45 = 157.5; give 3 × 80 = 240 min naps
    const events = [
      sleep(L("2026-09-20T19:00"), L("2026-09-21T07:00"), "night"),
      sleep(L("2026-09-21T08:30"), L("2026-09-21T09:50")),
      sleep(L("2026-09-21T11:30"), L("2026-09-21T12:50")),
      sleep(L("2026-09-21T15:00"), L("2026-09-21T16:20")),
    ];
    const res = predict({ baby, events, now, tz: TZ });
    // 16:20 + 107 = 18:07 vs 18:15 → 18:15, +15 → 18:30 (within clamp 18:00–19:45)
    expect(fmtTime(res.bedtime, TZ)).toBe("18:30");
    expect(res.reasoning.some((r) => r.includes("später"))).toBe(true);
  });

  it("pulls bedtime 15 min earlier when daytime sleep is short by > 45 min", () => {
    const now = new Date("2026-09-21T15:45:00Z");
    const events = [
      sleep(L("2026-09-20T19:00"), L("2026-09-21T07:00"), "night"),
      sleep(L("2026-09-21T09:00"), L("2026-09-21T09:30")),
      sleep(L("2026-09-21T13:00"), L("2026-09-21T13:30")),
    ];
    const res = predict({ baby, events, now, tz: TZ });
    // 13:30 + 107 = 15:17 vs 18:15 → 18:15 → −15 → 18:00 (clamp floor is 18:00)
    expect(fmtTime(res.bedtime, TZ)).toBe("18:00");
    expect(res.reasoning.some((r) => r.includes("früher"))).toBe(true);
  });

  it("clamps bedtime to target + 45 at the latest", () => {
    const now = new Date("2026-09-21T16:30:00Z"); // 18:30 local
    const events = [
      sleep(L("2026-09-20T19:00"), L("2026-09-21T07:00"), "night"),
      sleep(L("2026-09-21T09:00"), L("2026-09-21T09:45")),
      sleep(L("2026-09-21T12:00"), L("2026-09-21T12:45")),
      sleep(L("2026-09-21T17:30"), L("2026-09-21T18:15")),
    ];
    const res = predict({ baby, events, now, tz: TZ });
    expect(fmtTime(res.bedtime, TZ)).toBe("19:45");
  });
});

describe("predict – feeds", () => {
  it("uses the age default interval or the configured one", () => {
    const events = [feed(L("2026-09-21T11:00"))];
    const a = predict({ baby: { name: "Emma", birthDate: birthDateForWeeks(17), settings }, events, now: NOW, tz: TZ });
    expect(a.feedIntervalMinutes).toBe(210);
    expect(fmtTime(a.nextFeedAt!, TZ)).toBe("14:30");
    const b = predict({
      baby: { name: "Emma", birthDate: birthDateForWeeks(17), settings: { ...settings, feedIntervalMinutes: 120 } },
      events,
      now: NOW,
      tz: TZ,
    });
    expect(fmtTime(b.nextFeedAt!, TZ)).toBe("13:00");
  });
});
