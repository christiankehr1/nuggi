import { describe, expect, it } from "vitest";
import { weeklySummary } from "./summary";
import type { WeekStats } from "./aggregate";

function week(partial: Partial<WeekStats>): WeekStats {
  return {
    weekStartKey: "2026-09-14",
    days: [],
    daysWithData: 7,
    avgSleepMinutes: 13 * 60 + 15,
    avgNapMinutes: 180,
    avgNightMinutes: 615,
    avgNaps: 3.2,
    avgNapLength: 48,
    avgBedtimeMinute: 19 * 60 + 24,
    totalWakings: 9,
    avgWakings: 1.3,
    longest: { minutes: 6 * 60 + 40, dayKey: "2026-09-17" },
    wakeWindowMedian: 100,
    avgFeeds: 6.4,
    avgMl: 480,
    ...partial,
  };
}

describe("weeklySummary", () => {
  it("returns the no-data sentence when there is no sleep", () => {
    expect(weeklySummary("Emma", week({ avgSleepMinutes: null }), null)).toEqual([
      "Für Emma gibt es diese Woche noch keine Schlafeinträge.",
    ]);
  });

  it("compares with last week", () => {
    const lines = weeklySummary("Emma", week({}), week({ avgSleepMinutes: 12 * 60 + 35, avgBedtimeMinute: 19 * 60 + 40 }));
    expect(lines[0]).toBe("Emma hat diese Woche im Schnitt 13 h 15 geschlafen, 40 Min mehr als letzte Woche.");
    expect(lines[1]).toBe("Die Schlafenszeit lag im Schnitt bei 19:24, 16 Min früher als letzte Woche.");
    expect(lines[2]).toBe("Tagsüber gab es im Schnitt 3,2 Nickerchen von je etwa 48 Min.");
    expect(lines[3]).toBe("Nachts ist 1,3-mal Aufwachen dazugekommen.");
    expect(lines[4]).toBe("Die längste Schlafphase dauerte 6 h 40 (Donnerstag).");
    expect(lines).toHaveLength(5);
  });

  it("handles a missing last week and calm nights", () => {
    const lines = weeklySummary("Emma", week({ totalWakings: 0, avgWakings: 0, longest: null }), null);
    expect(lines[0]).toBe("Emma hat diese Woche im Schnitt 13 h 15 geschlafen.");
    expect(lines[1]).toBe("Die Schlafenszeit lag im Schnitt bei 19:24.");
    expect(lines).toContain("Die Nächte waren durchgehend ruhig – kein Aufwachen eingetragen.");
    expect(lines[lines.length - 1]).toBe("Es gab im Schnitt 6,4 Mahlzeiten pro Tag, davon 480 ml aus dem Fläschchen.");
  });

  it("treats tiny differences as equal", () => {
    const lines = weeklySummary("Emma", week({}), week({ avgSleepMinutes: 13 * 60 + 12, avgBedtimeMinute: 19 * 60 + 22 }));
    expect(lines[0]).toContain("genauso viel wie letzte Woche");
    expect(lines[1]).toBe("Die Schlafenszeit lag im Schnitt bei 19:24.");
  });
});
