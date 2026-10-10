import "server-only";
import { db } from "@/lib/db/client";
import { codePrefix, verifyFamilyCode } from "@/lib/family-code";
import type { DailyReminder, Family, Member } from "@/lib/types";

/**
 * Login-time queries. This is the ONLY data module that works with a raw
 * family id, because at login there is no session yet: the family id comes
 * from verifying the code hash, never from the client.
 * `tests/isolation.test.ts` asserts that only `src/actions/auth.ts` imports it.
 */

interface FamilyRow {
  id: string;
  name: string;
  code_prefix: string;
  code_hash: string;
  timezone: string;
  daily_reminders: unknown;
  created_at: string;
}

export const FAMILY_COLUMNS = "id,name,timezone,daily_reminders,created_at";

/** Tolerant parse of the JSON column: unknown shapes are dropped, never thrown. */
export function normalizeDailyReminders(raw: unknown): DailyReminder[] {
  if (!Array.isArray(raw)) return [];
  const out: DailyReminder[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.name !== "string" || typeof r.time !== "string") continue;
    out.push({
      id: r.id,
      name: r.name,
      time: r.time,
      enabled: r.enabled !== false,
      push: r.push !== false,
      inApp: r.inApp !== false,
    });
  }
  return out;
}

export function mapFamily(row: Pick<FamilyRow, "id" | "name" | "timezone" | "created_at"> & { daily_reminders?: unknown }): Family {
  return {
    id: row.id,
    name: row.name,
    timezone: row.timezone,
    dailyReminders: normalizeDailyReminders(row.daily_reminders),
    createdAt: row.created_at,
  };
}

/** Find the family whose bcrypt hash matches the (normalised) code. */
export async function findFamilyByCode(code: string): Promise<Family | null> {
  const { data, error } = await db()
    .from("families")
    .select(`code_prefix,code_hash,${FAMILY_COLUMNS}`)
    .eq("code_prefix", codePrefix(code));
  if (error) throw error;
  for (const row of (data ?? []) as FamilyRow[]) {
    if (await verifyFamilyCode(code, row.code_hash)) return mapFamily(row);
  }
  return null;
}

interface MemberRow {
  id: string;
  family_id: string;
  name: string;
  last_seen_at: string | null;
  created_at: string;
}

export function mapMember(row: MemberRow): Member {
  return {
    id: row.id,
    familyId: row.family_id,
    name: row.name,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
  };
}

/** Reuse the member with this name (case-insensitive) or create it. */
export async function findOrCreateMemberForLogin(
  verifiedFamilyId: string,
  name: string,
): Promise<Member> {
  const client = db();
  const { data: existing, error } = await client
    .from("members")
    .select("id,family_id,name,last_seen_at,created_at")
    .eq("family_id", verifiedFamilyId)
    .ilike("name", name);
  if (error) throw error;
  const found = (existing ?? []).find(
    (m: MemberRow) => m.name.toLowerCase() === name.toLowerCase(),
  ) as MemberRow | undefined;
  const now = new Date().toISOString();
  if (found) {
    await client.from("members").update({ last_seen_at: now }).eq("id", found.id);
    return mapMember({ ...found, last_seen_at: now });
  }
  const { data: created, error: insertError } = await client
    .from("members")
    .insert({ family_id: verifiedFamilyId, name, last_seen_at: now })
    .select("id,family_id,name,last_seen_at,created_at")
    .single();
  if (insertError) throw insertError;
  return mapMember(created as MemberRow);
}
