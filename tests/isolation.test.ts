import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Data-isolation guard rails, enforced by scanning the source:
 *
 * 1. No server action or route handler accepts a family id from the client.
 * 2. Every scoped data module filters by the session's family id
 *    (`withFamily(...)` for reads/updates/deletes, `ownedBy(scope, ...)` for inserts).
 * 3. The only modules that see more than one family are `login.ts` (verifying a
 *    code), `admin.ts` (ADMIN_SECRET) and `cron.ts` (CRON_SECRET), and only the
 *    matching entry points may import them.
 */

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join("/");
const read = (p: string) => readFileSync(p, "utf8");

describe("family isolation", () => {
  const actionFiles = walk(path.join(SRC, "actions"));
  const routeFiles = walk(path.join(SRC, "app")).filter((f) => f.endsWith("route.ts"));

  it("has server actions to check", () => {
    expect(actionFiles.length).toBeGreaterThan(0);
  });

  it("no server action or route handler accepts a family id from the client", () => {
    for (const file of [...actionFiles, ...routeFiles]) {
      const src = read(file);
      // Zod schemas / params must not carry a family id.
      expect(src, rel(file)).not.toMatch(/familyId\s*:\s*z\./);
      expect(src, rel(file)).not.toMatch(/family_id\s*:\s*z\./);
      expect(src, rel(file)).not.toMatch(/formData\.get\(["']family/i);
      expect(src, rel(file)).not.toMatch(/searchParams\.get\(["']family/i);
      // Scopes may only come from the session helper.
      if (/withFamily|ownedBy|FamilyScope/.test(src) || /scope\b/.test(src)) {
        expect(src, rel(file)).toMatch(/requireSession|getSession|cronScope/);
      }
    }
  });

  it("scoped data modules always filter by the session's family", () => {
    const dbDir = path.join(SRC, "lib", "db");
    const exempt = new Set(["client.ts", "withFamily.ts", "login.ts", "admin.ts", "cron.ts"]);
    for (const file of walk(dbDir)) {
      const name = path.basename(file);
      if (exempt.has(name)) continue;
      const src = read(file);
      const froms = src.match(/\.from\(["'`](\w+)["'`]\)/g) ?? [];
      expect(froms.length, `${rel(file)} should query tables`).toBeGreaterThan(0);
      // Every exported data function takes a FamilyScope as its first parameter
      // and no parameter is a raw family id.
      const signatures = [...src.matchAll(/export async function (\w+)\(([^)]*)\)/g)].map((m) => ({
        name: m[1]!,
        params: m[2]!,
      }));
      const exportsWithoutScope = signatures.filter(
        (f) => !/^\s*scope\s*:\s*FamilyScope/.test(f.params),
      );
      expect(exportsWithoutScope, `${rel(file)} exports without scope`).toEqual([]);
      const rawFamilyParams = signatures.filter((f) => /family(_i|I)d/.test(f.params));
      expect(rawFamilyParams, `${rel(file)} accepts a family id`).toEqual([]);
      // Reads/updates/deletes go through withFamily, inserts through ownedBy.
      const selectsUpdatesDeletes = (src.match(/\.(select|update|delete)\(/g) ?? []).length;
      const inserts = (src.match(/\.(insert|upsert)\(/g) ?? []).length;
      const withFamilyUses = (src.match(/withFamily\(/g) ?? []).length;
      const ownedByUses = (src.match(/ownedBy\(scope/g) ?? []).length;
      // `.select()` after an insert is a projection, not a query: subtract inserts.
      const scopedReads = selectsUpdatesDeletes - inserts;
      expect(withFamilyUses, `${rel(file)} withFamily count`).toBeGreaterThanOrEqual(
        scopedReads - countExplicitIdFilters(src),
      );
      expect(ownedByUses, `${rel(file)} ownedBy count`).toBe(inserts);
    }
  });

  it("cross-family modules are only imported by their entry points", () => {
    const files = walk(SRC);
    const allowed: Record<string, RegExp[]> = {
      "@/lib/db/login": [/^src\/actions\/auth\.ts$/, /^src\/lib\/db\/(families|admin|cron)\.ts$/],
      "@/lib/db/admin": [/^src\/app\/admin\//, /^src\/actions\/admin\.ts$/],
      "@/lib/db/cron": [/^src\/app\/api\/cron\//, /^src\/lib\/push\//],
    };
    for (const file of files) {
      const src = read(file);
      for (const [mod, patterns] of Object.entries(allowed)) {
        if (src.includes(`from "${mod}"`)) {
          const ok = patterns.some((p) => p.test(rel(file)));
          expect(ok, `${rel(file)} must not import ${mod}`).toBe(true);
        }
      }
    }
  });
});

/**
 * `families.ts` filters the families table by `id = scope.familyId` because the
 * families table has no family_id column. Count those so the ratio check holds.
 */
function countExplicitIdFilters(src: string): number {
  return (src.match(/\.eq\("id",\s*scope\.familyId\)/g) ?? []).length;
}
