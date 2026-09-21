import "server-only";
import { db } from "@/lib/db/client";
import { ownedBy, withFamily, type FamilyScope } from "@/lib/db/withFamily";
import type { BabyEvent, EventKind, EventSubtype, Side } from "@/lib/types";

interface EventRow {
  id: string;
  family_id: string;
  baby_id: string;
  member_id: string | null;
  kind: EventKind;
  subtype: EventSubtype;
  started_at: string;
  ended_at: string | null;
  amount_ml: number | null;
  side: Side | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  members?: { name: string } | { name: string }[] | null;
}

const COLUMNS =
  "id,family_id,baby_id,member_id,kind,subtype,started_at,ended_at,amount_ml,side,note,created_at,updated_at,members(name)";

function memberName(m: EventRow["members"]): string | null {
  if (!m) return null;
  if (Array.isArray(m)) return m[0]?.name ?? null;
  return m.name;
}

export function mapEvent(row: EventRow): BabyEvent {
  return {
    id: row.id,
    familyId: row.family_id,
    babyId: row.baby_id,
    memberId: row.member_id,
    kind: row.kind,
    subtype: row.subtype,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    amountMl: row.amount_ml,
    side: row.side,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    memberName: memberName(row.members),
  };
}

/** Events overlapping [from, to) – includes running events started before `to`. */
export async function listEventsBetween(
  scope: FamilyScope,
  babyId: string,
  from: Date,
  to: Date,
): Promise<BabyEvent[]> {
  const { data, error } = await withFamily(db().from("events").select(COLUMNS), scope)
    .eq("baby_id", babyId)
    .lt("started_at", to.toISOString())
    .or(`ended_at.is.null,ended_at.gte.${from.toISOString()}`)
    .order("started_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapEvent);
}

/** Newest-first page for the Verlauf list. */
export async function listEventsPage(
  scope: FamilyScope,
  babyId: string,
  before: Date,
  limit: number,
): Promise<BabyEvent[]> {
  const { data, error } = await withFamily(db().from("events").select(COLUMNS), scope)
    .eq("baby_id", babyId)
    .lt("started_at", before.toISOString())
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapEvent);
}

export async function getEvent(scope: FamilyScope, id: string): Promise<BabyEvent | null> {
  const { data, error } = await withFamily(db().from("events").select(COLUMNS), scope)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapEvent(data) : null;
}

export async function listRunning(scope: FamilyScope, babyId: string): Promise<BabyEvent[]> {
  const { data, error } = await withFamily(db().from("events").select(COLUMNS), scope)
    .eq("baby_id", babyId)
    .is("ended_at", null);
  if (error) throw error;
  return (data ?? []).map(mapEvent);
}

export interface EventInput {
  babyId: string;
  kind: EventKind;
  subtype: EventSubtype;
  startedAt: string;
  endedAt: string | null;
  amountMl: number | null;
  side: Side | null;
  note: string | null;
}

export async function insertEvent(scope: FamilyScope, input: EventInput): Promise<BabyEvent> {
  const { data, error } = await db()
    .from("events")
    .insert(
      ownedBy(scope, {
        baby_id: input.babyId,
        member_id: scope.memberId,
        kind: input.kind,
        subtype: input.subtype,
        started_at: input.startedAt,
        ended_at: input.endedAt,
        amount_ml: input.amountMl,
        side: input.side,
        note: input.note,
      }),
    )
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return mapEvent(data);
}

export async function updateEvent(
  scope: FamilyScope,
  id: string,
  patch: Partial<Omit<EventInput, "babyId">>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.kind !== undefined) row.kind = patch.kind;
  if (patch.subtype !== undefined) row.subtype = patch.subtype;
  if (patch.startedAt !== undefined) row.started_at = patch.startedAt;
  if (patch.endedAt !== undefined) row.ended_at = patch.endedAt;
  if (patch.amountMl !== undefined) row.amount_ml = patch.amountMl;
  if (patch.side !== undefined) row.side = patch.side;
  if (patch.note !== undefined) row.note = patch.note;
  const { error } = await withFamily(db().from("events").update(row), scope).eq("id", id);
  if (error) throw error;
}

export async function deleteEvent(scope: FamilyScope, id: string): Promise<void> {
  const { error } = await withFamily(db().from("events").delete(), scope).eq("id", id);
  if (error) throw error;
}

/** Everything for CSV export, oldest first. */
export async function listAllEvents(scope: FamilyScope): Promise<BabyEvent[]> {
  const { data, error } = await withFamily(db().from("events").select(COLUMNS), scope).order(
    "started_at",
    { ascending: true },
  );
  if (error) throw error;
  return (data ?? []).map(mapEvent);
}

/** Restore a deleted event (undo). Keeps the original id. */
export async function restoreEvent(scope: FamilyScope, event: BabyEvent): Promise<void> {
  const { error } = await db()
    .from("events")
    .insert(
      ownedBy(scope, {
        id: event.id,
        baby_id: event.babyId,
        member_id: event.memberId,
        kind: event.kind,
        subtype: event.subtype,
        started_at: event.startedAt,
        ended_at: event.endedAt,
        amount_ml: event.amountMl,
        side: event.side,
        note: event.note,
        created_at: event.createdAt,
      }),
    );
  if (error) throw error;
}
