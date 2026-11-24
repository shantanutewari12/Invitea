import type { DisplayMode, RsvpStatus } from "./spec/constants";
import type { InviteSpec } from "./spec/schema";

/**
 * The JSON returned by GET /api/invites/by-token/[token] and stored in IndexedDB.
 * It contains only what one guest needs: never other guests, never owner data.
 */

export interface PayloadAsset {
  id: string;
  kind: "image" | "audio";
  /** Same-origin, token-scoped URL. */
  url: string;
  contentType: string;
}

export interface PayloadRsvp {
  status: RsvpStatus;
  partySize: number;
  message: string;
}

export type PayloadAudience =
  | { kind: "guest"; guestName: string; maxPartySize: number; rsvp: PayloadRsvp | null }
  | { kind: "common" };

export interface InvitePayload {
  payloadVersion: 1;
  invite: {
    id: string;
    version: number;
    displayMode: DisplayMode;
    spec: InviteSpec;
    /** Free plan shows a "Made with Regalia" watermark. */
    watermark: boolean;
  };
  audience: PayloadAudience;
  assets: PayloadAsset[];
}

const HEX6 = /^#[0-9a-f]{6}$/;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/**
 * Cheap structural check for data read back from IndexedDB or the network.
 * The server already validated the spec with Zod; this keeps the viewer bundle
 * free of Zod while still refusing garbage (and anything that could break rendering).
 */
export function isInvitePayload(value: unknown): value is InvitePayload {
  if (!isObject(value) || value.payloadVersion !== 1) return false;
  const { invite, audience, assets } = value;
  if (!isObject(invite) || !isObject(audience) || !Array.isArray(assets)) return false;
  if (typeof invite.id !== "string" || typeof invite.version !== "number") return false;
  if (invite.displayMode !== "animated" && invite.displayMode !== "static") return false;
  if (typeof invite.watermark !== "boolean") return false;

  const spec = invite.spec;
  if (!isObject(spec) || spec.schemaVersion !== 1) return false;
  const palette = spec.palette;
  if (!isObject(palette)) return false;
  for (const key of ["background", "surface", "accent", "text"]) {
    if (typeof palette[key] !== "string" || !HEX6.test(palette[key] as string)) return false;
  }
  if (typeof spec.template !== "string" || typeof spec.typography !== "string") return false;
  if (typeof spec.headline !== "string" || typeof spec.greetingTemplate !== "string") return false;
  if (!Array.isArray(spec.hosts) || !spec.hosts.every((h) => typeof h === "string")) return false;
  if (!Array.isArray(spec.events) || spec.events.length === 0) return false;
  if (!isObject(spec.animation) || typeof spec.animation.preset !== "string") return false;

  if (audience.kind === "guest") {
    if (typeof audience.guestName !== "string" || typeof audience.maxPartySize !== "number") return false;
  } else if (audience.kind !== "common") {
    return false;
  }
  return assets.every(
    (a) => isObject(a) && typeof a.id === "string" && typeof a.url === "string" && (a.kind === "image" || a.kind === "audio"),
  );
}
