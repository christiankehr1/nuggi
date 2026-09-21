import { NextResponse } from "next/server";
import { APP_NAME } from "@/config";

export const dynamic = "force-dynamic";

/** Daily health ping (Vercel cron fallback) and uptime check. No secrets, no data. */
export function GET(): Response {
  return NextResponse.json({ ok: true, app: APP_NAME, at: new Date().toISOString() });
}
