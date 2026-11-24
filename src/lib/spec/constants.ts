/**
 * Whitelists and constants for the invite spec. This file has NO imports so it
 * can be used from the lightweight guest viewer bundle (no Zod).
 */

export const SPEC_SCHEMA_VERSION = 1 as const;

export const EVENT_TYPES = [
  "wedding",
  "birthday",
  "anniversary",
  "baby_shower",
  "naming_ceremony",
  "first_haircut",
  "housewarming",
  "custom",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const DISPLAY_MODES = ["animated", "static"] as const;
export type DisplayMode = (typeof DISPLAY_MODES)[number];

export const TEMPLATE_IDS = ["royal_ivory", "midnight_gold", "rose_regal", "emerald_palace"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const TYPOGRAPHY_IDS = ["serif_classic", "serif_modern"] as const;
export type TypographyId = (typeof TYPOGRAPHY_IDS)[number];

export const ANIMATION_PRESET_IDS = [
  "gate_open",
  "envelope_reveal",
  "petals_fall",
  "diya_glow",
  "name_typewriter",
  "gold_shimmer",
] as const;
export type AnimationPresetId = (typeof ANIMATION_PRESET_IDS)[number];

export const ANIMATION_INTENSITIES = ["subtle", "rich"] as const;
export type AnimationIntensity = (typeof ANIMATION_INTENSITIES)[number];

export const RSVP_STATUSES = ["yes", "no", "maybe"] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

/** The only placeholder allowed in the greeting template. */
export const GUEST_NAME_PLACEHOLDER = "{guest_name}";

export const LIMITS = {
  hostName: 60,
  hostsMax: 4,
  headline: 120,
  subheadline: 220,
  greeting: 160,
  closingNote: 280,
  eventTitle: 80,
  venueName: 120,
  address: 240,
  eventsMax: 6,
  musicTitle: 80,
  imageAlt: 120,
  guestName: 80,
  rsvpMessage: 500,
} as const;
