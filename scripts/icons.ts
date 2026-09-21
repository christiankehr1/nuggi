/**
 * Generates all PWA icons from public/icons/source.svg.
 *   npm run icons
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const dir = path.resolve(__dirname, "../public/icons");
const source = readFileSync(path.join(dir, "source.svg"));
const NAVY = { r: 11, g: 13, b: 43, alpha: 1 };

async function png(name: string, size: number, opts: { maskable?: boolean } = {}) {
  let img = sharp(source).resize(size, size);
  if (opts.maskable) {
    // Maskable icons need the artwork inside the inner 80% safe zone.
    const inner = Math.round(size * 0.8);
    const pad = Math.round((size - inner) / 2);
    img = sharp(source)
      .resize(inner, inner)
      .extend({ top: pad, bottom: size - inner - pad, left: pad, right: size - inner - pad, background: NAVY })
      .flatten({ background: NAVY });
  }
  await img.png().toFile(path.join(dir, name));
  console.log(`✓ ${name} (${size}px)`);
}

async function main() {
  await png("icon-192.png", 192);
  await png("icon-512.png", 512);
  await png("maskable-192.png", 192, { maskable: true });
  await png("maskable-512.png", 512, { maskable: true });
  await png("apple-touch-icon.png", 180);
  await png("badge-96.png", 96);
  await sharp(source).resize(32, 32).png().toFile(path.join(dir, "..", "favicon.png"));
  console.log("✓ favicon.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
