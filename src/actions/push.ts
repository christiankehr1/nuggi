"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { de } from "@/i18n/de";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireSession } from "@/lib/auth";
import { deleteSubscription, getSubscriptionByEndpoint, listFamilySubscriptions, upsertSubscription } from "@/lib/db/push";
import { pushConfigured } from "@/lib/env";
import { sendToSubscriptions } from "@/lib/push/send";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(10).max(500), auth: z.string().min(5).max(200) }),
});

export async function subscribePushAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const scope = await requireSession();
  if (!pushConfigured()) return fail(de.settings.remindersNotConfigured);
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return fail(de.errors.validation, "validation");
  const ua = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  const row = await upsertSubscription(scope, {
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    userAgent: ua,
  });
  return ok({ id: row.id });
}

export async function unsubscribePushAction(input: unknown): Promise<ActionResult<undefined>> {
  const scope = await requireSession();
  const parsed = z.object({ endpoint: z.string().url() }).safeParse(input);
  if (!parsed.success) return fail(de.errors.validation, "validation");
  await deleteSubscription(scope, parsed.data.endpoint);
  return ok(undefined);
}

/** Is this device's endpoint registered for the current family? */
export async function pushStatusAction(input: unknown): Promise<ActionResult<{ subscribed: boolean; configured: boolean }>> {
  const scope = await requireSession();
  const parsed = z.object({ endpoint: z.string().url().nullable() }).safeParse(input);
  if (!parsed.success) return fail(de.errors.validation, "validation");
  const configured = pushConfigured();
  if (!parsed.data.endpoint) return ok({ subscribed: false, configured });
  const row = await getSubscriptionByEndpoint(scope, parsed.data.endpoint);
  return ok({ subscribed: !!row, configured });
}

export async function sendTestPushAction(input: unknown): Promise<ActionResult<{ sent: number }>> {
  const scope = await requireSession();
  const parsed = z.object({ endpoint: z.string().url() }).safeParse(input);
  if (!parsed.success) return fail(de.errors.validation, "validation");
  const subs = (await listFamilySubscriptions(scope)).filter((s) => s.endpoint === parsed.data.endpoint);
  if (subs.length === 0) return fail(de.settings.remindersDisabled, "not_found");
  const res = await sendToSubscriptions(subs, { title: de.push.testTitle, body: de.push.testBody, url: "/heute", tag: "nuggi-test" });
  if (res.sent === 0) return fail(de.common.error);
  return ok({ sent: res.sent });
}
