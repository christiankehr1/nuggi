import { describe, expect, it } from "vitest";
import { csvEscape, eventsCsv, measurementsCsv, toCsv } from "./csv";
import type { Baby, BabyEvent, Measurement } from "./types";

const baby: Baby = {
  id: "b1", familyId: "f", name: "Emma", birthDate: "2026-05-20", sex: "f",
  settings: { napLeadMinutes: 15, feedIntervalMinutes: null, bedtimeTarget: "19:00", nightStart: "19:00", nightEnd: "07:00", reminders: { nap: true, feed: true, bedtime: true, breast: true }, breastCueMinutes: 15 },
  createdAt: "2026-05-20T00:00:00Z",
};

describe("csv", () => {
  it("escapes quotes, commas and newlines", () => {
    expect(csvEscape('a "b"')).toBe('"a ""b"""');
    expect(csvEscape("x,y")).toBe('"x,y"');
    expect(csvEscape("l1\nl2")).toBe('"l1\nl2"');
    expect(csvEscape(null)).toBe("");
    expect(toCsv([["a", 1], ["b", null]])).toBe("﻿a,1\r\nb,\r\n");
  });

  it("exports events in local time with duration", () => {
    const e: BabyEvent = {
      id: "e1", familyId: "f", babyId: "b1", memberId: "m", kind: "feed", subtype: "bottle",
      startedAt: "2026-09-21T08:00:00.000Z", endedAt: "2026-09-21T08:15:00.000Z", amountMl: 120, side: null,
      note: 'Hat "gut" getrunken', createdAt: "", updatedAt: "", memberName: "Mama",
    };
    const csv = eventsCsv([e], [baby], "Europe/Zurich");
    const lines = csv.split("\r\n");
    expect(lines[0]).toContain("baby,art,typ,beginn_lokal");
    expect(lines[1]).toBe('Emma,feed,bottle,2026-09-21 10:00,2026-09-21 10:15,15,120,,"Hat ""gut"" getrunken",Mama,2026-09-21T08:00:00.000Z,2026-09-21T08:15:00.000Z,e1');
  });

  it("exports measurements", () => {
    const m: Measurement = {
      id: "m1", familyId: "f", babyId: "b1", memberId: null, kind: "temp_c", value: 38.3,
      measuredAt: "2026-09-19T18:00:00.000Z", note: null, createdAt: "", memberName: null,
    };
    const csv = measurementsCsv([m], [baby], "Europe/Zurich");
    expect(csv.split("\r\n")[1]).toBe("Emma,temp_c,38.3,2026-09-19 20:00,,,2026-09-19T18:00:00.000Z,m1");
  });
});
