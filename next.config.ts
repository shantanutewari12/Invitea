import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

import { SITE } from "./src/config/site";

// @serwist/next warns when it sees Turbopack (next dev / typegen). The worker is disabled
// outside production builds and production builds use webpack, so the warning is noise.
process.env.SERWIST_SUPPRESS_TURBOPACK_WARNING ??= "1";

/** Changes on every build so precached icon responses are refetched after a deploy. */
const BUILD_REVISION = process.env.VERCEL_GIT_COMMIT_SHA ?? Date.now().toString(36);

interface ViewerManifest {
  precache: { url: string; revision: string | null }[];
}

/** Written by scripts/build-viewer.mjs (run before `next build`). */
function readViewerManifest(): ViewerManifest | null {
  const file = join(process.cwd(), "public", "viewer", "manifest.json");
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as ViewerManifest) : null;
}

const viewerManifest = readViewerManifest();
if (!viewerManifest && process.env.NODE_ENV === "production" && process.env.npm_lifecycle_event === "build") {
  throw new Error("public/viewer/manifest.json is missing. Run `node scripts/build-viewer.mjs` before `next build`.");
}

/** Guests only ever need the viewer bundle and the app icons: never the host app's JS. */
const isGuestAsset = (url: string) => url.startsWith(SITE.viewerAssetPrefix) || url.startsWith("/icons/");

const withSerwist = withSerwistInit({
  swSrc: "src/sw/sw.ts",
  swDest: "public/sw.js",
  // The service worker is only for guest links and only runs in production builds.
  disable: process.env.NODE_ENV !== "production",
  // We register the worker ourselves, only on guest pages (/i/*).
  register: false,
  reloadOnOnline: false,
  cacheOnNavigation: false,
  // Nothing from public/ or Next's own chunks is precached automatically: the guest app is a
  // standalone bundle (see scripts/build-viewer.mjs), listed explicitly below.
  globPublicPatterns: [],
  manifestTransforms: [
    async (entries) => ({ manifest: entries.filter((entry) => isGuestAsset(entry.url)), warnings: [] }),
  ],
  additionalPrecacheEntries: [
    ...(viewerManifest?.precache ?? []),
    { url: "/icons/192", revision: BUILD_REVISION },
    { url: "/icons/512", revision: BUILD_REVISION },
    { url: "/icons/maskable-512", revision: BUILD_REVISION },
  ],
});

const IMMUTABLE = "public, max-age=31536000, immutable";

const isProd = process.env.NODE_ENV === "production";

/**
 * Guest pages: the cached shell loads exactly one external module script, so scripts are
 * locked to 'self' (no inline, no eval, no third parties). Inline styles are needed for the
 * loading text and Framer Motion style attributes.
 */
const GUEST_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

/**
 * Host app: Next injects inline hydration scripts, so 'unsafe-inline' is required without
 * per-request nonces (nonces would also make the HTML uncacheable). Third parties are
 * allow-listed one by one: Razorpay Checkout, PostHog, Supabase.
 */
const HOST_CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"} https://checkout.razorpay.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://*.razorpay.com",
  "media-src 'self' blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.posthog.com https://api.razorpay.com https://lumberjack.razorpay.com",
  "frame-src https://api.razorpay.com https://checkout.razorpay.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Serwist injects a webpack config (used by `next build --webpack`). This acknowledges
  // that `next dev` uses Turbopack, where the (disabled) service worker is not needed.
  turbopack: {},
  async rewrites() {
    return {
      // /i/<token> (one segment) is the standalone guest viewer shell; the same document for every
      // token. /i/<token>/manifest.webmanifest and the API are real routes and are not rewritten.
      beforeFiles: [{ source: "/i/:token", destination: SITE.viewerShellPath }],
      // Browsers still ask for /favicon.ico by default; serve the maroon card icon for it.
      afterFiles: [{ source: "/favicon.ico", destination: "/icon.svg" }],
      fallback: [],
    };
  },
  async headers() {
    const guestHeaders = [
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
      { key: "Content-Security-Policy", value: GUEST_CSP },
      // Personal links must never leak through the Referer header.
      { key: "Referrer-Policy", value: "no-referrer" },
      ...SECURITY_HEADERS,
    ];
    return [
      {
        // Everything except guest pages and static assets gets the host CSP.
        source: "/((?!i/|viewer/|_next/static|_next/image|icons/).*)",
        headers: [
          { key: "Content-Security-Policy", value: HOST_CSP },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          ...SECURITY_HEADERS,
        ],
      },
      {
        // Guest pages carry personal links: keep them out of search engines.
        source: "/i/:path*",
        headers: guestHeaders,
      },
      {
        // The shell is revalidated on every load; everything it references is content-hashed.
        source: SITE.viewerShellPath,
        headers: [{ key: "Cache-Control", value: "no-cache" }, ...guestHeaders],
      },
      {
        source: "/viewer/:file((?:app|chunk|viewer)-.*)",
        headers: [{ key: "Cache-Control", value: IMMUTABLE }],
      },
      { source: "/viewer/fonts/:file*", headers: [{ key: "Cache-Control", value: IMMUTABLE }] },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
