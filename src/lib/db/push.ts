import "server-only";
import { db } from "@/lib/db/client";
import { ownedBy, withFamily, type FamilyScope } from "@/lib/db/withFamily";
import type { PushSubscriptionRow } from "@/lib/types";

interface Row {
  id: string;
  family_id: string;
  member_id: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  last_success_at: string | null;
  failures: number;
}

const COLUMNS = "id,family_id,member_id,endpoint,p256dh,auth,user_agent,created_at,last_success_at,failures";

export function mapSubscription(row: Row): PushSubscriptionRow {
  return {
    id: row.id,
    familyId: row.family_id,
    memberId: row.member_id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    lastSuccessAt: row.last_success_at,
    failures: row.failures,
  };
}

export interface SubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
}

/**
 * Insert or take over a subscription. Endpoints are globally unique, so a
 * device that logs into another family moves its subscription to that family
 * via the upsert (family_id is always the session's).
 */
export async function upsertSubscription(scope: FamilyScope, input: SubscriptionInput): Promise<PushSubscriptionRow> {
  const { data, error } = await db()
    .from("push_subscriptions")
    .upsert(
      ownedBy(scope, {
        member_id: scope.memberId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        user_agent: input.userAgent,
        failures: 0,
      }),
      { onConflict: "endpoint" },
    )
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return mapSubscription(data);
}

export async function getSubscriptionByEndpoint(scope: FamilyScope, endpoint: string): Promise<PushSubscriptionRow | null> {
  const { data, error } = await withFamily(db().from("push_subscriptions").select(COLUMNS), scope)
    .eq("endpoint", endpoint)
    .maybeSingle();
  if (error) throw error;
  return data ? mapSubscription(data) : null;
}

export async function deleteSubscription(scope: FamilyScope, endpoint: string): Promise<void> {
  const { error } = await withFamily(db().from("push_subscriptions").delete(), scope).eq("endpoint", endpoint);
  if (error) throw error;
}

export async function listFamilySubscriptions(scope: FamilyScope): Promise<PushSubscriptionRow[]> {
  const { data, error } = await withFamily(db().from("push_subscriptions").select(COLUMNS), scope);
  if (error) throw error;
  return (data ?? []).map(mapSubscription);
}
