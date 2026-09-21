import type { Baby, BabyEvent, Measurement } from "@/lib/types";
import { formatInTimeZone } from "date-fns-tz";

/** RFC-4180-ish CSV with a UTF-8 BOM so Excel/Numbers open umlauts correctly. */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: unknown[][]): string {
  return "﻿" + rows.map((r) => r.map(csvEscape).join(",")).join("\r\n") + "\r\n";
}

const local = (iso: string | null, tz: string) => (iso ? formatInTimeZone(new Date(iso), tz, "yyyy-MM-dd HH:mm") : "");

export function eventsCsv(events: BabyEvent[], babies: Baby[], tz: string): string {
  const name = new Map(babies.map((b) => [b.id, b.name]));
  const rows: unknown[][] = [
    ["baby", "art", "typ", "beginn_lokal", "ende_lokal", "dauer_min", "menge_ml", "seite", "notiz", "eingetragen_von", "beginn_utc", "ende_utc", "id"],
  ];
  for (const e of events) {
    const mins = e.endedAt ? Math.round((new Date(e.endedAt).getTime() - new Date(e.startedAt).getTime()) / 60000) : "";
    rows.push([
      name.get(e.babyId) ?? e.babyId,
      e.kind,
      e.subtype,
      local(e.startedAt, tz),
      local(e.endedAt, tz),
      mins,
      e.amountMl ?? "",
      e.side ?? "",
      e.note ?? "",
      e.memberName ?? "",
      e.startedAt,
      e.endedAt ?? "",
      e.id,
    ]);
  }
  return toCsv(rows);
}

export function measurementsCsv(measurements: Measurement[], babies: Baby[], tz: string): string {
  const name = new Map(babies.map((b) => [b.id, b.name]));
  const rows: unknown[][] = [["baby", "art", "wert", "gemessen_lokal", "notiz", "eingetragen_von", "gemessen_utc", "id"]];
  for (const m of measurements) {
    rows.push([name.get(m.babyId) ?? m.babyId, m.kind, m.value, local(m.measuredAt, tz), m.note ?? "", m.memberName ?? "", m.measuredAt, m.id]);
  }
  return toCsv(rows);
}
