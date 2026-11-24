import { publicEnv } from "@/lib/env.public";

/**
 * Product analytics (PostHog), host side only. Privacy by construction:
 *  - cookieless: `persistence: "memory"`, nothing is written to cookies or storage;
 *  - autocapture, pageviews, session recording and surveys are all off;
 *  - only the events and property names below can be sent, so names, phone numbers, tokens,
 *    messages and addresses cannot leak even if a caller passes them by mistake.
 */
export const ANALYTICS_EVENTS = [
  "invite_created",
  "invite_published",
  "guests_added",
  "checkout_started",
  "payment_succeeded",
] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

const ALLOWED_PROPS = new Set(["event_type", "display_mode", "source", "count", "plan"]);
const SAFE_VALUE = /^[a-z0-9_.-]{1,40}$/;

export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

/** Keep only allow-listed keys with short, identifier-like strings, finite numbers or booleans. */
export function sanitizeProps(props: AnalyticsProps = {}): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!ALLOWED_PROPS.has(key)) continue;
    if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else if (typeof value === "boolean") out[key] = value;
    else if (typeof value === "string" && SAFE_VALUE.test(value)) out[key] = value;
  }
  return out;
}

type PostHog = typeof import("posthog-js").default;
let client: Promise<PostHog> | null = null;

function load(): Promise<PostHog> {
  client ??= import("posthog-js").then(({ default: posthog }) => {
    posthog.init(publicEnv.posthogKey, {
      api_host: publicEnv.posthogHost,
      persistence: "memory",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      disable_surveys: true,
      person_profiles: "never",
      ip: false,
    });
    return posthog;
  });
  return client;
}

export const analyticsEnabled = () => typeof window !== "undefined" && publicEnv.posthogKey !== "";

/** Fire and forget. A no-op without a key, and it never throws into the UI. */
export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  if (!analyticsEnabled()) return;
  load()
    .then((posthog) => posthog.capture(event, sanitizeProps(props)))
    .catch(() => undefined);
}
