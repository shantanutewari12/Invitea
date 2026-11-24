#!/usr/bin/env node
/**
 * Builds the standalone guest viewer into public/viewer/.
 *
 * Why a separate bundle: the guest page must stay small (static viewer JS <= 120 KB gzipped)
 * and must not grow when the host app grows. Next's App Router runtime alone is ~137 KB
 * gzipped, so the viewer is bundled on its own with esbuild: React + the renderer + the
 * offline code, with the animation presets as a lazily loaded chunk.
 *
 * Output (all hashed, immutable except shell.html):
 *   public/viewer/shell.html       the one document served for every /i/<token>
 *   public/viewer/app-<hash>.js    entry (ES module)
 *   public/viewer/chunk-*.js       shared and lazy chunks
 *   public/viewer/viewer-<hash>.css
 *   public/viewer/fonts/*.woff2
 *   public/viewer/manifest.json    asset list used by the service worker and the budget check
 */
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import { pathToFileURL } from "node:url";

import tailwindcss from "@tailwindcss/postcss";
import { build, transform } from "esbuild";
import postcss from "postcss";

const ROOT = process.cwd();
const OUT = join(ROOT, "public", "viewer");
const hash = (data) => createHash("sha256").update(data).digest("hex").slice(0, 10);
const toPosix = (path) => path.replaceAll("\\", "/");

