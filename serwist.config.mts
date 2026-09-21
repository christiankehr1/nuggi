import { serwist } from "@serwist/next/config";

/**
 * Serwist "configurator" mode: works with Turbopack.
 * `npm run build` runs `next build` and then `serwist inject-manifest serwist.config.ts`,
 * which bundles src/app/sw.ts to public/sw.js with the precache manifest injected.
 */
export default serwist.withNextConfig(() => ({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Don't precache the huge chunks of chart libraries; they're runtime-cached instead.
  maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
  globIgnores: ["public/sw.js", "public/sw.js.map"],
}));
