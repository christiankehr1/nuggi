import { describe, expect, it } from "vitest";
import { dailyDedupeKey, dueDailyReminders, pendingInAppReminders } from "./daily";
import type { DailyReminder } from "@/lib/types";

const TZ = "Europe/Zurich";
const L = (local: string) => new Date(`${local}:00+02:00`);

const vitamins: DailyReminder = { id: "r1", name: "Vitamine", time: "08:00", enabled: true, push: true, inApp: true };

describe("dueDailyReminders", () => {
  it("fires within ±5 min of the local time, once per day", () => {
    const due = dueDailyReminders({ familyId: "f", reminders: [vitamins], now: L("2026-09-21T07:57"), tz: TZ });
    expect(due).toHaveLength(1);
    expect(due[0]!.kind).toBe("daily");
    expect(due[0]!.title).toBe("Vitamine – nicht vergessen ⏰");
    expect(due[0]!.dedupeKey).toBe("f:daily:r1:2026-09-21");
    expect(due[0]!.at.toISOString()).toBe(L("2026-09-21T08:00").toISOString());
  });

  it("tolerates a late cron run up to 20 minutes, not beyond", () => {
    expect(dueDailyReminders({ familyId: "f", reminders: [vitamins], now: L("2026-09-21T08:19"), tz: TZ })).toHaveLength(1);
    expect(dueDailyReminders({ familyId: "f", reminders: [vitamins], now: L("2026-09-21T08:21"), tz: TZ })).toHaveLength(0);
    expect(dueDailyReminders({ familyId: "f", reminders: [vitamins], now: L("2026-09-21T07:54"), tz: TZ })).toHaveLength(0);
  });

  it("skips disabled reminders and reminders without the push channel", () => {
    const off = { ...vitamins, enabled: false };
    const inAppOnly = { ...vitamins, push: false };
    expect(dueDailyReminders({ familyId: "f", reminders: [off, inAppOnly], now: L("2026-09-21T08:00"), tz: TZ })).toEqual([]);
  });

  it("uses the family's timezone", () => {
    // 08:00 in Zurich is 06:00 UTC; a family in Lisbon (UTC+1 in summer) is due at 07:00 UTC
    const zurich = dueDailyReminders({ familyId: "f", reminders: [vitamins], now: new Date("2026-09-21T06:00:00Z"), tz: TZ });
    const lisbon = dueDailyReminders({ familyId: "f", reminders: [vitamins], now: new Date("2026-09-21T06:00:00Z"), tz: "Europe/Lisbon" });
    expect(zurich).toHaveLength(1);
    expect(lisbon).toHaveLength(0);
  });
});

describe("dailyDedupeKey", () => {
  it("is keyed by the local day", () => {
    // 23:30 UTC on the 21st is already the 22nd in Zurich
    expect(dailyDedupeKey("f", "r1", new Date("2026-09-21T23:30:00Z"), TZ)).toBe("f:daily:r1:2026-09-22");
  });
});

describe("pendingInAppReminders", () => {
  const evening: DailyReminder = { ...vitamins, id: "r2", name: "Fluor", time: "19:30" };
  it("lists reminders whose time has passed today", () => {
    expect(pendingInAppReminders([vitamins, evening], L("2026-09-21T07:59"), TZ)).toEqual([]);
    expect(pendingInAppReminders([vitamins, evening], L("2026-09-21T08:00"), TZ).map((r) => r.id)).toEqual(["r1"]);
    expect(pendingInAppReminders([vitamins, evening], L("2026-09-21T22:00"), TZ).map((r) => r.id)).toEqual(["r1", "r2"]);
  });
  it("ignores disabled and push-only reminders", () => {
    const pushOnly = { ...vitamins, inApp: false };
    const off = { ...evening, enabled: false };
    expect(pendingInAppReminders([pushOnly, off], L("2026-09-21T22:00"), TZ)).toEqual([]);
  });
});
