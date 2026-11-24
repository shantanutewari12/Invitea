# Invitea: beautiful digital invitations (PWA)

A host describes a celebration, gets a styled invitation, and shares a **personal link per guest**
(`/i/<token>`). A guest link needs the internet **once**; after that it opens fully offline
(content, guest name, countdown, calendar file, copy address). RSVPs made offline are queued and
delivered exactly once when the device is back online.

Stack: Next.js (App Router) · TypeScript · Tailwind + shadcn/ui · Framer Motion · Supabase
(Postgres + RLS, Auth, Storage) · Serwist + IndexedDB · Gemini (behind `LLMProvider`) · Razorpay · PostHog.

## How it fits together

| Part | Where | Notes |
| --- | --- | --- |
| Guest viewer | `src/viewer`, `scripts/build-viewer.mjs` | **Not a Next page.** A standalone esbuild bundle in `public/viewer/` (86 kB gz initial, budget 120 kB). `/i/<token>` is rewritten to `viewer/shell.html`. |
| Animation | `src/renderer/animation` | Separate lazy chunk. Static invites never load it. |
| Service worker | `src/sw/sw.ts` | Scope `/i/`. Precaches only the viewer bundle + icons, serves the cached shell for any `/i/*` navigation. |
| Offline data | `src/lib/offline` | IndexedDB (`invites`, `assets`, `outbox`, `meta`). RSVP outbox has idempotency keys, Web Locks, Background Sync + `online`/app-open fallbacks. |
| Token API | `src/lib/api/by-token.ts`, `rsvp.ts` | Minimal payload, `no-store`, identical 404 for unknown/draft/malformed tokens, rate limited. |
| Host app | `src/app/(host)`, `src/lib/host` | Dashboard, create, builder (live preview + animated/static toggle), share (QR, WhatsApp, RSVP tracker). |
| AI | `src/lib/ai`, `src/lib/api/ai.ts` | The model returns **JSON only**; it is Zod-validated, retried once, then falls back to the default template. It never produces HTML, code, URLs, events or addresses. |
| Payments | `src/lib/payments`, `src/lib/api/payments.ts` | Server-created order, signature verification **and** idempotent webhook. |
| Database | `supabase/migrations` | RLS on every table. Hosts have read-only own-row policies; every write goes through route handlers. |

## Setup

```bash
pnpm install
cp .env.example .env.local        # fill in the values
```

1. **Supabase**: create a project, run `supabase/migrations/20260101000000_init.sql` (SQL editor or
   `supabase db push`). It creates the tables, RLS policies, RPCs and the private `invite-assets` bucket.
   Enable email/password sign-in and set the site URL + `…/auth/callback` as a redirect URL.
2. **Gemini**: set `GEMINI_API_KEY`. Without it the app still works and always uses the default template.
3. **Razorpay**: set the key id/secret (and `NEXT_PUBLIC_RAZORPAY_KEY_ID`). Add a webhook to
   `https://<your-domain>/api/payments/webhook` for `payment.captured` and `order.paid`, and put its
   secret in `RAZORPAY_WEBHOOK_SECRET`.
4. **PostHog** (optional): set `NEXT_PUBLIC_POSTHOG_KEY`. Cookieless, autocapture off, in-memory
   persistence, allow-listed event/property names only (`src/lib/analytics.ts`).

```bash
pnpm dev          # builds the viewer bundle, then next dev (the service worker is disabled in dev)
pnpm build        # viewer bundle + next build --webpack (generates the service worker)
pnpm bundle:report  # gz sizes; fails above 120 kB or if the animation chunk is not lazy
```

Plans, prices and limits live in `src/config/plans.ts`. All UI copy is in `src/copy/en.ts`.

## Tests

```bash
pnpm typecheck && pnpm lint
pnpm test          # unit tests + SQL policy tests (PGlite runs the real migration)
pnpm e2e           # Playwright against a production build with in-memory fixtures
```

`REGALIA_E2E_FIXTURES=1` swaps Supabase for in-memory fixtures (and a "any email signs in" demo login).
It is ignored when `VERCEL_ENV=production`. Never set it on a real deployment.

## Deploy (Vercel)

Import the repo, add the environment variables from `.env.example`, deploy. `vercel.json` pins the
build and the Mumbai region. Security headers and CSP are set in `next.config.ts`: guest pages get a
strict `script-src 'self'`; the host app allow-lists Razorpay, PostHog and Supabase.

## Privacy and security

- `/i/*` is `noindex`, `no-referrer`, and never cached by shared caches; guest data is only returned for the token in the URL.
- Tokens are 21-char nanoids. RLS denies `anon` everything; the service role is used only server-side, scoped by a verified token or owner id.
- Uploads: signed upload URLs only, WebP resized client-side to ≤1600 px, type and size re-checked on the server before an asset is registered.
- Rate limits (per IP for public endpoints, per user for AI and uploads) use a Postgres fixed-window RPC.
