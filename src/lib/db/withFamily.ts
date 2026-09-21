import "server-only";
import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";

/**
 * The only way to obtain a FamilyScope is `requireSession()` in `src/lib/auth.ts`,
 * which reads the signed cookie. Data functions accept a scope, never a raw
 * family id, so the client can never choose whose data it touches.
 * `tests/isolation.test.ts` enforces this by scanning the source.
 */
export interface FamilyScope {
  readonly familyId: string;
  readonly memberId: string;
}

/** Apply the family filter to a select/update/delete builder. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withFamily<Q extends PostgrestFilterBuilder<any, any, any, any, any, any, any>>(
  query: Q,
  scope: FamilyScope,
): Q {
  return query.eq("family_id", scope.familyId) as Q;
}

/** Stamp an insert payload with the family id from the session. */
export function ownedBy<T extends Record<string, unknown>>(
  scope: FamilyScope,
  row: T,
): T & { family_id: string } {
  return { ...row, family_id: scope.familyId };
}
