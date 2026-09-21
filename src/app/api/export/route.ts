import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listBabies } from "@/lib/db/babies";
import { listAllEvents } from "@/lib/db/events";
import { getFamily } from "@/lib/db/families";
import { listAllMeasurements } from "@/lib/db/measurements";
import { eventsCsv, measurementsCsv } from "@/lib/csv";
import { DEFAULT_TIMEZONE } from "@/config";

export const dynamic = "force-dynamic";

/**
 * GET /api/export?type=events|measurements
 * CSV of this family's data. Family comes from the session cookie only.
 */
export async function GET(request: Request): Promise<Response> {
  const scope = await getSession();
  if (!scope) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const type = new URL(request.url).searchParams.get("type") === "measurements" ? "measurements" : "events";

  const [family, babies] = await Promise.all([getFamily(scope), listBabies(scope)]);
  const tz = family?.timezone ?? DEFAULT_TIMEZONE;
  const csv =
    type === "events"
      ? eventsCsv(await listAllEvents(scope), babies, tz)
      : measurementsCsv(await listAllMeasurements(scope), babies, tz);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nuggi-${type}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
