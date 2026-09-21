import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { addDays, differenceInMinutes, startOfDay } from "date-fns";
import { DEFAULT_TIMEZONE } from "@/config";

/**
 * Time helpers. Everything is stored in UTC; these convert to and from the
 * family's timezone for display and for "local day" calculations.
 */

export type TZ = string;

export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** "13:05" in the given timezone */
export function fmtTime(value: string | Date, tz: TZ = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(toDate(value), tz, "HH:mm");
}

/** "21.09." */
export function fmtDayShort(value: string | Date, tz: TZ = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(toDate(value), tz, "dd.MM.");
}

/** "21.09.2026" */
export function fmtDate(value: string | Date, tz: TZ = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(toDate(value), tz, "dd.MM.yyyy");
}

/** "2026-09-21" – the local calendar day a timestamp falls on */
export function localDayKey(value: string | Date, tz: TZ = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(toDate(value), tz, "yyyy-MM-dd");
}

/** Local weekday 0 = Sunday … 6 = Saturday */
export function localWeekday(value: string | Date, tz: TZ = DEFAULT_TIMEZONE): number {
  return Number(formatInTimeZone(toDate(value), tz, "i")) % 7;
}

/** Start of the local day (as a UTC instant) containing `value`. */
export function startOfLocalDay(value: string | Date, tz: TZ = DEFAULT_TIMEZONE): Date {
  const zoned = toZonedTime(toDate(value), tz);
  return fromZonedTime(startOfDay(zoned), tz);
}

/** Start of the local day `n` days after the one containing `value`. */
export function addLocalDays(value: string | Date, n: number, tz: TZ = DEFAULT_TIMEZONE): Date {
  const zoned = toZonedTime(toDate(value), tz);
  return fromZonedTime(startOfDay(addDays(zoned, n)), tz);
}

/** Parse a day key "2026-09-21" to the UTC instant at local midnight. */
export function dayKeyToDate(dayKey: string, tz: TZ = DEFAULT_TIMEZONE): Date {
  return fromZonedTime(`${dayKey}T00:00:00`, tz);
}

export function parseHm(hm: string): { h: number; m: number } {
  const [hs, ms] = hm.split(":");
  const h = Number(hs);
  const m = Number(ms ?? 0);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return { h: 19, m: 0 };
  return { h, m };
}

export function hmToMinutes(hm: string): number {
  const { h, m } = parseHm(hm);
  return h * 60 + m;
}

export function minutesToHm(total: number): string {
  const t = ((Math.round(total) % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * The UTC instant of local time `hm` on the local day that contains `value`.
 * e.g. atLocalTime(now, "19:00") → tonight 19:00 in the family's timezone.
 */
export function atLocalTime(value: string | Date, hm: string, tz: TZ = DEFAULT_TIMEZONE): Date {
  const dayKey = localDayKey(value, tz);
  const { h, m } = parseHm(hm);
  return fromZonedTime(
    `${dayKey}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`,
    tz,
  );
}

/** Minutes since local midnight for a timestamp (0–1439). */
export function localMinuteOfDay(value: string | Date, tz: TZ = DEFAULT_TIMEZONE): number {
  const d = toDate(value);
  return Number(formatInTimeZone(d, tz, "H")) * 60 + Number(formatInTimeZone(d, tz, "m"));
}

export function minutesBetween(a: string | Date, b: string | Date): number {
  return differenceInMinutes(toDate(b), toDate(a));
}

/**
 * Is the local time of `value` inside the [start, end) window given as "HH:mm"?
 * Handles windows crossing midnight (e.g. 19:00 → 07:00).
 */
export function isInLocalWindow(
  value: string | Date,
  startHm: string,
  endHm: string,
  tz: TZ = DEFAULT_TIMEZONE,
): boolean {
  const minute = localMinuteOfDay(value, tz);
  const s = hmToMinutes(startHm);
  const e = hmToMinutes(endHm);
  if (s === e) return true;
  if (s < e) return minute >= s && minute < e;
  return minute >= s || minute < e;
}

/** Local "HH:mm" for a datetime-local input value (no timezone conversion). */
export function toDatetimeLocalValue(value: string | Date, tz: TZ = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(toDate(value), tz, "yyyy-MM-dd'T'HH:mm");
}

/** Convert a datetime-local input string (family local time) to a UTC ISO string. */
export function fromDatetimeLocalValue(local: string, tz: TZ = DEFAULT_TIMEZONE): string {
  return fromZonedTime(local, tz).toISOString();
}

export function roundToMinutes(value: Date, step: number): Date {
  const ms = step * 60_000;
  return new Date(Math.round(value.getTime() / ms) * ms);
}

export function floorToMinutes(value: Date, step: number): Date {
  const ms = step * 60_000;
  return new Date(Math.floor(value.getTime() / ms) * ms);
}

export function addMinutes(value: string | Date, minutes: number): Date {
  return new Date(toDate(value).getTime() + minutes * 60_000);
}

export function clampDate(value: Date, min: Date, max: Date): Date {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
