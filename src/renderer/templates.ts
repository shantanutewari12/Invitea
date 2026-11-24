import type { CSSProperties } from "react";

import type { TemplateId, TypographyId } from "@/lib/spec/constants";
import type { Palette } from "@/lib/spec/contrast";

/** Visual identity of each template. Colours come from the spec palette; this is structure. */
export interface TemplateStyle {
  frame: "arch" | "double" | "soft-arch";
  ornament: "lotus" | "diamond" | "vine" | "crescent";
  /** Letter-spacing class for the eyebrow label. */
  eyebrowTracking: string;
}

export const TEMPLATE_STYLES: Record<TemplateId, TemplateStyle> = {
  royal_ivory: { frame: "arch", ornament: "lotus", eyebrowTracking: "tracking-[0.28em]" },
  midnight_gold: { frame: "double", ornament: "crescent", eyebrowTracking: "tracking-[0.34em]" },
  rose_regal: { frame: "soft-arch", ornament: "vine", eyebrowTracking: "tracking-[0.24em]" },
  emerald_palace: { frame: "arch", ornament: "diamond", eyebrowTracking: "tracking-[0.3em]" },
};

/** Subtle repeating background per template (pure CSS, no images to download). */
export function templatePattern(template: TemplateId): string {
  const dot = "color-mix(in srgb, var(--inv-accent) 20%, transparent)";
  switch (template) {
    case "royal_ivory":
      return `radial-gradient(circle at 1px 1px, ${dot} 1px, transparent 0)`;
    case "midnight_gold":
      return `radial-gradient(circle at 20% 30%, ${dot} 1px, transparent 1.5px), radial-gradient(circle at 70% 65%, ${dot} 1px, transparent 1.5px)`;
    case "rose_regal":
      return `repeating-linear-gradient(135deg, transparent 0 14px, color-mix(in srgb, var(--inv-accent) 8%, transparent) 14px 15px)`;
    case "emerald_palace":
      return `linear-gradient(45deg, color-mix(in srgb, var(--inv-accent) 9%, transparent) 25%, transparent 25% 75%, color-mix(in srgb, var(--inv-accent) 9%, transparent) 75%), linear-gradient(45deg, color-mix(in srgb, var(--inv-accent) 9%, transparent) 25%, transparent 25% 75%, color-mix(in srgb, var(--inv-accent) 9%, transparent) 75%)`;
  }
}

export function templatePatternSize(template: TemplateId): string {
  switch (template) {
    case "royal_ivory":
      return "22px 22px";
    case "midnight_gold":
      return "70px 70px, 90px 90px";
    case "rose_regal":
      return "auto";
    case "emerald_palace":
      return "28px 28px, 28px 28px";
  }
}

export function templatePatternPosition(template: TemplateId): string | undefined {
  return template === "emerald_palace" ? "0 0, 14px 14px" : undefined;
}

/** Inline CSS variables that carry the palette into Tailwind's `inv-*` colours. */
export function paletteVars(palette: Palette): CSSProperties {
  return {
    "--inv-bg": palette.background,
    "--inv-surface": palette.surface,
    "--inv-accent": palette.accent,
    "--inv-text": palette.text,
  } as CSSProperties;
}

export function displayFontClass(typography: TypographyId): string {
  return typography === "serif_modern" ? "font-modern" : "font-display";
}
