import "server-only";
import { db } from "@/lib/db/client";
import { ownedBy, withFamily, type FamilyScope } from "@/lib/db/withFamily";
import { DEFAULT_BABY_SETTINGS, type Baby, type BabySettings, type Sex } from "@/lib/types";

interface BabyRow {
  id: string;
  family_id: string;
  name: string;
  birth_date: string;
  sex: Sex | null;
  settings: Partial<BabySettings> | null;
  created_at: string;
}

const COLUMNS = "id,family_id,name,birth_date,sex,settings,created_at";

export function normalizeSettings(raw: Partial<BabySettings> | null | undefined): BabySettings {
  return {
    ...DEFAULT_BABY_SETTINGS,
    ...(raw ?? {}),
    reminders: { ...DEFAULT_BABY_SETTINGS.reminders, ...(raw?.reminders ?? {}) },
  };
}

export function mapBaby(row: BabyRow): Baby {
  return {
    id: row.id,
    familyId: row.family_id,
    name: row.name,
    birthDate: row.birth_date,
    sex: row.sex,
    settings: normalizeSettings(row.settings),
    createdAt: row.created_at,
  };
}

export async function listBabies(scope: FamilyScope): Promise<Baby[]> {
  const { data, error } = await withFamily(db().from("babies").select(COLUMNS), scope).order(
    "created_at",
    { ascending: true },
  );
  if (error) throw error;
  return (data ?? []).map(mapBaby);
}

export async function getBaby(scope: FamilyScope, babyId: string): Promise<Baby | null> {
  const { data, error } = await withFamily(db().from("babies").select(COLUMNS), scope)
    .eq("id", babyId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapBaby(data) : null;
}

export interface BabyInput {
  name: string;
  birthDate: string;
  sex: Sex | null;
  settings: BabySettings;
}

export async function createBaby(scope: FamilyScope, input: BabyInput): Promise<Baby> {
  const { data, error } = await db()
    .from("babies")
    .insert(
      ownedBy(scope, {
        name: input.name,
        birth_date: input.birthDate,
        sex: input.sex,
        settings: input.settings,
      }),
    )
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return mapBaby(data);
}

export async function updateBaby(
  scope: FamilyScope,
  babyId: string,
  patch: Partial<BabyInput>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.birthDate !== undefined) row.birth_date = patch.birthDate;
  if (patch.sex !== undefined) row.sex = patch.sex;
  if (patch.settings !== undefined) row.settings = patch.settings;
  const { error } = await withFamily(db().from("babies").update(row), scope).eq("id", babyId);
  if (error) throw error;
}

export async function deleteBaby(scope: FamilyScope, babyId: string): Promise<void> {
  const { error } = await withFamily(db().from("babies").delete(), scope).eq("id", babyId);
  if (error) throw error;
}
