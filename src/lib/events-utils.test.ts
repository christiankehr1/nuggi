import { describe, expect, it } from "vitest";
import { dayTotals, groupByDay, lastEnded, overlapMinutes, runningOf } from "./events-utils";
import type { BabyEvent } from "./types";

const TZ = "Europe/Zurich";

function ev(partial: Partial<BabyEvent> & Pick<BabyEvent, "kind" | "subtype" | "startedAt">): BabyEvent {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    familyId: "f",
    babyId: "b",
    memberId: null,
    endedAt: null,
    amountMl: null,
    side: null,
    note: null,
    createdAt: partial.startedAt,
    updatedAt: partial.startedAt,
    ...partial,
  };
}

// 2026-09-20 is CEST (UTC+2): local midnight = 22:00Z the day before.
const NOW = new Date("2026-09-21T10:00:00Z");

describe("overlapMinutes", () => {
  it("clips to the window and uses now for running events", () => {
    const from = new Date("2026-09-20T22:00:00Z");
    const to = new Date("2026-09-21T22:00:00Z");
    expect(overlapMinutes({ startedAt: "2026-09-20T20:00:00Z", endedAt: "2026-09-21T04:00:00Z" }, from, to, NOW)).toBe(360);
    expect(overlapMinutes({ startedAt: "2026-09-21T09:00:00Z", endedAt: null }, from, to, NOW)).toBe(60);
    expect(overlapMinutes({ startedAt: "2026-09-19T09:00:00Z", endedAt: "2026-09-19T10:00:00Z" }, from, to, NOW)).toBe(0);
  });
});

describe("dayTotals", () => {
  it("splits a night sleep at local midnight and counts feeds by start day", () => {
    const events = [
      // 19:30 local (17:30Z) on the 20th → 06:30 local on the 21st: 4.5h on 20th, 6.5h on 21st
      ev({ kind: "sleep", subtype: "night", startedAt: "2026-09-20T17:30:00Z", endedAt: "2026-09-21T04:30:00Z" }),
      ev({ kind: "sleep", subtype: "nap", startedAt: "2026-09-21T07:00:00Z", endedAt: "2026-09-21T07:45:00Z" }),
      ev({ kind: "feed", subtype: "bottle", startedAt: "2026-09-21T05:00:00Z", endedAt: "2026-09-21T05:10:00Z", amountMl: 120 }),
      ev({ kind: "feed", subtype: "breast", startedAt: "2026-09-20T23:30:00Z", endedAt: "2026-09-20T23:45:00Z" }), // 01:30 local on 21st
      ev({ kind: "feed", subtype: "bottle", startedAt: "2026-09-20T12:00:00Z", endedAt: "2026-09-20T12:10:00Z", amountMl: 90 }),
    ];
    const t21 = dayTotals(events, "2026-09-21", TZ, NOW);
    expect(t21.nightMinutes).toBe(390);
    expect(t21.napMinutes).toBe(45);
    expect(t21.sleepMinutes).toBe(435);
    expect(t21.feeds).toBe(2);
    expect(t21.ml).toBe(120);

    const t20 = dayTotals(events, "2026-09-20", TZ, NOW);
    expect(t20.nightMinutes).toBe(270);
    expect(t20.feeds).toBe(1);
    expect(t20.ml).toBe(90);
  });
});

describe("groupByDay", () => {
  it("groups newest day first and events newest first", () => {
    const events = [
      ev({ id: "a", kind: "feed", subtype: "bottle", startedAt: "2026-09-20T12:00:00Z", endedAt: "2026-09-20T12:10:00Z" }),
      ev({ id: "b", kind: "sleep", subtype: "nap", startedAt: "2026-09-21T07:00:00Z", endedAt: "2026-09-21T07:45:00Z" }),
      ev({ id: "c", kind: "feed", subtype: "breast", startedAt: "2026-09-21T09:00:00Z", endedAt: "2026-09-21T09:15:00Z" }),
    ];
    const groups = groupByDay(events, [], TZ, NOW);
    expect(groups.map((g) => g.dayKey)).toEqual(["2026-09-21", "2026-09-20"]);
    expect(groups[0]!.events.map((e) => e.id)).toEqual(["c", "b"]);
    expect(groups[0]!.totals.feeds).toBe(1);
  });
});

describe("running / last helpers", () => {
  it("finds running and last ended events per kind", () => {
    const events = [
      ev({ id: "s1", kind: "sleep", subtype: "nap", startedAt: "2026-09-21T07:00:00Z", endedAt: "2026-09-21T07:45:00Z" }),
      ev({ id: "s2", kind: "sleep", subtype: "nap", startedAt: "2026-09-21T09:30:00Z" }),
      ev({ id: "f1", kind: "feed", subtype: "bottle", startedAt: "2026-09-21T08:00:00Z", endedAt: "2026-09-21T08:10:00Z" }),
    ];
    expect(runningOf(events, "sleep")?.id).toBe("s2");
    expect(runningOf(events, "feed")).toBeNull();
    expect(lastEnded(events, "sleep")?.id).toBe("s1");
    expect(lastEnded(events, "feed")?.id).toBe("f1");
  });
});
