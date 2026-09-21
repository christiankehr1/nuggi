/**
 * Seeds a demo family (code printed) with one 4-month-old baby and 14 days of
 * data, plus a second family to prove isolation.
 *   npm run seed
 * Re-running removes previous demo families first (matched by name).
 */
import { format, subDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { codePrefix, generateFamilyCode, hashFamilyCode } from "../src/lib/family-code";
import { generateDemoEvents, generateDemoMeasurements } from "./lib/demo-data";
import { scriptClient } from "./lib/supabase";

const TZ = "Europe/Zurich";
const DEMO_NAME = "Demo-Familie Nuggi";
const OTHER_NAME = "Demo-Familie Zwei";

async function createFamily(name: string) {
  const supabase = scriptClient();
  const code = generateFamilyCode();
  const { data, error } = await supabase
    .from("families")
    .insert({ name, code_prefix: codePrefix(code), code_hash: await hashFamilyCode(code), timezone: TZ })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as string, code };
}

async function main() {
  const supabase = scriptClient();
  const now = new Date();

  // clean previous demo data
  await supabase.from("families").delete().in("name", [DEMO_NAME, OTHER_NAME]);

  // --- Family 1 -----------------------------------------------------------
  const fam = await createFamily(DEMO_NAME);
  const { data: members, error: mErr } = await supabase
    .from("members")
    .insert([
      { family_id: fam.id, name: "Mama", last_seen_at: now.toISOString() },
      { family_id: fam.id, name: "Papa", last_seen_at: now.toISOString() },
    ])
    .select("id,name");
  if (mErr) throw mErr;

  const birthDate = format(subDays(toZonedTime(now, TZ), 4 * 30 + 5), "yyyy-MM-dd");
  const { data: baby, error: bErr } = await supabase
    .from("babies")
    .insert({ family_id: fam.id, name: "Emma", birth_date: birthDate, sex: "f" })
    .select("id")
    .single();
  if (bErr) throw bErr;

  const events = generateDemoEvents({ now, days: 14, tz: TZ });
  const memberIds = (members ?? []).map((m) => m.id as string);
  const rows = events.map((e, i) => ({
    family_id: fam.id,
    baby_id: baby.id,
    member_id: memberIds[i % memberIds.length],
    kind: e.kind,
    subtype: e.subtype,
    started_at: e.startedAt,
    ended_at: e.endedAt,
    amount_ml: e.amountMl,
    side: e.side,
    note: e.note,
  }));
  const { error: eErr } = await supabase.from("events").insert(rows);
  if (eErr) throw eErr;

  const measurements = generateDemoMeasurements({ now, birthDate, tz: TZ });
  const { error: msErr } = await supabase.from("measurements").insert(
    measurements.map((m) => ({
      family_id: fam.id,
      baby_id: baby.id,
      member_id: memberIds[0],
      kind: m.kind,
      value: m.value,
      measured_at: m.measuredAt,
      note: m.note,
    })),
  );
  if (msErr) throw msErr;

  // --- Family 2 (isolation) ----------------------------------------------
  const other = await createFamily(OTHER_NAME);
  const { data: otherBaby, error: obErr } = await supabase
    .from("babies")
    .insert({
      family_id: other.id,
      name: "Noah",
      birth_date: format(subDays(toZonedTime(now, TZ), 8 * 30), "yyyy-MM-dd"),
      sex: "m",
    })
    .select("id")
    .single();
  if (obErr) throw obErr;
  const otherEvents = generateDemoEvents({
    now,
    days: 7,
    tz: TZ,
    seed: 99,
    wakeWindowMin: 170,
    napLengthMin: 75,
    napsPerDay: 2,
    bottleMl: 180,
  });
  const { error: oeErr } = await supabase.from("events").insert(
    otherEvents.map((e) => ({
      family_id: other.id,
      baby_id: otherBaby.id,
      kind: e.kind,
      subtype: e.subtype,
      started_at: e.startedAt,
      ended_at: e.endedAt,
      amount_ml: e.amountMl,
      side: e.side,
      note: e.note,
    })),
  );
  if (oeErr) throw oeErr;

  console.log("");
  console.log("Seed fertig.");
  console.log(`  ${DEMO_NAME}: Code ${fam.code}  (Emma, ${events.length} Einträge, ${measurements.length} Messungen)`);
  console.log(`  ${OTHER_NAME}: Code ${other.code}  (Noah, ${otherEvents.length} Einträge)`);
  console.log("");
  console.log("Melde dich mit dem ersten Code an; der zweite darf Emma nie sehen.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
