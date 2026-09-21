import { NextResponse } from "next/server";
import { ageInWeeks } from "@/lib/age";
import { cronClaimReminder, cronListBabies, cronListEvents, cronPruneReminders } from "@/lib/db/cron";
import { env, pushConfigured } from "@/lib/env";
import { dueReminders } from "@/lib/push/reminders";
import { sendToFamily } from "@/lib/push/send";
import { predict } from "@/lib/sleep/predict";
import { addLocalDays, startOfLocalDay } from "@/lib/time";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/cron/reminders  (Authorization: Bearer CRON_SECRET)
 * Runs every 5 minutes (cron-job.org / pg_cron). For every baby with reminders
 * enabled: predict, find reminders due in [now − 5, now + 5] min, claim the
 * dedupe key, send to all of the family's devices.
 */
function authorized(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const secret = env().CRON_SECRET;
  if (token.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

async function run(request: Request): Promise<Response> {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ ok: true, skipped: "push not configured" });

  const now = new Date();
  const stats = { babies: 0, due: 0, sent: 0, failed: 0, removed: 0 };
  const babies = await cronListBabies();
  for (const { baby, timezone } of babies) {
    const r = baby.settings.reminders;
    if (!r.nap && !r.feed && !r.bedtime) continue;
    stats.babies += 1;
    const since = addLocalDays(startOfLocalDay(now, timezone), -14, timezone);
    const events = await cronListEvents(baby.familyId, baby.id, since);
    const prediction = predict({ baby, events, now, tz: timezone });
    const due = dueReminders({
      babyId: baby.id,
      babyName: baby.name,
      ageWeeks: ageInWeeks(baby.birthDate, now, timezone),
      settings: baby.settings,
      prediction,
      now,
      tz: timezone,
    });
    for (const d of due) {
      const claimed = await cronClaimReminder({ familyId: baby.familyId, babyId: baby.id, kind: d.kind, dedupeKey: d.dedupeKey });
      if (!claimed) continue;
      stats.due += 1;
      const res = await sendToFamily(baby.familyId, { title: d.title, body: d.body, url: d.url, tag: `nuggi-${d.kind}` });
      stats.sent += res.sent;
      stats.failed += res.failed;
      stats.removed += res.removed;
    }
  }
  // keep the dedupe table small
  await cronPruneReminders(new Date(now.getTime() - 3 * 86_400_000));
  return NextResponse.json({ ok: true, at: now.toISOString(), ...stats });
}

export async function POST(request: Request): Promise<Response> {
  return run(request);
}

/** GET is accepted too so simple cron services (and Vercel Cron) can call it. */
export async function GET(request: Request): Promise<Response> {
  return run(request);
}
