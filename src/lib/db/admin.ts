import "server-only";
import { db } from "@/lib/db/client";
import { mapFamily } from "@/lib/db/login";
import { generateFamilyCode, codePrefix, hashFamilyCode } from "@/lib/family-code";
import type { Family } from "@/lib/types";

/**
 * Admin-only queries (protected by ADMIN_SECRET). These intentionally see all
 * families. `tests/isolation.test.ts` asserts that only the admin page and
 * scripts import this module.
 */

export interface AdminFamilyRow extends Family {
  codePrefix: string;
  memberCount: number;
  babyCount: number;
  memberNames: string[];
  babyNames: string[];
}

export async function adminListFamilies(): Promise<AdminFamilyRow[]> {
  const { data, error } = await db()
    .from("families")
    .select("id,name,code_prefix,timezone,created_at,members(name),babies(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  type Row = {
    id: string;
    name: string;
    code_prefix: string;
    timezone: string;
    created_at: string;
    members: { name: string }[] | null;
    babies: { name: string }[] | null;
  };
  return ((data ?? []) as Row[]).map((row) => ({
    ...mapFamily(row),
    codePrefix: row.code_prefix,
    memberCount: row.members?.length ?? 0,
    babyCount: row.babies?.length ?? 0,
    memberNames: (row.members ?? []).map((m) => m.name),
    babyNames: (row.babies ?? []).map((b) => b.name),
  }));
}

/** Create a family with a fresh code. The plaintext code is returned exactly once. */
export async function adminCreateFamily(
  name: string,
  timezone = "Europe/Zurich",
): Promise<{ family: Family; code: string }> {
  // Retry on the (astronomically unlikely) prefix+hash collision path.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateFamilyCode();
    const { data, error } = await db()
      .from("families")
      .insert({
        name,
        code_prefix: codePrefix(code),
        code_hash: await hashFamilyCode(code),
        timezone,
      })
      .select("id,name,timezone,created_at")
      .single();
    if (error) {
      if (attempt === 2) throw error;
      continue;
    }
    return { family: mapFamily(data), code };
  }
  throw new Error("Konnte keine Familie anlegen");
}

export async function adminDeleteFamily(id: string): Promise<void> {
  const { error } = await db().from("families").delete().eq("id", id);
  if (error) throw error;
}
