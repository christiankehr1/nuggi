import { describe, expect, it } from "vitest";
import { dedupeKey, dueReminders, type ReminderContext } from "./reminders";
import { runningOf } from "@/lib/events-utils";
import { predict } from "@/lib/sleep/predict";
import { DEFAULT_BABY_SETTINGS, type BabyEvent } from "@/lib/types";

const TZ = "Europe/Zurich";
const L = (local: string) => new Date(`${local}:00+02:00`);

function ev(kind: "sleep" | "feed", subtype: BabyEvent["subtype"], start: Date, end: Date | null): BabyEvent {
  return {
    id: `${kind}-${start.toISOString()}`, familyId: "f", babyId: "b", memberId: null, kind, subtype,
    startedAt: start.toISOString(), endedAt: end ? end.toISOString() : null, amountMl: null, side: null, note: null,
    createdAt: start.toISOString(), updatedAt: start.toISOString(),
  };
}

function ctx(now: Date, events: BabyEvent[], weeks = 17, settings = DEFAULT_BABY_SETTINGS): ReminderContext {
  const birthDate = new Date(now.getTime() - weeks * 7 * 86_400_000 - 12 * 3600_000).toISOString().slice(0, 10);
  const baby = { name: "Emma", birthDate, settings };
  return {
    babyId: "b",
    babyName: "Emma",
    ageWeeks: weeks,
    settings,
    prediction: predict({ baby, events, now, tz: TZ }),
    now,
    tz: TZ,
    runningFeed: runningOf(events, "feed"),
  };
}

describe("dedupeKey", () => {
  it("rounds to 10 minutes", () => {
    expect(dedupeKey("b", "nap", new Date("2026-09-21T10:04:00Z"))).toBe("b:nap:2026-09-21T10:00:00.000Z");
    expect(dedupeKey("b", "nap", new Date("2026-09-21T10:06:00Z"))).toBe("b:nap:2026-09-21T10:10:00.000Z");
  });
});

describe("dueReminders", () => {
  // Emma (17 weeks, no observations, one nap done → midday factor 1.0): last sleep ended 09:00
  // → window 98 min → nap 10:38; lead 15 → reminder at 10:23
  const base = [ev("sleep", "night", L("2026-09-20T19:00"), L("2026-09-21T07:00")), ev("sleep", "nap", L("2026-09-21T08:15"), L("2026-09-21T09:00"))];

  it("fires the nap reminder within ±5 min of nextNapStart − lead", () => {
    const due = dueReminders(ctx(L("2026-09-21T10:21"), base));
    expect(due.map((d) => d.kind)).toEqual(["nap"]);
    expect(due[0]!.title).toBe("Emma wird bald müde…");
    expect(due[0]!.body).toContain("In 15 Min");
    expect(due[0]!.dedupeKey).toMatch(/^b:nap:/);
  });

  it("does not fire outside the window or while asleep", () => {
    expect(dueReminders(ctx(L("2026-09-21T09:50"), base))).toEqual([]);
    const asleep = [...base, ev("sleep", "nap", L("2026-09-21T10:05"), null)];
    expect(dueReminders(ctx(L("2026-09-21T10:21"), asleep)).filter((d) => d.kind === "nap")).toEqual([]);
  });

  it("respects the per-kind toggles", () => {
    const settings = { ...DEFAULT_BABY_SETTINGS, reminders: { nap: false, feed: true, bedtime: true, breast: true } };
    expect(dueReminders(ctx(L("2026-09-21T10:21"), base, 17, settings))).toEqual([]);
  });

  it("fires the feed reminder at lastFeed + interval, muted at night for babies ≥ 12 weeks", () => {
    // 17 weeks → 210 min interval
    const day = [...base, ev("feed", "bottle", L("2026-09-21T07:30"), L("2026-09-21T07:40"))];
    const due = dueReminders(ctx(L("2026-09-21T11:02"), day));
    expect(due.map((d) => d.kind)).toEqual(["feed"]);
    expect(due[0]!.title).toBe("Zeit fürs Fläschchen?");

    // night feed at 20:30 → next 00:00 → quiet for a 17-week-old …
    const night = [ev("sleep", "night", L("2026-09-21T19:00"), null), ev("feed", "breast", L("2026-09-21T20:30"), L("2026-09-21T20:45"))];
    expect(dueReminders(ctx(L("2026-09-22T00:01"), night, 17))).toEqual([]);
    // … but not for a 6-week-old (interval 180 → 23:30)
    expect(dueReminders(ctx(L("2026-09-21T23:31"), night, 6)).map((d) => d.kind)).toEqual(["feed"]);
  });

  it("fires the bedtime reminder before the predicted bedtime", () => {
    const evening = [
      ev("sleep", "night", L("2026-09-20T19:00"), L("2026-09-21T07:00")),
      ev("sleep", "nap", L("2026-09-21T09:00"), L("2026-09-21T09:45")),
      ev("sleep", "nap", L("2026-09-21T12:00"), L("2026-09-21T12:45")),
      ev("sleep", "nap", L("2026-09-21T15:30"), L("2026-09-21T16:15")),
    ];
    const c = ctx(L("2026-09-21T18:00"), evening);
    const bedtime = c.prediction.bedtime;
    const at = new Date(bedtime.getTime() - 15 * 60_000);
    const due = dueReminders({ ...c, now: at });
    expect(due.map((d) => d.kind)).toContain("bedtime");
    expect(due.find((d) => d.kind === "bedtime")!.title).toBe("Gleich ist Schlafenszeit 🌙");
  });
});

