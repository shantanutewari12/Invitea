import { eventTypeDefaults, fmt, greeting } from "@/copy/en";

import { TEMPLATE_PALETTES } from "./contrast";
import { DEFAULT_TEMPLATE_BY_EVENT } from "./designs";
import {
  type AnimationPresetId,
  type EventType,
  SPEC_SCHEMA_VERSION,
} from "./constants";
import type { GenerateInviteInput, InviteSpec, LlmStyle } from "./schema";
import { localDateTimeToIso } from "./time";

export { DEFAULT_TEMPLATE_BY_EVENT };

export const DEFAULT_ANIMATION_BY_EVENT: Record<EventType, AnimationPresetId> = {
  wedding: "gate_open",
  birthday: "gold_shimmer",
  anniversary: "diya_glow",
  baby_shower: "petals_fall",
  naming_ceremony: "name_typewriter",
  first_haircut: "diya_glow",
  housewarming: "diya_glow",
  custom: "envelope_reveal",
};

/** "A", "A & B", "A, B & C". */
export function formatHostNames(hosts: readonly string[]): string {
  const names = hosts.map((h) => h.trim()).filter(Boolean);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

/** The deterministic default template used whenever the LLM fails or is unavailable. */
export function buildDefaultStyle(eventType: EventType, hosts: readonly string[]): LlmStyle {
  const defaults = eventTypeDefaults[eventType];
  const template = DEFAULT_TEMPLATE_BY_EVENT[eventType];
  const vars = { host_names: formatHostNames(hosts) };
  return {
    template,
    palette: { ...TEMPLATE_PALETTES[template] },
    typography: "serif_classic",
    animation: { preset: DEFAULT_ANIMATION_BY_EVENT[eventType], intensity: "subtle" },
    headline: fmt(defaults.headline, vars),
    subheadline: fmt(defaults.subheadline, vars),
    greetingTemplate: greeting.default,
    closingNote: defaults.closingNote,
  };
}

export class InvalidEventTimeError extends Error {
  constructor(public readonly index: number) {
    super(`Event ${index + 1} has an invalid date or time zone`);
    this.name = "InvalidEventTimeError";
  }
}

/**
 * Merge host-provided facts (names, events) with generated style and copy into
 * a full spec. Events, venues, addresses and links are never taken from the LLM.
 */
export function buildInviteSpec(input: GenerateInviteInput, style: LlmStyle): InviteSpec {
  const eventTitle = eventTypeDefaults[input.eventType].eventTitle;
  const events = input.events.map((event, index) => {
    const startsAt = localDateTimeToIso(event.startsAtLocal, event.timezone);
    if (!startsAt) throw new InvalidEventTimeError(index);
    return {
      title: event.title.trim() || eventTitle,
      startsAt,
      timezone: event.timezone,
      venueName: event.venueName,
      address: event.address,
      mapUrl: event.mapUrl,
    };
  });

  return {
    schemaVersion: SPEC_SCHEMA_VERSION,
    eventType: input.eventType,
    displayMode: input.displayMode,
    template: style.template,
    palette: style.palette,
    typography: style.typography,
    animation: style.animation,
    hosts: input.hosts,
    headline: style.headline,
    subheadline: style.subheadline,
    greetingTemplate: style.greetingTemplate,
    events,
    closingNote: style.closingNote,
    music: null,
    image: null,
  };
}
