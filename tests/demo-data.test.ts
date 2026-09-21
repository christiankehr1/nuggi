import { describe, expect, it } from "vitest";
import { generateDemoEvents, generateDemoMeasurements } from "../scripts/lib/demo-data";

/**
 * The seed must never produce rows that violate the schema: the constraints
 * are checked here against several "now" instants and seeds.
 */
const TZ = "Europe/Zurich";
const NOWS = [
  new Date("2026-09-21T08:30:00Z"),
  new Date("2026-09-21T12:00:00Z"),
  new Date("2026-09-21T19:45:00Z"),
  new Date("2026-01-05T06:10:00Z"),
];

describe("generateDemoEvents", () => {
  for (const now of NOWS) {
    for (const seed of [42, 99, 7]) {
      it(`produces schema-valid events for ${now.toISOString()} seed ${seed}`, () => {
        const events = generateDemoEvents({ now, days: 14, tz: TZ, seed });
        expect(events.length).toBeGreaterThan(50);
        let runningSleep = 0;
        let runningFeed = 0;
        for (const e of events) {
          if (e.endedAt) expect(e.endedAt >= e.startedAt, `${e.kind} ${e.startedAt}`).toBe(true);
          expect(new Date(e.startedAt).getTime()).toBeLessThanOrEqual(now.getTime() + 60_000);
          if (e.kind === "sleep") expect(["nap", "night"]).toContain(e.subtype);
          else expect(["breast", "bottle", "solids"]).toContain(e.subtype);
          if (e.side) expect(["L", "R", "both"]).toContain(e.side);
          if (e.amountMl != null) expect(e.amountMl).toBeGreaterThan(0);
          if (e.endedAt === null && e.kind === "sleep") runningSleep++;
          if (e.endedAt === null && e.kind === "feed") runningFeed++;
        }
        expect(runningSleep).toBeLessThanOrEqual(1);
        expect(runningFeed).toBeLessThanOrEqual(1);
        // sorted ascending
        for (let i = 1; i < events.length; i++) {
          expect(events[i]!.startedAt >= events[i - 1]!.startedAt).toBe(true);
        }
      });
    }
  }

  it("has both naps and night sleeps and feeds", () => {
    const events = generateDemoEvents({ now: NOWS[0]!, days: 14, tz: TZ });
    expect(events.some((e) => e.subtype === "nap")).toBe(true);
    expect(events.some((e) => e.subtype === "night")).toBe(true);
    expect(events.some((e) => e.subtype === "bottle")).toBe(true);
    expect(events.some((e) => e.subtype === "breast")).toBe(true);
  });
});

describe("generateDemoMeasurements", () => {
  it("produces plausible values", () => {
    const ms = generateDemoMeasurements({ now: NOWS[0]!, birthDate: "2026-05-16", tz: TZ });
    for (const m of ms) {
      if (m.kind === "weight_g") expect(m.value).toBeGreaterThan(3000);
      if (m.kind === "height_cm") expect(m.value).toBeGreaterThan(45);
      if (m.kind === "head_cm") expect(m.value).toBeGreaterThan(30);
      if (m.kind === "temp_c") expect(m.value).toBeGreaterThan(35);
      expect(new Date(m.measuredAt).getTime()).toBeLessThanOrEqual(NOWS[0]!.getTime());
    }
    expect(ms.some((m) => m.kind === "temp_c" && m.value >= 38)).toBe(true);
  });
});
