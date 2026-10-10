"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { de } from "@/i18n/de";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireSession } from "@/lib/auth";
import { listMembers, renameMember, updateFamily } from "@/lib/db/families";
import { MAX_DAILY_REMINDERS } from "@/lib/types";
import { dailyReminderSchema } from "@/lib/validation";

export async function renameMemberAction(input: unknown): Promise<ActionResult<undefined>> {
  const scope = await requireSession();
  const parsed = z.object({ name: z.string().trim().min(1).max(40) }).safeParse(input);
  if (!parsed.success) return fail(de.errors.validation, "validation");
  const taken = (await listMembers(scope)).some(
    (m) => m.id !== scope.memberId && m.name.toLowerCase() === parsed.data.name.toLowerCase(),
  );
  if (taken) return fail(de.settings.nameTaken, "conflict");
  await renameMember(scope, parsed.data.name);
  revalidatePath("/", "layout");
  return ok(undefined);
}

export async function updateFamilyAction(input: unknown): Promise<ActionResult<undefined>> {
  const scope = await requireSession();
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(80).optional(),
      timezone: z.string().trim().min(3).max(64).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return fail(de.errors.validation, "validation");
  if (parsed.data.timezone) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: parsed.data.timezone });
    } catch {
      return fail(de.errors.validation, "validation");
    }
  }
  await updateFamily(scope, parsed.data);
  revalidatePath("/", "layout");
  return ok(undefined);
}

/** Replace the family's list of daily reminders (name + local time + channels). */
export async function saveDailyRemindersAction(input: unknown): Promise<ActionResult<undefined>> {
  const scope = await requireSession();
  const parsed = z.object({ reminders: z.array(dailyReminderSchema).max(MAX_DAILY_REMINDERS) }).safeParse(input);
  if (!parsed.success) {
    const tooMany = parsed.error.issues.some((i) => i.code === "too_big");
    return fail(tooMany ? de.settings.dailyReminderMax(MAX_DAILY_REMINDERS) : de.errors.validation, "validation");
  }
  const ids = new Set(parsed.data.reminders.map((r) => r.id));
  if (ids.size !== parsed.data.reminders.length) return fail(de.errors.validation, "validation");
  if (parsed.data.reminders.some((r) => !r.push && !r.inApp)) return fail(de.settings.dailyReminderChannelRequired, "validation");
  await updateFamily(scope, { dailyReminders: parsed.data.reminders });
  revalidatePath("/", "layout");
  return ok(undefined);
}
