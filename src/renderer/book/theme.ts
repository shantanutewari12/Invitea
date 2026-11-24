import type { CSSProperties } from "react";

import type { EventType, TemplateId } from "@/lib/spec/constants";

export type BookTheme = "wedding" | "ivory" | "birthday" | "baby" | "housewarming";

/** Theme from the invite: the event type picks the family, the ivory template picks the light cover. */
export function themeFor(spec: { eventType: EventType; template: TemplateId }): BookTheme {
  switch (spec.eventType) {
    case "birthday":
    case "first_haircut":
      return "birthday";
    case "baby_shower":
    case "naming_ceremony":
      return "baby";
    case "housewarming":
      return "housewarming";
    default:
      return spec.template === "royal_ivory" ? "ivory" : "wedding";
  }
}

/** Points the renderer's `inv-*` colours at the theme's CSS variables. */
export const themeVars: CSSProperties = {
  "--inv-bg": "var(--paper)",
  "--inv-surface": "var(--paper)",
  "--inv-accent": "var(--accent-text)",
  "--inv-text": "var(--ink)",
} as CSSProperties;

/** The icon bouncing in the loader. */
export type LoaderIcon = "card" | "cake" | "rattle" | "house";

export function loaderIconFor(eventType: EventType | undefined): LoaderIcon {
  switch (eventType) {
    case "birthday":
    case "first_haircut":
      return "cake";
    case "baby_shower":
    case "naming_ceremony":
      return "rattle";
    case "housewarming":
      return "house";
    default:
      return "card";
  }
}
