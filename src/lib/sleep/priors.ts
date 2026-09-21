/**
 * Age-based priors for sleep prediction. Values in minutes unless noted.
 * Brackets are expressed in completed weeks (1 month ≈ 4.35 weeks).
 */
export interface AgePrior {
  label: string;
  /** inclusive lower bound in completed weeks */
  fromWeeks: number;
  windowMin: number;
  windowMax: number;
  napsMin: number;
  napsMax: number;
  napLength: number;
  totalSleepMinH: number;
  totalSleepMaxH: number;
}

export const AGE_PRIORS: AgePrior[] = [
  { label: "0–4 Wochen", fromWeeks: 0, windowMin: 35, windowMax: 60, napsMin: 4, napsMax: 6, napLength: 40, totalSleepMinH: 15, totalSleepMaxH: 17 },
  { label: "5–12 Wochen", fromWeeks: 5, windowMin: 60, windowMax: 90, napsMin: 4, napsMax: 5, napLength: 45, totalSleepMinH: 14, totalSleepMaxH: 16 },
  { label: "3–4 Monate", fromWeeks: 13, windowMin: 75, windowMax: 120, napsMin: 3, napsMax: 4, napLength: 45, totalSleepMinH: 14, totalSleepMaxH: 15 },
  { label: "5–6 Monate", fromWeeks: 22, windowMin: 120, windowMax: 150, napsMin: 3, napsMax: 3, napLength: 60, totalSleepMinH: 13, totalSleepMaxH: 14 },
  { label: "7–9 Monate", fromWeeks: 31, windowMin: 150, windowMax: 210, napsMin: 2, napsMax: 3, napLength: 75, totalSleepMinH: 13, totalSleepMaxH: 14 },
  { label: "10–12 Monate", fromWeeks: 44, windowMin: 180, windowMax: 240, napsMin: 2, napsMax: 2, napLength: 75, totalSleepMinH: 12, totalSleepMaxH: 14 },
  { label: "13–18 Monate", fromWeeks: 57, windowMin: 240, windowMax: 330, napsMin: 1, napsMax: 2, napLength: 90, totalSleepMinH: 12, totalSleepMaxH: 13 },
  { label: "ab 19 Monaten", fromWeeks: 83, windowMin: 300, windowMax: 360, napsMin: 1, napsMax: 1, napLength: 100, totalSleepMinH: 11, totalSleepMaxH: 13 },
];

export function priorForWeeks(weeks: number): AgePrior {
  let current = AGE_PRIORS[0]!;
  for (const p of AGE_PRIORS) {
    if (weeks >= p.fromWeeks) current = p;
  }
  return current;
}

export function windowMidpoint(p: AgePrior): number {
  return (p.windowMin + p.windowMax) / 2;
}

/** Expected daytime sleep per day = average naps × nap length. */
export function expectedDaytimeSleep(p: AgePrior): number {
  return ((p.napsMin + p.napsMax) / 2) * p.napLength;
}

/** Default feed interval by age (minutes). */
export function defaultFeedInterval(weeks: number): number {
  if (weeks <= 4) return 150;
  if (weeks <= 12) return 180;
  if (weeks <= 30) return 210;
  return 240;
}

/** Position multipliers across the day. */
export const WINDOW_FACTOR_FIRST = 0.9;
export const WINDOW_FACTOR_MID = 1.0;
export const WINDOW_FACTOR_LAST = 1.1;
