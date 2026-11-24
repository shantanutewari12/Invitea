import { z } from "zod";

import {
  ANIMATION_INTENSITIES,
  ANIMATION_PRESET_IDS,
  DISPLAY_MODES,
  EVENT_TYPES,
  LIMITS,
  RSVP_STATUSES,
  SPEC_SCHEMA_VERSION,
  TEMPLATE_IDS,
  TYPOGRAPHY_IDS,
} from "./constants";
import { isValidTimeZone } from "./time";

const HEX6 = /^#[0-9a-f]{6}$/;
const HEX3_OR_6 = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const requiredText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max);

/** Spec palette: normalised 6-digit lowercase hex (what is stored and rendered). */
export const paletteSchema = z.object({
  background: z.string().regex(HEX6),
  surface: z.string().regex(HEX6),
  accent: z.string().regex(HEX6),
  text: z.string().regex(HEX6),
});

/** LLM palette: 3 or 6 digit hex; normalised and contrast-checked afterwards in code. */
export const llmPaletteSchema = z.object({
  background: z.string().regex(HEX3_OR_6),
  surface: z.string().regex(HEX3_OR_6),
  accent: z.string().regex(HEX3_OR_6),
  text: z.string().regex(HEX3_OR_6),
});

const animationSchema = z.object({
  preset: z.enum(ANIMATION_PRESET_IDS),
  intensity: z.enum(ANIMATION_INTENSITIES),
});

/** Map links are typed by the host, never by the LLM. Only https links are kept. */
export const mapUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    if (value === "") return true;
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "Map link must be an https URL");

export const inviteEventSchema = z.object({
  id: z.uuid().optional(),
  title: requiredText(LIMITS.eventTitle),
  startsAt: z.iso.datetime({ offset: true }),
  timezone: z.string().refine(isValidTimeZone, "Unknown time zone"),
  venueName: optionalText(LIMITS.venueName),
  address: optionalText(LIMITS.address),
  mapUrl: mapUrlSchema,
});

const musicSchema = z.object({
  assetId: z.uuid(),
  title: requiredText(LIMITS.musicTitle),
});

const imageSchema = z.object({
  assetId: z.uuid(),
  alt: optionalText(LIMITS.imageAlt),
});

export const inviteSpecSchema = z.object({
  schemaVersion: z.literal(SPEC_SCHEMA_VERSION),
  eventType: z.enum(EVENT_TYPES),
  displayMode: z.enum(DISPLAY_MODES),
  template: z.enum(TEMPLATE_IDS),
  palette: paletteSchema,
  typography: z.enum(TYPOGRAPHY_IDS),
  animation: animationSchema,
  hosts: z.array(requiredText(LIMITS.hostName)).min(1).max(LIMITS.hostsMax),
  headline: requiredText(LIMITS.headline),
  subheadline: optionalText(LIMITS.subheadline),
  greetingTemplate: requiredText(LIMITS.greeting),
  events: z.array(inviteEventSchema).min(1).max(LIMITS.eventsMax),
  closingNote: optionalText(LIMITS.closingNote),
  music: musicSchema.nullable(),
  /** Optional hero image (an uploaded asset). Additive to schemaVersion 1. */
  image: imageSchema.nullable().default(null),
});

export type InviteSpec = z.infer<typeof inviteSpecSchema>;
export type InviteEvent = z.infer<typeof inviteEventSchema>;

/**
 * What the LLM is allowed to produce: style choices and copy only. Events,
 * venues, addresses and links always come from the host, never the model.
 */
export const llmStyleSchema = z.object({
  template: z.enum(TEMPLATE_IDS),
  palette: llmPaletteSchema,
  typography: z.enum(TYPOGRAPHY_IDS),
  animation: animationSchema,
  headline: requiredText(LIMITS.headline),
  subheadline: optionalText(LIMITS.subheadline),
  greetingTemplate: requiredText(LIMITS.greeting),
  closingNote: optionalText(LIMITS.closingNote),
});

export type LlmStyle = z.infer<typeof llmStyleSchema>;

/** Input for POST /api/ai/generate-invite. */
export const hostEventInputSchema = z.object({
  title: optionalText(LIMITS.eventTitle).default(""),
  /** Wall-clock time from a datetime-local input, e.g. "2026-12-05T18:30". */
  startsAtLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/),
  timezone: z.string().refine(isValidTimeZone, "Unknown time zone").default("Asia/Kolkata"),
  venueName: optionalText(LIMITS.venueName).default(""),
  address: optionalText(LIMITS.address).default(""),
  mapUrl: mapUrlSchema.default(""),
});

export const generateInviteInputSchema = z.object({
  eventType: z.enum(EVENT_TYPES),
  prompt: z.string().trim().max(600).default(""),
  hosts: z.array(requiredText(LIMITS.hostName)).min(1).max(LIMITS.hostsMax),
  events: z.array(hostEventInputSchema).min(1).max(LIMITS.eventsMax),
  displayMode: z.enum(DISPLAY_MODES).default("animated"),
});

export type HostEventInput = z.infer<typeof hostEventInputSchema>;
export type GenerateInviteInput = z.infer<typeof generateInviteInputSchema>;

/** RSVP submission (guest -> server). */
export const rsvpSubmissionSchema = z.object({
  status: z.enum(RSVP_STATUSES),
  partySize: z.number().int().min(0).max(50),
  message: z.string().trim().max(LIMITS.rsvpMessage).default(""),
  /** ISO time the guest tapped send (may be well before the server receives it). */
  clientSubmittedAt: z.iso.datetime({ offset: true }),
});

export type RsvpSubmission = z.infer<typeof rsvpSubmissionSchema>;

export const guestNameSchema = requiredText(LIMITS.guestName);
