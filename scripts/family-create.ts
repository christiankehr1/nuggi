/**
 * Create a family and print its code once.
 *   npm run family:create -- "Familie Müller"
 *   npm run family:create -- "Familie Müller" Europe/Berlin
 */
import { codePrefix, generateFamilyCode, hashFamilyCode } from "../src/lib/family-code";
import { scriptClient } from "./lib/supabase";

async function main() {
  const name = process.argv[2]?.trim();
  const timezone = process.argv[3]?.trim() || "Europe/Zurich";
  if (!name) {
    console.error('Bitte einen Namen angeben: npm run family:create -- "Familie Müller"');
    process.exit(1);
  }
  const supabase = scriptClient();
  const code = generateFamilyCode();
  const { data, error } = await supabase
    .from("families")
    .insert({ name, code_prefix: codePrefix(code), code_hash: await hashFamilyCode(code), timezone })
    .select("id")
    .single();
  if (error) throw error;
  console.log("");
  console.log(`Familie angelegt: ${name} (${data.id})`);
  console.log(`Familiencode:     ${code}`);
  console.log("");
  console.log("Der Code wird nur einmal angezeigt – gib ihn der Familie weiter.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