describe("breast cue", () => {
  const night = ev("sleep", "night", L("2026-09-20T19:00"), L("2026-09-21T07:00"));
  const running: BabyEvent = { ...ev("feed", "breast", L("2026-09-21T10:00"), null), id: "feed-1", side: "L" };
  const breast = (now: string, events: BabyEvent[], settings = DEFAULT_BABY_SETTINGS) =>
    dueReminders(ctx(L(now), events, 17, settings)).filter((d) => d.kind === "breast");

  it("fires once the running breast feed has lasted breastCueMinutes, keyed by the event", () => {
    const due = breast("2026-09-21T10:15", [night, running]);
    expect(due).toHaveLength(1);
    expect(due[0]!.dedupeKey).toBe("b:breast:feed-1");
    expect(due[0]!.at.toISOString()).toBe(L("2026-09-21T10:15").toISOString());
    expect(due[0]!.title).toBe("Stillen läuft seit 15 Min 🤱");
    expect(due[0]!.body).toBe("Emma trinkt seit 15 Min links. Seite wechseln oder beenden?");
    // still due a while later (the cron may run late), same key → sent once
    expect(breast("2026-09-21T10:23", [night, running])[0]!.dedupeKey).toBe("b:breast:feed-1");
  });

  it("stays quiet before the threshold, after the grace period, for other feeds and when switched off", () => {
    expect(breast("2026-09-21T10:14", [night, running])).toEqual([]);
    expect(breast("2026-09-21T11:16", [night, running])).toEqual([]);
    const bottle: BabyEvent = { ...ev("feed", "bottle", L("2026-09-21T10:00"), null), id: "feed-2" };
    expect(breast("2026-09-21T10:20", [night, bottle])).toEqual([]);
    const ended: BabyEvent = { ...running, endedAt: L("2026-09-21T10:12").toISOString() };
    expect(breast("2026-09-21T10:20", [night, ended])).toEqual([]);
    const off = { ...DEFAULT_BABY_SETTINGS, reminders: { ...DEFAULT_BABY_SETTINGS.reminders, breast: false } };
    expect(breast("2026-09-21T10:20", [night, running], off)).toEqual([]);
  });

  it("uses the configured minutes and drops the side for 'both'", () => {
    const ten = { ...DEFAULT_BABY_SETTINGS, breastCueMinutes: 10 };
    expect(breast("2026-09-21T10:10", [night, running], ten)[0]!.title).toContain("10 Min");
    expect(breast("2026-09-21T10:09", [night, running], ten)).toEqual([]);
    const both: BabyEvent = { ...running, side: "both" };
    expect(breast("2026-09-21T10:15", [night, both])[0]!.body).toBe("Emma trinkt seit 15 Min. Seite wechseln oder beenden?");
  });
});
