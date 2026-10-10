import "server-only";
import { db } from "@/lib/db/client";
import { withFamily, type FamilyScope } from "@/lib/db/withFamily";
import { FAMILY_COLUMNS, mapFamily, mapMember } from "@/lib/db/login";
import type { DailyReminder, Family, Member } from "@/lib/types";

export async function getFamily(scope: FamilyScope): Promise<Family | null> {
  const { data, error } = await db()
    .from("families")
    .select(FAMILY_COLUMNS)
    .eq("id", scope.familyId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapFamily(data) : null;
}

export async function updateFamily(
  scope: FamilyScope,
  patch: { name?: string; timezone?: string; dailyReminders?: DailyReminder[] },
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.timezone !== undefined) row.timezone = patch.timezone;
  if (patch.dailyReminders !== undefined) row.daily_reminders = patch.dailyReminders;
  const { error } = await db().from("families").update(row).eq("id", scope.familyId);
  if (error) throw error;
}

export async function listMembers(scope: FamilyScope): Promise<Member[]> {
  const { data, error } = await withFamily(
    db().from("members").select("id,family_id,name,last_seen_at,created_at"),
    scope,
  ).order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapMember);
}

export async function getMember(scope: FamilyScope): Promise<Member | null> {
  const { data, error } = await withFamily(
    db().from("members").select("id,family_id,name,last_seen_at,created_at"),
    scope,
  )
    .eq("id", scope.memberId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapMember(data) : null;
}

export async function renameMember(scope: FamilyScope, name: string): Promise<void> {
  const { error } = await withFamily(db().from("members").update({ name }), scope).eq(
    "id",
    scope.memberId,
  );
  if (error) throw error;
}

export async function touchMember(scope: FamilyScope): Promise<void> {
  await withFamily(
    db().from("members").update({ last_seen_at: new Date().toISOString() }),
    scope,
  ).eq("id", scope.memberId);
}
