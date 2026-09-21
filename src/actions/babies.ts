"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { de } from "@/i18n/de";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireSession } from "@/lib/auth";
import { createBaby, deleteBaby, getBaby, updateBaby } from "@/lib/db/babies";
import { BABY_COOKIE } from "@/lib/selected-baby";
import { DEFAULT_BABY_SETTINGS, type Baby } from "@/lib/types";
import { babySettingsSchema, isoDate, sex, uuid } from "@/lib/validation";

function revalidateAll() {
  revalidatePath("/", "layout");
}

const babySchema = z.object({
  name: z.string().trim().min(1).max(40),
  birthDate: isoDate,
  sex: sex.nullable(),
  settings: babySettingsSchema.partial().optional(),
});

export async function createBabyAction(input: unknown): Promise<ActionResult<Baby>> {
  const scope = await requireSession();
  const parsed = babySchema.safeParse(input);
  if (!parsed.success) return fail(de.errors.validation, "validation");
  const v = parsed.data;
  const baby = await createBaby(scope, {
    name: v.name,
    birthDate: v.birthDate,
    sex: v.sex,
    settings: {
      ...DEFAULT_BABY_SETTINGS,
      ...(v.settings ?? {}),
      reminders: { ...DEFAULT_BABY_SETTINGS.reminders, ...(v.settings?.reminders ?? {}) },
    },
  });
  await selectBabyAction({ babyId: baby.id });
  revalidateAll();
  return ok(baby);
}

const updateSchema = babySchema.partial().extend({ id: uuid });

export async function updateBabyAction(input: unknown): Promise<ActionResult<Baby>> {
  const scope = await requireSession();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return fail(de.errors.validation, "validation");
  const { id, ...patch } = parsed.data;
  const existing = await getBaby(scope, id);
  if (!existing) return fail(de.errors.notFound, "not_found");
  await updateBaby(scope, id, {
    name: patch.name,
    birthDate: patch.birthDate,
    sex: patch.sex,
    settings: patch.settings
      ? {
          ...existing.settings,
          ...patch.settings,
          reminders: { ...existing.settings.reminders, ...(patch.settings.reminders ?? {}) },
        }
      : undefined,
  });
  revalidateAll();
  return ok((await getBaby(scope, id)) ?? existing);
}

export async function deleteBabyAction(input: unknown): Promise<ActionResult<undefined>> {
  const scope = await requireSession();
  const parsed = z.object({ id: uuid }).safeParse(input);
  if (!parsed.success) return fail(de.errors.validation, "validation");
  if (!(await getBaby(scope, parsed.data.id))) return fail(de.errors.notFound, "not_found");
  await deleteBaby(scope, parsed.data.id);
  revalidateAll();
  return ok(undefined);
}

/** Remember which baby the tabs show. The id is re-checked against the session's babies on read. */
export async function selectBabyAction(input: unknown): Promise<ActionResult<undefined>> {
  const scope = await requireSession();
  const parsed = z.object({ babyId: uuid }).safeParse(input);
  if (!parsed.success) return fail(de.errors.validation, "validation");
  if (!(await getBaby(scope, parsed.data.babyId))) return fail(de.errors.notFound, "not_found");
  const store = await cookies();
  store.set(BABY_COOKIE, parsed.data.babyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 365 * 24 * 3600,
  });
  revalidateAll();
  return ok(undefined);
}
