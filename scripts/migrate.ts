/**
 * Applies supabase/migrations/*.sql in order to the database at DATABASE_URL.
 *
 *   DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-1-eu-central-2.pooler.supabase.com:5432/postgres" npm run db:migrate
 *
 * Alternative: paste the SQL into the Supabase SQL editor, or use `supabase db push`.
 * Migrations are idempotent (create ... if not exists), so re-running is safe.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL fehlt. Beispiel: postgresql://postgres.[ref]:[pw]@aws-1-eu-central-2.pooler.supabase.com:5432/postgres");
    process.exit(1);
  }
  const dir = path.resolve(__dirname, "../supabase/migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    for (const file of files) {
      process.stdout.write(`→ ${file} … `);
      await client.query(readFileSync(path.join(dir, file), "utf8"));
      console.log("ok");
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
