import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Applies the SQL migrations to an in-memory Postgres (PGlite) and checks the
 * constraints that the app relies on. No Docker or Supabase needed.
 */
const MIGRATIONS_DIR = path.resolve(__dirname, "../supabase/migrations");

let pg: PGlite;

beforeAll(async () => {
  pg = new PGlite();
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    await pg.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  }
});

afterAll(async () => {
  await pg.close();
});

async function seedFamily(name: string, prefix: string) {
  const fam = await pg.query<{ id: string }>(
    "insert into families (name, code_prefix, code_hash) values ($1, $2, 'x') returning id",
    [name, prefix],
  );
  const familyId = fam.rows[0]!.id;
  const baby = await pg.query<{ id: string }>(
    "insert into babies (family_id, name, birth_date) values ($1, 'Emma', '2026-05-20') returning id",
    [familyId],
  );
  return { familyId, babyId: baby.rows[0]!.id };
}

describe("migrations", () => {
  it("creates all tables with RLS enabled", async () => {
    const res = await pg.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class
       where relkind = 'r' and relnamespace = 'public'::regnamespace order by relname`,
    );
    const names = res.rows.map((r) => r.relname);
    expect(names).toEqual([
      "babies",
      "events",
      "families",
      "measurements",
      "members",
      "push_subscriptions",
      "reminders_sent",
    ]);
    expect(res.rows.every((r) => r.relrowsecurity)).toBe(true);
  });

  it("has no RLS policies (deny-all)", async () => {
    const res = await pg.query<{ n: number }>("select count(*)::int as n from pg_policies");
    expect(res.rows[0]!.n).toBe(0);
  });

  it("applies default baby settings", async () => {
    const { babyId } = await seedFamily("Defaults", "AAA");
    const res = await pg.query<{ settings: Record<string, unknown> }>(
      "select settings from babies where id = $1",
      [babyId],
    );
    expect(res.rows[0]!.settings).toMatchObject({
      napLeadMinutes: 15,
      feedIntervalMinutes: null,
      bedtimeTarget: "19:00",
      reminders: { nap: true, feed: true, bedtime: true },
    });
  });

  it("allows only one running sleep and one running feed per baby", async () => {
    const { familyId, babyId } = await seedFamily("Running", "BBB");
    await pg.query(
      "insert into events (family_id, baby_id, kind, subtype, started_at) values ($1,$2,'sleep','nap',now())",
      [familyId, babyId],
    );
    await expect(
      pg.query(
        "insert into events (family_id, baby_id, kind, subtype, started_at) values ($1,$2,'sleep','night',now())",
        [familyId, babyId],
      ),
    ).rejects.toThrow(/events_one_running_per_kind_uidx/);
    // a running feed is still fine
    await pg.query(
      "insert into events (family_id, baby_id, kind, subtype, started_at) values ($1,$2,'feed','breast',now())",
      [familyId, babyId],
    );
    // and a finished sleep is fine too
    await pg.query(
      "insert into events (family_id, baby_id, kind, subtype, started_at, ended_at) values ($1,$2,'sleep','nap',now() - interval '2 hours', now() - interval '1 hour')",
      [familyId, babyId],
    );
  });

  it("rejects mismatched kind/subtype and bad sides", async () => {
    const { familyId, babyId } = await seedFamily("Checks", "CCC");
    await expect(
      pg.query(
        "insert into events (family_id, baby_id, kind, subtype, started_at) values ($1,$2,'sleep','bottle',now())",
        [familyId, babyId],
      ),
    ).rejects.toThrow();
    await expect(
      pg.query(
        "insert into events (family_id, baby_id, kind, subtype, started_at, side) values ($1,$2,'feed','breast',now(),'X')",
        [familyId, babyId],
      ),
    ).rejects.toThrow();
    await expect(
      pg.query(
        "insert into measurements (family_id, baby_id, kind, value, measured_at) values ($1,$2,'shoe_size',1,now())",
        [familyId, babyId],
      ),
    ).rejects.toThrow();
  });

  it("member names are unique per family, case-insensitively", async () => {
    const { familyId } = await seedFamily("Members", "DDD");
    await pg.query("insert into members (family_id, name) values ($1, 'Mama')", [familyId]);
    await expect(
      pg.query("insert into members (family_id, name) values ($1, 'mama')", [familyId]),
    ).rejects.toThrow();
    const other = await seedFamily("Members 2", "EEE");
    await pg.query("insert into members (family_id, name) values ($1, 'Mama')", [other.familyId]);
  });

  it("updates updated_at on event edits", async () => {
    const { familyId, babyId } = await seedFamily("Trigger", "FFF");
    const ins = await pg.query<{ id: string; updated_at: string }>(
      "insert into events (family_id, baby_id, kind, subtype, started_at, ended_at) values ($1,$2,'feed','bottle',now() - interval '1 hour', now()) returning id, updated_at",
      [familyId, babyId],
    );
    await new Promise((r) => setTimeout(r, 5));
    const upd = await pg.query<{ updated_at: string }>(
      "update events set amount_ml = 120 where id = $1 returning updated_at",
      [ins.rows[0]!.id],
    );
    expect(new Date(upd.rows[0]!.updated_at).getTime()).toBeGreaterThan(
      new Date(ins.rows[0]!.updated_at).getTime(),
    );
  });

  it("cascades deletes from family to everything", async () => {
    const { familyId, babyId } = await seedFamily("Cascade", "GGG");
    await pg.query(
      "insert into events (family_id, baby_id, kind, subtype, started_at, ended_at) values ($1,$2,'feed','bottle',now(),now())",
      [familyId, babyId],
    );
    await pg.query("delete from families where id = $1", [familyId]);
    const res = await pg.query<{ n: number }>(
      "select count(*)::int as n from events where family_id = $1",
      [familyId],
    );
    expect(res.rows[0]!.n).toBe(0);
  });
});
