import "server-only";
import { cookies } from "next/headers";
import type { FamilyScope } from "@/lib/db/withFamily";
import { listBabies } from "@/lib/db/babies";
import { getFamily } from "@/lib/db/families";
import type { Baby, Family } from "@/lib/types";
import { DEFAULT_TIMEZONE } from "@/config";

export const BABY_COOKIE = "nuggi_baby";

export interface BabyContext {
  family: Family;
  babies: Baby[];
  baby: Baby | null;
  tz: string;
}

/**
 * Resolve the family, its babies and the currently selected baby (cookie,
 * falling back to the first baby). The cookie only stores an id; it is always
 * matched against the session's own babies, so it cannot leak across families.
 */
export async function resolveBabyContext(scope: FamilyScope): Promise<BabyContext> {
  const [family, babies, store] = await Promise.all([getFamily(scope), listBabies(scope), cookies()]);
  const wanted = store.get(BABY_COOKIE)?.value;
  const baby = babies.find((b) => b.id === wanted) ?? babies[0] ?? null;
  const fam: Family = family ?? {
    id: scope.familyId,
    name: "",
    timezone: DEFAULT_TIMEZONE,
    createdAt: new Date().toISOString(),
  };
  return { family: fam, babies, baby, tz: fam.timezone || DEFAULT_TIMEZONE };
}
