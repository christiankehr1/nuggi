import { z } from "zod";

/** Shared Zod pieces for server-action input. */

export const uuid = z.string().uuid();

export const isoDateTime = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Ungültiger Zeitpunkt" })
  .transform((v) => new Date(v).toISOString());

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datum");

export const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ungültige Uhrzeit");

export const sleepSubtype = z.enum(["nap", "night"]);
export const feedSubtype = z.enum(["breast", "bottle", "solids"]);
export const side = z.enum(["L", "R", "both"]);
export const measurementKind = z.enum(["weight_g", "height_cm", "head_cm", "temp_c"]);
export const sex = z.enum(["f", "m"]);

export const amountMl = z.number().int().min(0).max(2000);
export const note = z.string().trim().max(500);

export const babySettingsSchema = z.object({
  napLeadMinutes: z.number().int().min(0).max(120),
  feedIntervalMinutes: z.number().int().min(30).max(720).nullable(),
  bedtimeTarget: hm,
  nightStart: hm,
  nightEnd: hm,
  reminders: z.object({ nap: z.boolean(), feed: z.boolean(), bedtime: z.boolean() }),
});

/** Plausibility ranges per measurement kind. */
export const MEASUREMENT_RANGES: Record<z.infer<typeof measurementKind>, [number, number]> = {
  weight_g: [500, 30000],
  height_cm: [30, 130],
  head_cm: [25, 60],
  temp_c: [34, 43],
};

export function measurementValueSchema(kind: z.infer<typeof measurementKind>) {
  const [min, max] = MEASUREMENT_RANGES[kind];
  return z.number().min(min).max(max);
}
