import { differenceInCalendarDays, differenceInCalendarMonths } from "date-fns";
import { de } from "@/i18n/de";
import { dayKeyToDate, localDayKey } from "@/lib/time";

/** Age in completed days on the local day containing `now`. */
export function ageInDays(birthDate: string, now: Date, tz?: string): number {
  const today = dayKeyToDate(localDayKey(now, tz), tz);
  const birth = dayKeyToDate(birthDate, tz);
  return Math.max(0, differenceInCalendarDays(today, birth));
}

/** Age in completed weeks (0 for the first six days). */
export function ageInWeeks(birthDate: string, now: Date, tz?: string): number {
  return Math.floor(ageInDays(birthDate, now, tz) / 7);
}

export function ageInMonths(birthDate: string, now: Date, tz?: string): number {
  const today = dayKeyToDate(localDayKey(now, tz), tz);
  const birth = dayKeyToDate(birthDate, tz);
  return Math.max(0, differenceInCalendarMonths(today, birth));
}

/** "14 Wochen" / "5 Monate" / "3 Tage" */
export function ageLabel(birthDate: string, now: Date, tz?: string): string {
  const days = ageInDays(birthDate, now, tz);
  if (days < 14) return de.today.ageDays(days);
  const weeks = Math.floor(days / 7);
  if (weeks < 26) return de.today.ageWeeks(weeks);
  return de.today.ageMonths(ageInMonths(birthDate, now, tz));
}
