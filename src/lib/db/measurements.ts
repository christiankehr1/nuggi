import "server-only";
import { db } from "@/lib/db/client";
import { ownedBy, withFamily, type FamilyScope } from "@/lib/db/withFamily";
import type { Measurement, MeasurementKind } from "@/lib/types";

interface MeasurementRow {
  id: string;
  family_id: string;
  baby_id: string;
  member_id: string | null;
  kind: MeasurementKind;
  value: number | string;
  measured_at: string;
  note: string | null;
  created_at: string;
  members?: { name: string } | { name: string }[] | null;
}

const COLUMNS =
  "id,family_id,baby_id,member_id,kind,value,measured_at,note,created_at,members(name)";

function memberName(m: MeasurementRow["members"]): string | null {
  if (!m) return null;
  if (Array.isArray(m)) return m[0]?.name ?? null;
  return m.name;
}

export function mapMeasurement(row: MeasurementRow): Measurement {
  return {
    id: row.id,
    familyId: row.family_id,
    babyId: row.baby_id,
    memberId: row.member_id,
    kind: row.kind,
    value: Number(row.value),
    measuredAt: row.measured_at,
    note: row.note,
    createdAt: row.created_at,
    memberName: memberName(row.members),
  };
}

export async function listMeasurements(
  scope: FamilyScope,
  babyId: string,
  opts: { kind?: MeasurementKind; from?: Date; to?: Date; limit?: number } = {},
): Promise<Measurement[]> {
  let q = withFamily(db().from("measurements").select(COLUMNS), scope).eq("baby_id", babyId);
  if (opts.kind) q = q.eq("kind", opts.kind);
  if (opts.from) q = q.gte("measured_at", opts.from.toISOString());
  if (opts.to) q = q.lt("measured_at", opts.to.toISOString());
  q = q.order("measured_at", { ascending: false });
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapMeasurement);
}

export async function getMeasurement(scope: FamilyScope, id: string): Promise<Measurement | null> {
  const { data, error } = await withFamily(db().from("measurements").select(COLUMNS), scope)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapMeasurement(data) : null;
}

export interface MeasurementInput {
  babyId: string;
  kind: MeasurementKind;
  value: number;
  measuredAt: string;
  note: string | null;
}

export async function insertMeasurement(
  scope: FamilyScope,
  input: MeasurementInput,
): Promise<Measurement> {
  const { data, error } = await db()
    .from("measurements")
    .insert(
      ownedBy(scope, {
        baby_id: input.babyId,
        member_id: scope.memberId,
        kind: input.kind,
        value: input.value,
        measured_at: input.measuredAt,
        note: input.note,
      }),
    )
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return mapMeasurement(data);
}

export async function updateMeasurement(
  scope: FamilyScope,
  id: string,
  patch: Partial<Omit<MeasurementInput, "babyId">>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.kind !== undefined) row.kind = patch.kind;
  if (patch.value !== undefined) row.value = patch.value;
  if (patch.measuredAt !== undefined) row.measured_at = patch.measuredAt;
  if (patch.note !== undefined) row.note = patch.note;
  const { error } = await withFamily(db().from("measurements").update(row), scope).eq("id", id);
  if (error) throw error;
}

export async function deleteMeasurement(scope: FamilyScope, id: string): Promise<void> {
  const { error } = await withFamily(db().from("measurements").delete(), scope).eq("id", id);
  if (error) throw error;
}

export async function restoreMeasurement(scope: FamilyScope, m: Measurement): Promise<void> {
  const { error } = await db()
    .from("measurements")
    .insert(
      ownedBy(scope, {
        id: m.id,
        baby_id: m.babyId,
        member_id: m.memberId,
        kind: m.kind,
        value: m.value,
        measured_at: m.measuredAt,
        note: m.note,
        created_at: m.createdAt,
      }),
    );
  if (error) throw error;
}

export async function listAllMeasurements(scope: FamilyScope): Promise<Measurement[]> {
  const { data, error } = await withFamily(db().from("measurements").select(COLUMNS), scope).order(
    "measured_at",
    { ascending: true },
  );
  if (error) throw error;
  return (data ?? []).map(mapMeasurement);
}
