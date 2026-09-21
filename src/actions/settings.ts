"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { de } from "@/i18n/de";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireSession } from "@/lib/auth";
import { listMembers, renameMember, updateFamily } from "@/lib/db/families";

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
