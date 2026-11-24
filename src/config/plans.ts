/**
 * Plans, prices and limits live here, never hardcoded in components or routes.
 * Amounts are in the smallest currency unit (paise for INR).
 */

export const CURRENCY = "INR" as const;

export type PlanId = "free" | "paid";

export interface PlanConfig {
  id: PlanId;
  /** Maximum guests per invite. `null` means unlimited. */
  guestCap: number | null;
  watermark: boolean;
  customSlug: boolean;
  /** Price per invite in paise. 0 for the free plan. */
  priceMinor: number;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    guestCap: 10,
    watermark: true,
    customSlug: false,
    priceMinor: 0,
  },
  paid: {
    id: "paid",
    guestCap: null,
    watermark: false,
    customSlug: true,
    priceMinor: 49900,
  },
};

/** AI generation limits, enforced per signed-in user. */
export const AI_LIMITS = {
  perHour: 10,
  perDay: 30,
} as const;

/** Public endpoint rate limits (per client IP, fixed window). */
export const RATE_LIMITS = {
  tokenLookup: { windowSeconds: 60, max: 60 },
  rsvp: { windowSeconds: 60, max: 20 },
  assets: { windowSeconds: 60, max: 120 },
  upload: { windowSeconds: 60, max: 30 },
} as const;

export const UPLOAD_LIMITS = {
  /** Client resizes to this longest edge and encodes WebP before upload. */
  imageMaxDimension: 1600,
  imageMaxBytes: 2 * 1024 * 1024,
  audioMaxBytes: 5 * 1024 * 1024,
  imageTypes: ["image/webp"] as readonly string[],
  audioTypes: ["audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg"] as readonly string[],
} as const;

export const TOKEN_LENGTH = 21;
export const MAX_PARTY_SIZE_DEFAULT = 4;

export function getPlan(id: PlanId): PlanConfig {
  return PLANS[id];
}

export function formatPriceInr(priceMinor: number): string {
  const rupees = priceMinor / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
  }).format(rupees);
}