/** Load copy/en.ts and config/site.ts in Node (TypeScript compiled in memory by esbuild). */
async function loadSharedModules() {
  const dir = mkdtempSync(join(tmpdir(), "regalia-build-"));
  try {
    await build({
      entryPoints: { copy: join(ROOT, "src/copy/en.ts"), site: join(ROOT, "src/config/site.ts") },
      outdir: dir,
      bundle: true,
      platform: "node",
      format: "esm",
      outExtension: { ".js": ".mjs" },
      logLevel: "error",
    });
    const copy = await import(pathToFileURL(join(dir, "copy.mjs")).href);
    const site = await import(pathToFileURL(join(dir, "site.mjs")).href);
    return { viewerCopy: copy.viewer, SITE: site.SITE };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const escapeHtml = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Variable latin-subset fonts from the @fontsource-variable packages (English-only UI).
const LATIN_RANGE =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const FONTS = [
  { variable: "--font-ui", family: "Regalia UI", pkg: "nunito", weight: "200 1000" },
  { variable: "--font-dancing", family: "Regalia Script", pkg: "dancing-script", weight: "400 700" },
  { variable: "--font-cormorant", family: "Regalia Cormorant", pkg: "cormorant-garamond", weight: "300 700" },
  { variable: "--font-playfair", family: "Regalia Playfair", pkg: "playfair-display", weight: "400 900" },
];

function copyFonts() {
  mkdirSync(join(OUT, "fonts"), { recursive: true });
  return FONTS.map((font) => {
    const source = join(ROOT, "node_modules", "@fontsource-variable", font.pkg, "files", `${font.pkg}-latin-wght-normal.woff2`);
    if (!existsSync(source)) throw new Error(`Font file not found: ${relative(ROOT, source)}`);
    const bytes = readFileSync(source);
    const name = `${font.pkg}-${hash(bytes)}.woff2`;
    cpSync(source, join(OUT, "fonts", name));
    return { ...font, file: `fonts/${name}`, bytes: bytes.length };
  });
}

async function buildCss(fonts) {
  const entry = join(ROOT, "src", "viewer", "viewer.css");
  const compiled = await postcss([tailwindcss()]).process(readFileSync(entry, "utf8"), { from: entry });
  const fontCss =
    fonts
      .map(
        (f) =>
          `@font-face{font-family:"${f.family}";font-style:normal;font-weight:${f.weight};font-display:swap;src:url(./${f.file}) format("woff2");unicode-range:${LATIN_RANGE}}`,
      )
      .join("") + `:root{${fonts.map((f) => `${f.variable}:"${f.family}"`).join(";")}}`;
  const minified = await transform(fontCss + compiled.css, { loader: "css", minify: true, target: "chrome87" });
  const file = `viewer-${hash(minified.code)}.css`;
  writeFileSync(join(OUT, file), minified.code);
  return { file, bytes: Buffer.byteLength(minified.code) };
}

async function buildJs() {
  const result = await build({
    entryPoints: { app: join(ROOT, "src", "viewer", "entry.tsx") },
    outdir: OUT,
    bundle: true,
    splitting: true,
    format: "esm",
    platform: "browser",
    target: "es2020",
    minify: true,
    legalComments: "none",
    metafile: true,
    entryNames: "[name]-[hash]",
    chunkNames: "chunk-[name]-[hash]",
    jsx: "automatic",
    tsconfig: join(ROOT, "tsconfig.json"),
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "warning",
    logOverride: { "ignored-directive": "silent" },
  });

  const outputs = Object.fromEntries(
    Object.entries(result.metafile.outputs).map(([path, meta]) => [toPosix(relative(OUT, join(ROOT, path))), meta]),
  );
  const entry = Object.keys(outputs).find((file) => outputs[file].entryPoint);

  // Chunks reachable through static imports load immediately; the rest are lazy.
  const initial = new Set([entry]);
  const queue = [entry];
  while (queue.length > 0) {
    for (const imp of outputs[queue.pop()].imports) {
      const file = toPosix(relative(OUT, join(ROOT, imp.path)));
      if (imp.kind === "import-statement" && outputs[file] && !initial.has(file)) {
        initial.add(file);
        queue.push(file);
      }
    }
  }
  const lazy = Object.keys(outputs).filter((file) => file.endsWith(".js") && !initial.has(file));
  return { entry, initial: [...initial], lazy, bytes: (file) => Buffer.byteLength(readFileSync(join(OUT, file))) };
}

function shellHtml({ viewerCopy, SITE }, js, css) {
  const preload = js.initial
    .filter((file) => file !== js.entry)
    .map((file) => `<link rel="modulepreload" href="/viewer/${file}">`)
    .join("");
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">',
    '<meta name="referrer" content="no-referrer">',
    `<meta name="theme-color" content="${SITE.themeColor}">`,
    `<title>${escapeHtml(viewerCopy.pageTitle)}</title>`,
    '<link rel="manifest" href="/manifest.webmanifest">',
    '<link rel="icon" href="/icons/192" type="image/png">',
    '<link rel="apple-touch-icon" href="/icons/192">',
    `<link rel="stylesheet" href="/viewer/${css.file}">`,
    preload,
    `<script type="module" src="/viewer/${js.entry}"></script>`,
    "</head>",
    "<body>",
    `<div id="root"><p style="margin:0;padding:2rem 1rem;text-align:center;font:1rem Georgia,serif;color:${SITE.themeColor}">${escapeHtml(viewerCopy.loadingInvite)}</p></div>`,
    `<noscript>${escapeHtml(viewerCopy.noScript)}</noscript>`,
    "</body>",
    "</html>",
    "",
  ].join("");
}

async function main() {
  const started = Date.now();
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const shared = await loadSharedModules();
  const fonts = copyFonts();
  const css = await buildCss(fonts);
  const js = await buildJs();

  const html = shellHtml(shared, js, css);
  writeFileSync(join(OUT, "shell.html"), html);

  const shell = shared.SITE.viewerShellPath;
  const manifest = {
    shell,
    entry: `/viewer/${js.entry}`,
    initialJs: js.initial.map((f) => `/viewer/${f}`),
    lazyJs: js.lazy.map((f) => `/viewer/${f}`),
    css: [`/viewer/${css.file}`],
    fonts: fonts.map((f) => `/viewer/${f.file}`),
    // What the service worker precaches. Hashed files need no revision; the shell does.
    precache: [
      { url: shell, revision: hash(html) },
      ...js.initial.concat(js.lazy).map((f) => ({ url: `/viewer/${f}`, revision: null })),
      { url: `/viewer/${css.file}`, revision: null },
      ...fonts.map((f) => ({ url: `/viewer/${f.file}`, revision: null })),
    ],
  };
  writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(
    `viewer built in ${((Date.now() - started) / 1000).toFixed(1)}s: ${manifest.initialJs.length} initial + ${manifest.lazyJs.length} lazy JS file(s), ${basename(css.file)} (${(css.bytes / 1000).toFixed(1)} kB)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
