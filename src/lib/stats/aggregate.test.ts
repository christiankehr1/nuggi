import { describe, expect, it } from "vitest";
import { addDaysToKey, dayStats, weekStartKey, weekStats } from "./aggregate";
import { DEFAULT_BABY_SETTINGS, type BabyEvent } from "@/lib/types";

const TZ = "Europe/Zurich";
const NOW = new Date("2026-09-21T11:00:00Z"); // Mon 13:00 local
const settings = DEFAULT_BABY_SETTINGS;
const L = (local: string) => new Date(`${local}:00+02:00`).toISOString();

let n = 0;
function ev(kind: "sleep" | "feed", subtype: BabyEvent["subtype"], start: string, end: string | null, extra: Partial<BabyEvent> = {}): BabyEvent {
  n++;
  return {
    id: `e${n}`, familyId: "f", babyId: "b", memberId: null, kind, subtype,
    startedAt: L(start), endedAt: end ? L(end) : null, amountMl: null, side: null, note: null,
    createdAt: L(start), updatedAt: L(start), ...extra,
  };
}

describe("weekStartKey", () => {
  it("returns the Monday of the local week", () => {
    expect(weekStartKey(new Date("2026-09-21T11:00:00Z"), TZ)).toBe("2026-09-21"); // Monday
    expect(weekStartKey(new Date("2026-09-27T20:00:00Z"), TZ)).toBe("2026-09-21"); // Sunday 22:00 local
    expect(weekStartKey(new Date("2026-09-27T22:30:00Z"), TZ)).toBe("2026-09-28"); // Monday 00:30 local
    expect(addDaysToKey("2026-09-21", 6, TZ)).toBe("2026-09-27");
  });
});

describe("dayStats", () => {
  it("splits sleep at local midnight and finds bedtime", () => {
    const events = [
      ev("sleep", "night", "2026-09-19T19:30", "2026-09-20T06:30"),
      ev("sleep", "nap", "2026-09-20T09:00", "2026-09-20T09:45"),
      ev("sleep", "nap", "2026-09-20T13:00", "2026-09-20T14:00"),
      ev("sleep", "night", "2026-09-20T19:10", "2026-09-21T06:50"),
      ev("feed", "bottle", "2026-09-20T07:00", "2026-09-20T07:10", { amountMl: 120 }),
      ev("feed", "breast", "2026-09-20T12:00", "2026-09-20T12:15"),
    ];
    const d = dayStats(events, "2026-09-20", TZ, settings, NOW);
    expect(d.nightMinutes).toBe(390 + 290); // 00:00–06:30 + 19:10–24:00
    expect(d.napMinutes).toBe(105);
    expect(d.sleepMinutes).toBe(785);
    expect(d.napCount).toBe(2);
    expect(d.bedtimeMinute).toBe(19 * 60 + 10);
    expect(d.longestSleepMinutes).toBe(700); // 19:10 → 06:50
    expect(d.feeds).toBe(2);
    expect(d.ml).toBe(120);
    // wake windows starting on the 20th: 06:30→09:00 (150), 09:45→13:00 (195), 14:00→19:10 (310)
    expect(d.wakeWindows).toEqual([150, 195, 310]);
    expect(d.wakeWindowMedian).toBe(195);
  });

  it("counts night wakings as gaps ≥ 5 min inside the night window", () => {
    const events = [
      ev("sleep", "night", "2026-09-20T19:00", "2026-09-20T23:00"),
      ev("sleep", "night", "2026-09-20T23:20", "2026-09-21T02:00"), // gap 20 → waking
      ev("sleep", "night", "2026-09-21T02:03", "2026-09-21T04:00"), // gap 3 → not a waking
      ev("sleep", "night", "2026-09-21T04:30", "2026-09-21T06:45"), // gap 30 → waking
      ev("sleep", "nap", "2026-09-21T08:30", "2026-09-21T09:15"), // daytime gap → ignored
    ];
    expect(dayStats(events, "2026-09-20", TZ, settings, NOW).nightWakings).toBe(2);
    expect(dayStats(events, "2026-09-21", TZ, settings, NOW).nightWakings).toBe(0);
    // night wakings are not wake windows; the morning wake-up (06:45 → 08:30) is
    expect(dayStats(events, "2026-09-21", TZ, settings, NOW).wakeWindows).toEqual([105]);
  });

  it("does not report a bedtime before 16:00 and handles empty days", () => {
    const events = [ev("sleep", "night", "2026-09-20T13:00", "2026-09-20T15:00")];
    const d = dayStats(events, "2026-09-20", TZ, settings, NOW);
    expect(d.bedtimeMinute).toBeNull();
    const empty = dayStats([], "2026-09-18", TZ, settings, NOW);
    expect(empty.hasData).toBe(false);
    expect(empty.wakeWindowMedian).toBeNull();
  });
});

describe("weekStats", () => {
  it("aggregates across the week and ignores future days", () => {
    const events = [
      ev("sleep", "night", "2026-09-14T19:00", "2026-09-15T07:00"),
      ev("sleep", "nap", "2026-09-15T09:00", "2026-09-15T10:00"),
      ev("sleep", "night", "2026-09-15T19:30", "2026-09-16T07:00"),
      ev("sleep", "nap", "2026-09-16T09:00", "2026-09-16T09:30"),
      ev("feed", "bottle", "2026-09-15T08:00", "2026-09-15T08:10", { amountMl: 100 }),
      ev("feed", "bottle", "2026-09-16T08:00", "2026-09-16T08:10", { amountMl: 140 }),
    ];
    const w = weekStats(events, "2026-09-14", TZ, settings, NOW);
    expect(w.days).toHaveLength(7);
    expect(w.days.map((d) => d.dayKey)[6]).toBe("2026-09-20");
    expect(w.daysWithData).toBe(3); // 14th (night start), 15th, 16th
    expect(w.avgBedtimeMinute).toBe((19 * 60 + 19 * 60 + 30) / 2);
    expect(w.avgNapLength).toBe(45);
    expect(w.avgFeeds).toBe(1);
    expect(w.avgMl).toBe(120);
    expect(w.longest?.minutes).toBe(720);
    expect(w.longest?.dayKey).toBe("2026-09-14");

    const future = weekStats(events, "2026-09-21", TZ, settings, NOW);
    expect(future.days.filter((d) => d.hasData)).toHaveLength(0);
    expect(future.avgSleepMinutes).toBeNull();
  });
});
