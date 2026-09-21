"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { de } from "@/i18n/de";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireSession } from "@/lib/auth";
import { getBaby } from "@/lib/db/babies";
import { listMembers } from "@/lib/db/families";
import {
  deleteEvent,
  getEvent,
  insertEvent,
  listRunning,
  restoreEvent,
  updateEvent,
} from "@/lib/db/events";
import type { BabyEvent } from "@/lib/types";
import { amountMl, feedSubtype, isoDateTime, note, side, sleepSubtype, uuid } from "@/lib/validation";

/**
 * Event actions take plain JSON (not FormData) so the offline outbox can
 * queue and replay them. Every action derives the family from the session.
 */

function revalidateAll() {
  revalidatePath("/heute");
  revalidatePath("/verlauf");
  revalidatePath("/statistik");
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

function message(err: unknown): string {
  if (isUniqueViolation(err)) return de.events.alreadyRunning(de.events.runningSleep);
  return de.common.error;
}

// ---------------------------------------------------------------------------
// Start sleep (running timer)
// ---------------------------------------------------------------------------
const startSleepSchema = z.object({
  babyId: uuid,
  subtype: sleepSubtype,
  startedAt: isoDateTime,
});

export async function startSleepAction(input: unknown): Promise<ActionResult<BabyEvent>> {
  const scope = await requireSession();
  const parsed = startSleepSchema.safeParse(input);
  if (!parsed.success) return fail(de.errors.validation, "validation");
  const { babyId, subtype, startedAt } = parsed.data;
  if (!(await getBaby(scope, babyId))) return fail(de.errors.notFound, "not_found");
  const running = (await listRunning(scope, babyId)).find((e) => e.kind === "sleep");
  if (running) return fail(de.events.alreadyRunning(de.events.runningSleep), "conflict");
  try {
    const event = await insertEvent(scope, {
      babyId,
      kind: "sleep",
      subtype,
      startedAt,
      endedAt: null,
      amountMl: null,
      side: null,
      note: null,
    });
    revalidateAll();
    return ok(event);
  } catch (err) {
    return fail(message(err), isUniqueViolation(err) ? "conflict" : "unknown");
  }
}

// ---------------------------------------------------------------------------
// Start breast feed (running timer)
// ---------------------------------------------------------------------------
const startFeedSchema = z.object({
  babyId: uuid,
  side: side,
  startedAt: isoDateTime,
});

export async function startBreastFeedAction(input: unknown): Promise<ActionResult<BabyEvent>> {
  const scope = await requireSession();
  const parsed = startFeedSchema.safeParse(input);
  if (!parsed.success) return fail(de.errors.validation, "validation");
  const { babyId, side: s, startedAt } = parsed.data;
  if (!(await getBaby(scope, babyId))) return fail(de.errors.notFound, "not_found");
  const running = (await listRunning(scope, babyId)).find((e) => e.kind === "feed");
  if (running) return fail(de.events.alreadyRunning(de.events.runningFeed), "conflict");
  try {
    const event = await insertEvent(scope, {
      babyId,
      kind: "feed",
      subtype: "breast",
      startedAt,
      endedAt: null,
      amountMl: null,
      side: s,
      note: null,
    });
    revalidateAll();
    return ok(event);
  } catch (err) {
    return fail(
      isUniqueViolation(err) ? de.events.alreadyRunning(de.events.runningFeed) : de.common.error,
      isUniqueViolation(err) ? "conflict" : "unknown",
    );
  }
}

// ---------------------------------------------------------------------------
// End the running sleep / feed
// ---------------------------------------------------------------------------
const endRunningSchema = z.object({
  babyId: uuid,
  kind: z.enum(["sleep", "feed"]),
  endedAt: isoDateTime,
});

export async function endRunningAction(input: unknown): Promise<ActionResult<BabyEvent | null>> {
  const scope = await requireSession();
  const parsed = endRunningSchema.safeParse(input);
  if (!parsed.success) return fail(de.errors.validation, "validation");
  const { babyId, kind, endedAt } = parsed.data;
  const running = (await listRunning(scope, babyId)).find((e) => e.kind === kind);
  if (!running) {
    revalidateAll();
    return ok(null);
  }
  const end = endedAt < running.startedAt ? running.startedAt : endedAt;
  await updateEvent(scope, running.id, { endedAt: end });
  revalidateAll();
  return ok({ ...running, endedAt: end });
}

// ---------------------------------------------------------------------------
// Log a complete feed (bottle / solids / breast with known end)
// ---------------------------------------------------------------------------
const logFeedSchema = z
  .object({
    babyId: uuid,
    subtype: feedSubtype,
    startedAt: isoDateTime,
    endedAt: isoDateTime.nullable().optional(),
    amountMl: amountMl.nullable().optional(),
    side: side.nullable().optional(),
    note: note.nullable().optional(),
  })
  .refine((v) => !v.endedAt || v.endedAt >= v.startedAt, { message: de.events.endBeforeStart });

export async function logFeedAction(input: unknown): Promise<ActionResult<BabyEvent>> {
  const scope = await requireSession();
  const parsed = logFeedSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? de.errors.validation, "validation");
  const v = parsed.data;
  if (!(await getBaby(scope, v.babyId))) return fail(de.errors.notFound, "not_found");
  try {
    const event = await insertEvent(scope, {
      babyId: v.babyId,
      kind: "feed",
      subtype: v.subtype,
      startedAt: v.startedAt,
      // instant events (bottle/solids) end when they start
      endedAt: v.endedAt ?? v.startedAt,
      amountMl: v.subtype === "bottle" ? (v.amountMl ?? null) : null,
      side: v.subtype === "breast" ? (v.side ?? null) : null,
      note: v.note || null,
    });
    revalidateAll();
    return ok(event);
  } catch (err) {
    return fail(message(err));
  }
}

