import "server-only";
import { db } from "@/lib/db/client";
import { mapBaby } from "@/lib/db/babies";
import { mapEvent } from "@/lib/db/events";
import { mapSubscription } from "@/lib/db/push";
import type { Baby, BabyEvent, PushSubscriptionRow } from "@/lib/types";

/**
 * Cross-family queries for the reminder scheduler. Only the cron route and
 * the push sender may import this (enforced by tests/isolation.test.ts).
 * The scheduler never renders anything to a user; it only sends each family
 * its own babies' reminders.
 */

export interface BabyWithFamily {
  baby: Baby;
  timezone: string;
}

export async function cronListBabies(): Promise<BabyWithFamily[]> {
  const { data, error } = await db()
    .from("babies")
    .select("id,family_id,name,birth_date,sex,settings,created_at,families(timezone)");
  if (error) throw error;
  type Row = Parameters<typeof mapBaby>[0] & { families: { timezone: string } | { timezone: string }[] | null };
  return ((data ?? []) as Row[]).map((row) => {
    const fam = Array.isArray(row.families) ? row.families[0] : row.families;
    return { baby: mapBaby(row), timezone: fam?.timezone ?? "Europe/Zurich" };
  });
}

export async function cronListEvents(familyId: string, babyId: string, since: Date): Promise<BabyEvent[]> {
  const { data, error } = await db()
    .from("events")
    .select("id,family_id,baby_id,member_id,kind,subtype,started_at,ended_at,amount_ml,side,note,created_at,updated_at")
    .eq("family_id", familyId)
    .eq("baby_id", babyId)
    .or(`ended_at.is.null,ended_at.gte.${since.toISOString()}`)
    .order("started_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapEvent);
}

export async function cronListSubscriptions(familyId: string): Promise<PushSubscriptionRow[]> {
  const { data, error } = await db()
    .from("push_subscriptions")
    .select("id,family_id,member_id,endpoint,p256dh,auth,user_agent,created_at,last_success_at,failures")
    .eq("family_id", familyId);
  if (error) throw error;
  return (data ?? []).map(mapSubscription);
}

/** Returns false when the dedupe key already exists (reminder was sent). */
export async function cronClaimReminder(input: {
  familyId: string;
  babyId: string;
  kind: string;
  dedupeKey: string;
}): Promise<boolean> {
  const { error } = await db().from("reminders_sent").insert({
    family_id: input.familyId,
    baby_id: input.babyId,
    kind: input.kind,
    dedupe_key: input.dedupeKey,
  });
  if (error) {
    if (error.code === "23505") return false;
    throw error;
  }
  return true;
}

export async function cronMarkSuccess(id: string): Promise<void> {
  await db().from("push_subscriptions").update({ failures: 0, last_success_at: new Date().toISOString() }).eq("id", id);
}

export async function cronMarkFailure(id: string, failures: number, remove: boolean): Promise<void> {
  if (remove) await db().from("push_subscriptions").delete().eq("id", id);
  else await db().from("push_subscriptions").update({ failures }).eq("id", id);
}

/** Housekeeping: keep the dedupe table small. */
export async function cronPruneReminders(olderThan: Date): Promise<void> {
  await db().from("reminders_sent").delete().lt("sent_at", olderThan.toISOString());
}
