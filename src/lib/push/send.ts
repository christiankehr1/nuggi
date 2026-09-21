import "server-only";
import webpush, { WebPushError } from "web-push";
import { PUSH_MAX_FAILURES } from "@/config";
import { cronListSubscriptions, cronMarkFailure, cronMarkSuccess } from "@/lib/db/cron";
import { env, pushConfigured } from "@/lib/env";
import type { PushSubscriptionRow } from "@/lib/types";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

let configured = false;
function ensureVapid(): boolean {
  if (!pushConfigured()) return false;
  if (!configured) {
    const e = env();
    webpush.setVapidDetails(e.VAPID_SUBJECT!, e.VAPID_PUBLIC_KEY!, e.VAPID_PRIVATE_KEY!);
    configured = true;
  }
  return true;
}

export interface SendResult {
  sent: number;
  failed: number;
  removed: number;
}

/** Send one payload to a list of subscriptions, pruning dead endpoints after 3 failures. */
export async function sendToSubscriptions(subs: PushSubscriptionRow[], payload: PushPayload): Promise<SendResult> {
  const result: SendResult = { sent: 0, failed: 0, removed: 0 };
  if (!ensureVapid()) return result;
  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
          TTL: 60 * 30,
          urgency: "high",
        });
        result.sent += 1;
        await cronMarkSuccess(s.id);
      } catch (err) {
        result.failed += 1;
        const status = err instanceof WebPushError ? err.statusCode : 0;
        const gone = status === 404 || status === 410;
        const failures = gone ? s.failures + 1 : s.failures;
        const remove = gone && failures >= PUSH_MAX_FAILURES;
        if (remove) result.removed += 1;
        if (gone) await cronMarkFailure(s.id, failures, remove);
      }
    }),
  );
  return result;
}

/** Send to every device of a family. */
export async function sendToFamily(familyId: string, payload: PushPayload): Promise<SendResult> {
  const subs = await cronListSubscriptions(familyId);
  return sendToSubscriptions(subs, payload);
}