// ---------------------------------------------------------------------------
// Manual past event (any kind) from Verlauf "+"
// ---------------------------------------------------------------------------
const createEventSchema = z
  .object({
    babyId: uuid,
    kind: z.enum(["sleep", "feed"]),
    subtype: z.union([sleepSubtype, feedSubtype]),
    startedAt: isoDateTime,
    endedAt: isoDateTime.nullable(),
    amountMl: amountMl.nullable().optional(),
    side: side.nullable().optional(),
    note: note.nullable().optional(),
  })
  .refine((v) => (v.kind === "sleep" ? ["nap", "night"] : ["breast", "bottle", "solids"]).includes(v.subtype), {
    message: de.errors.validation,
  })
  .refine((v) => !v.endedAt || v.endedAt >= v.startedAt, { message: de.events.endBeforeStart });

export async function createEventAction(input: unknown): Promise<ActionResult<BabyEvent>> {
  const scope = await requireSession();
  const parsed = createEventSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? de.errors.validation, "validation");
  const v = parsed.data;
  if (!(await getBaby(scope, v.babyId))) return fail(de.errors.notFound, "not_found");
  try {
    const event = await insertEvent(scope, {
      babyId: v.babyId,
      kind: v.kind,
      subtype: v.subtype,
      startedAt: v.startedAt,
      endedAt: v.endedAt,
      amountMl: v.subtype === "bottle" ? (v.amountMl ?? null) : null,
      side: v.subtype === "breast" ? (v.side ?? null) : null,
      note: v.note || null,
    });
    revalidateAll();
    return ok(event);
  } catch (err) {
    return fail(message(err), isUniqueViolation(err) ? "conflict" : "unknown");
  }
}

// ---------------------------------------------------------------------------
// Edit
// ---------------------------------------------------------------------------
const updateEventSchema = z
  .object({
    id: uuid,
    subtype: z.union([sleepSubtype, feedSubtype]).optional(),
    startedAt: isoDateTime.optional(),
    endedAt: isoDateTime.nullable().optional(),
    amountMl: amountMl.nullable().optional(),
    side: side.nullable().optional(),
    note: note.nullable().optional(),
  })
  .refine((v) => !v.startedAt || !v.endedAt || v.endedAt >= v.startedAt, {
    message: de.events.endBeforeStart,
  });

export async function updateEventAction(input: unknown): Promise<ActionResult<BabyEvent>> {
  const scope = await requireSession();
  const parsed = updateEventSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? de.errors.validation, "validation");
  const { id, ...patch } = parsed.data;
  const existing = await getEvent(scope, id);
  if (!existing) return fail(de.errors.notFound, "not_found");
  const validSubtypes = existing.kind === "sleep" ? ["nap", "night"] : ["breast", "bottle", "solids"];
  if (patch.subtype && !validSubtypes.includes(patch.subtype)) return fail(de.errors.validation, "validation");
  const start = patch.startedAt ?? existing.startedAt;
  const end = patch.endedAt === undefined ? existing.endedAt : patch.endedAt;
  if (end && end < start) return fail(de.events.endBeforeStart, "validation");
  try {
    await updateEvent(scope, id, {
      subtype: patch.subtype,
      startedAt: patch.startedAt,
      endedAt: patch.endedAt,
      amountMl: patch.amountMl,
      side: patch.side,
      note: patch.note === undefined ? undefined : patch.note || null,
    });
    revalidateAll();
    const updated = await getEvent(scope, id);
    return ok(updated ?? existing);
  } catch (err) {
    return fail(message(err), isUniqueViolation(err) ? "conflict" : "unknown");
  }
}

// ---------------------------------------------------------------------------
// Delete + undo
// ---------------------------------------------------------------------------
export async function deleteEventAction(input: unknown): Promise<ActionResult<BabyEvent>> {
  const scope = await requireSession();
  const parsed = z.object({ id: uuid }).safeParse(input);
  if (!parsed.success) return fail(de.errors.validation, "validation");
  const existing = await getEvent(scope, parsed.data.id);
  if (!existing) return fail(de.errors.notFound, "not_found");
  await deleteEvent(scope, existing.id);
  revalidateAll();
  return ok(existing);
}

const restoreSchema = z.object({
  id: uuid,
  babyId: uuid,
  memberId: uuid.nullable(),
  kind: z.enum(["sleep", "feed"]),
  subtype: z.union([sleepSubtype, feedSubtype]),
  startedAt: isoDateTime,
  endedAt: isoDateTime.nullable(),
  amountMl: amountMl.nullable(),
  side: side.nullable(),
  note: note.nullable(),
  createdAt: isoDateTime,
});

export async function restoreEventAction(input: unknown): Promise<ActionResult<undefined>> {
  const scope = await requireSession();
  const parsed = restoreSchema.safeParse(input);
  if (!parsed.success) return fail(de.errors.validation, "validation");
  const v = parsed.data;
  if (!(await getBaby(scope, v.babyId))) return fail(de.errors.notFound, "not_found");
  // Only keep the original author if they belong to this family.
  const members = await listMembers(scope);
  const memberId = members.some((m) => m.id === v.memberId) ? v.memberId : scope.memberId;
  try {
    await restoreEvent(scope, {
      ...v,
      memberId,
      familyId: scope.familyId,
      updatedAt: new Date().toISOString(),
    });
    revalidateAll();
    return ok(undefined);
  } catch (err) {
    return fail(message(err), isUniqueViolation(err) ? "conflict" : "unknown");
  }
}
