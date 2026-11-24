#!/usr/bin/env node
/**
 * Bundle budget check for the guest viewer. Run after `pnpm build` (or `pnpm build:viewer`).
 *
 *  - Initial JS: the entry plus every chunk it imports statically, i.e. everything a guest's
 *    phone downloads before the invitation can render (React, renderer, offline code), gzipped.
 *  - Animation payload: the lazy chunks (Framer Motion + presets). They must NOT be part of the
 *    initial JS; static mode never requests them.
 *
 * Exits 1 when a budget is exceeded or when the animation code leaks into the initial JS.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = process.cwd();
const VIEWER_DIR = join(ROOT, "public");
const VIEWER_JS_BUDGET_GZ = 120 * 1000; // 120 KB gzipped (decimal kB, the stricter reading)
const ANIMATION_MARKER = "regalia-animation-chunk-v1";

const kb = (bytes) => `${(bytes / 1000).toFixed(1)} kB`;
const gz = (buffer) => gzipSync(buffer, { level: 9 }).length;
const fail = (message) => {
  console.error(`\n✗ ${message}`);
  process.exit(1);
};

const manifestPath = join(VIEWER_DIR, "viewer", "manifest.json");
if (!existsSync(manifestPath)) fail("public/viewer/manifest.json not found. Run `pnpm build:viewer` first.");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

function measure(urls) {
  return urls.map((url) => {
    const raw = readFileSync(join(VIEWER_DIR, url));
    return { url, raw: raw.length, gzip: gz(raw), text: url.endsWith(".js") ? raw.toString("utf8") : "" };
  });
}

const initial = measure(manifest.initialJs);
const lazy = measure(manifest.lazyJs);
const css = measure(manifest.css);
const fonts = measure(manifest.fonts);
const sum = (files, key = "gzip") => files.reduce((n, f) => n + f[key], 0);
const line = (f) => `  ${kb(f.gzip).padStart(10)} gz  ${kb(f.raw).padStart(10)} raw  ${f.url}`;

console.log("Initial JavaScript (every guest, static or animated)");
initial.sort((a, b) => b.gzip - a.gzip).forEach((f) => console.log(line(f)));
console.log(`  ${"-".repeat(60)}`);
console.log(`  ${kb(sum(initial)).padStart(10)} gz  total   (budget ${kb(VIEWER_JS_BUDGET_GZ)})`);

console.log("\nLazy JavaScript (animated invites only)");
lazy.sort((a, b) => b.gzip - a.gzip).forEach((f) => console.log(line(f)));
console.log(`  ${"-".repeat(60)}`);
console.log(`  ${kb(sum(lazy)).padStart(10)} gz  total`);

console.log(`\nCSS: ${kb(sum(css))} gz   Fonts (lazy per face, precached): ${kb(sum(fonts, "raw"))}`);

const markerInInitial = initial.filter((f) => f.text.includes(ANIMATION_MARKER));
if (!lazy.some((f) => f.text.includes(ANIMATION_MARKER))) fail("The animation chunk is not split out as a lazy chunk.");
if (markerInInitial.length > 0) fail(`Animation code is in the initial JS (${markerInInitial.map((f) => f.url).join(", ")}).`);
if (sum(initial) > VIEWER_JS_BUDGET_GZ) {
  fail(`Initial viewer JS is ${kb(sum(initial))} gzipped, over the ${kb(VIEWER_JS_BUDGET_GZ)} budget.`);
}
console.log(`\n✓ Initial viewer JS ${kb(sum(initial))} gzipped is within the ${kb(VIEWER_JS_BUDGET_GZ)} budget; animation code is lazy.`);
