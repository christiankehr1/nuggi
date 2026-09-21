import { de } from "@/i18n/de";
import type { BabyEvent, Measurement, MeasurementKind } from "@/lib/types";
import { fmtTime, localDayKey, minutesBetween } from "@/lib/time";

/** "1 h 20", "42 Min" */
export function durationLabel(minutes: number): string {
  return de.time.durationShort(Math.max(0, Math.round(minutes)));
}

/** "vor 2 h 10" style relative label (without the "vor") */
export function elapsedLabel(from: string | Date, now: Date): string {
  return durationLabel(minutesBetween(from, now));
}

export function eventDurationMinutes(e: BabyEvent, now: Date = new Date()): number {
  return minutesBetween(e.startedAt, e.endedAt ?? now);
}

export function subtypeLabel(e: Pick<BabyEvent, "kind" | "subtype">): string {
  switch (e.subtype) {
    case "nap":
      return de.events.nap;
    case "night":
      return de.events.night;
    case "breast":
      return de.events.breast;
    case "bottle":
      return de.events.bottle;
    case "solids":
      return de.events.solids;
    default:
      return e.kind === "sleep" ? de.events.sleep : de.events.feed;
  }
}

export function sideLabel(side: BabyEvent["side"]): string | null {
  if (side === "L") return de.events.sideL;
  if (side === "R") return de.events.sideR;
  if (side === "both") return de.events.sideBoth;
  return null;
}

/** "Fläschchen 120 ml" / "Stillen links" / "Beikost · Karottenbrei" */
export function eventDetail(e: BabyEvent): string {
  const parts: string[] = [subtypeLabel(e)];
  if (e.subtype === "bottle" && e.amountMl != null) parts.push(`${e.amountMl} ml`);
  if (e.subtype === "breast") {
    const s = sideLabel(e.side);
    if (s) parts.push(s);
  }
  if (e.subtype === "solids" && e.note) parts.push(`· ${e.note}`);
  return parts.join(" ");
}

/** "13:05–13:50" or "13:05–…" for running events */
export function timeRange(e: BabyEvent, tz: string): string {
  const start = fmtTime(e.startedAt, tz);
  if (!e.endedAt) return `${start}–…`;
  const end = fmtTime(e.endedAt, tz);
  const crossesDay = localDayKey(e.startedAt, tz) !== localDayKey(e.endedAt, tz);
  return crossesDay ? `${start}–${end}⁺` : `${start}–${end}`;
}

export function measurementKindLabel(kind: MeasurementKind): string {
  switch (kind) {
    case "weight_g":
      return de.measurements.weight;
    case "height_cm":
      return de.measurements.height;
    case "head_cm":
      return de.measurements.head;
    case "temp_c":
      return de.measurements.temp;
  }
}

export function measurementUnit(kind: MeasurementKind): string {
  switch (kind) {
    case "weight_g":
      return de.measurements.unitWeight;
    case "height_cm":
      return de.measurements.unitHeight;
    case "head_cm":
      return de.measurements.unitHead;
    case "temp_c":
      return de.measurements.unitTemp;
  }
}

/** "4.320 g", "62,5 cm", "38,3 °C" (Swiss/German formatting) */
export function measurementValueLabel(m: Pick<Measurement, "kind" | "value">): string {
  const unit = measurementUnit(m.kind);
  if (m.kind === "weight_g") {
    return `${new Intl.NumberFormat("de-CH").format(Math.round(m.value))} ${unit}`;
  }
  return `${m.value.toLocaleString("de-CH", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${unit}`;
}

export const FEVER_THRESHOLD_C = 38.0;

export function isFever(m: Pick<Measurement, "kind" | "value">): boolean {
  return m.kind === "temp_c" && m.value >= FEVER_THRESHOLD_C;
}

/** "Heute", "Gestern", "Mo, 21.09." */
export function dayHeading(dayKey: string, todayKey: string, yesterdayKey: string): string {
  if (dayKey === todayKey) return de.common.today;
  if (dayKey === yesterdayKey) return de.common.yesterday;
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  const weekday = de.time.weekdayShort[date.getUTCDay()];
  return `${weekday}, ${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.`;
}
