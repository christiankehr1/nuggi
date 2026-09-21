"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { de } from "@/i18n/de";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireSession } from "@/lib/auth";
import { getBaby } from "@/lib/db/babies";
import { listMembers } from "@/lib/db/families";
import {
  deleteMeasurement,
  getMeasurement,
  insertMeasurement,
  restoreMeasurement,
  updateMeasurement,
} from "@/lib/db/measurements";
import type { Measurement } from "@/lib/types";
import { isoDateTime, measurementKind, measurementValueSchema, note, uuid } from "@/lib/validation";

function revalidateAll() {
  revalidatePath("/heute");
  revalidatePath("/verlauf");
  revalidatePath("/statistik");
}

const createSchema = z.object({
  babyId: uuid,
  kind: measurementKind,
  value: z.number(),
  measuredAt: isoDateTime,
  note: note.nullable().optional(),
});

export async function createMeasurementAction(input: unknown): Promise<ActionResult<Measurement>> {
  const scope = await requireSession();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return fail(de.errors.validation, "validation");
  const v = parsed.data;
  if (!measurementValueSchema(v.kind).safeParse(v.value).success) {
    return fail(de.measurements.invalid, "validation");
  }
  if (!(await getBaby(scope, v.babyId))) return fail(de.errors.notFound, "not_found");
  const m = await insertMeasurement(scope, {
    babyId: v.babyId,
    kind: v.kind,
    value: v.value,
    measuredAt: v.measuredAt,
    note: v.note || null,
  });
  revalidateAll();
  return ok(m);
}

const updateSchema = z.object({
  id: uuid,
  kind: measurementKind.optional(),
  value: z.number().optional(),
  measuredAt: isoDateTime.optional(),
  note: note.nullable().optional(),
});

export async function updateMeasurementAction(input: unknown): Promise<ActionResult<Measurement>> {
  const scope = await requireSession();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return fail(de.errors.validation, "validation");
  const { id, ...patch } = parsed.data;
  const existing = await getMeasurement(scope, id);
  if (!existing) return fail(de.errors.notFound, "not_found");
  const kind = patch.kind ?? existing.kind;
  const value = patch.value ?? existing.value;
  if (!measurementValueSchema(kind).safeParse(value).success) {
    return fail(de.measurements.invalid, "validation");
  }
  await updateMeasurement(scope, id, {
    kind: patch.kind,
    value: patch.value,
    measuredAt: patch.measuredAt,
    note: patch.note === undefined ? undefined : patch.note || null,
  });
  revalidateAll();
  return ok((await getMeasurement(scope, id)) ?? existing);
}

export async function deleteMeasurementAction(input: unknown): Promise<ActionResult<Measurement>> {
  const scope = await requireSession();
  const parsed = z.object({ id: uuid }).safeParse(input);
  if (!parsed.success) return fail(de.errors.validation, "validation");
  const existing = await getMeasurement(scope, parsed.data.id);
  if (!existing) return fail(de.errors.notFound, "not_found");
  await deleteMeasurement(scope, existing.id);
  revalidateAll();
  return ok(existing);
}

const restoreSchema = z.object({
  id: uuid,
  babyId: uuid,
  memberId: uuid.nullable(),
  kind: measurementKind,
  value: z.number(),
  measuredAt: isoDateTime,
  note: note.nullable(),
  createdAt: isoDateTime,
});

export async function restoreMeasurementAction(input: unknown): Promise<ActionResult<undefined>> {
  const scope = await requireSession();
  const parsed = restoreSchema.safeParse(input);
  if (!parsed.success) return fail(de.errors.validation, "validation");
  const v = parsed.data;
  if (!(await getBaby(scope, v.babyId))) return fail(de.errors.notFound, "not_found");
  const members = await listMembers(scope);
  const memberId = members.some((m) => m.id === v.memberId) ? v.memberId : scope.memberId;
  await restoreMeasurement(scope, { ...v, memberId, familyId: scope.familyId });
  revalidateAll();
  return ok(undefined);
}
