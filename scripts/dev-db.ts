/**
 * Local stand-in for Supabase: PGlite (persisted in .local/db) exposed over the
 * Postgres wire protocol, with a PostgREST binary in front of it.
 *
 *   npm run dev:db          # starts DB + PostgREST on http://127.0.0.1:54321
 *
 * Requires .local/bin/postgrest (see README "Lokale Entwicklung ohne Supabase").
 * Prints the env values to put into .env.local. Migrations are applied on start.
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { SignJWT } from "jose";
import { spawn } from "node:child_process";
import http from "node:http";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, ".local/db/pg");
const POSTGREST = path.join(ROOT, ".local/bin/postgrest");
const PG_PORT = Number(process.env.DEV_PG_PORT ?? 5433);
const REST_PORT = Number(process.env.DEV_REST_PORT ?? 54321);
const JWT_SECRET = "nuggi-local-dev-jwt-secret-please-do-not-use-in-prod";

async function main() {
  if (!existsSync(POSTGREST)) {
    console.error(`PostgREST fehlt: ${POSTGREST}\nSiehe README → Lokale Entwicklung.`);
    process.exit(1);
  }
  const db = await PGlite.create({ dataDir: DATA_DIR });

  const dir = path.join(ROOT, "supabase/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(path.join(dir, file), "utf8"));
  }
  // PostgREST needs the anon role to exist; give it nothing.
  await db.exec(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
      grant usage on schema public to service_role;
      grant all on all tables in schema public to service_role;
      grant all on all sequences in schema public to service_role;
      alter default privileges in schema public grant all on tables to service_role;
    end $$;
  `);
  console.log("✓ Migrations angewendet");

  const server = new PGLiteSocketServer({ db, port: PG_PORT, host: "127.0.0.1" });
  await server.start();
  console.log(`✓ PGlite lauscht auf 127.0.0.1:${PG_PORT}`);

  const serviceKey = await new SignJWT({ role: "service_role", iss: "nuggi-local" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10y")
    .sign(new TextEncoder().encode(JWT_SECRET));

  const confPath = path.join(ROOT, ".local/postgrest.conf");
  writeFileSync(
    confPath,
    [
      `db-uri = "postgres://postgres:postgres@127.0.0.1:${PG_PORT}/postgres"`,
      `db-schemas = "public"`,
      `db-anon-role = "anon"`,
      `db-pool = 1`,
      `db-channel-enabled = false`,
      `db-config = false`,
      `db-prepared-statements = false`,
      `jwt-secret = "${JWT_SECRET}"`,
      `server-host = "127.0.0.1"`,
      `server-port = ${REST_PORT + 1}`,
      `log-level = "warn"`,
      "",
    ].join("\n"),
  );

  const child = spawn(POSTGREST, [confPath], { stdio: "inherit" });
  child.on("exit", (code) => {
    console.error(`PostgREST beendet (${code})`);
    process.exit(code ?? 1);
  });

  // supabase-js talks to <url>/rest/v1/...; PostgREST serves at /. Strip the prefix.
  const proxy = http.createServer((req, res) => {
    const target = (req.url ?? "/").replace(/^\/rest\/v1/, "") || "/";
    const upstream = http.request(
      { host: "127.0.0.1", port: REST_PORT + 1, method: req.method, path: target, headers: req.headers },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.writeHead(502);
      res.end("PostgREST nicht erreichbar");
    });
    req.pipe(upstream);
  });
  proxy.listen(REST_PORT, "127.0.0.1");

  console.log("");
  console.log("Trag das in .env.local ein:");
  console.log(`SUPABASE_URL=http://127.0.0.1:${REST_PORT}`);
  console.log(`SUPABASE_SERVICE_ROLE_KEY=${serviceKey}`);
  console.log("");

  const shutdown = async () => {
    child.kill();
    await server.stop();
    await db.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
