import type { TemplateId } from "./constants";

export interface Palette {
  background: string;
  surface: string;
  accent: string;
  text: string;
}

/** Default palette per template. All of these pass the checks below (see contrast.test.ts). */
export const TEMPLATE_PALETTES: Record<TemplateId, Palette> = {
  royal_ivory: { background: "#fbf6ea", surface: "#fffdf7", accent: "#8a6420", text: "#3a1420" },
  midnight_gold: { background: "#0f1b2d", surface: "#17263d", accent: "#e0b85c", text: "#f6efd9" },
  rose_regal: { background: "#fbedee", surface: "#fff8f8", accent: "#8e2646", text: "#3b1620" },
  emerald_palace: { background: "#0e2f29", surface: "#14403a", accent: "#e3c275", text: "#f8f1dc" },
};

/** WCAG AA: 4.5:1 for normal text, 3:1 for large text and UI ornaments. */
export const CONTRAST_AA_TEXT = 4.5;
export const CONTRAST_AA_LARGE = 3;

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_RE.test(value);
}

/** Lowercase 6-digit form: "#ABC" -> "#aabbcc". */
export function normalizeHex(value: string): string {
  const v = value.toLowerCase();
  if (v.length === 4) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  return v;
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = normalizeHex(hex);
  return [
    Number.parseInt(n.slice(1, 3), 16),
    Number.parseInt(n.slice(3, 5), 16),
    Number.parseInt(n.slice(5, 7), 16),
  ];
}

/** Relative luminance as defined by WCAG 2.x. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export interface PaletteCheck {
  ok: boolean;
  failures: string[];
}

/**
 * Text must reach 4.5:1 on both background and surface. The accent colour is
 * used for headings and ornaments (large text / UI), so it needs 3:1 on both.
 */
export function checkPalette(palette: Palette): PaletteCheck {
  const failures: string[] = [];
  const check = (name: string, fg: string, bg: string, min: number) => {
    if (contrastRatio(fg, bg) < min) failures.push(name);
  };
  check("text/background", palette.text, palette.background, CONTRAST_AA_TEXT);
  check("text/surface", palette.text, palette.surface, CONTRAST_AA_TEXT);
  check("accent/background", palette.accent, palette.background, CONTRAST_AA_LARGE);
  check("accent/surface", palette.accent, palette.surface, CONTRAST_AA_LARGE);
  return { ok: failures.length === 0, failures };
}

export interface AccessiblePaletteResult {
  palette: Palette;
  /** True when the requested palette failed and the template default was used. */
  usedFallback: boolean;
  failures: string[];
}

/**
 * Returns the requested palette when it passes WCAG AA, otherwise the template's
 * default palette. Invalid hex values also trigger the fallback.
 */
export function ensureAccessiblePalette(
  requested: Partial<Record<keyof Palette, unknown>> | null | undefined,
  template: TemplateId,
): AccessiblePaletteResult {
  const fallback = TEMPLATE_PALETTES[template];
  const keys: (keyof Palette)[] = ["background", "surface", "accent", "text"];

  if (!requested || !keys.every((k) => isHexColor(requested[k]))) {
    return { palette: fallback, usedFallback: true, failures: ["invalid-hex"] };
  }

  const candidate: Palette = {
    background: normalizeHex(requested.background as string),
    surface: normalizeHex(requested.surface as string),
    accent: normalizeHex(requested.accent as string),
    text: normalizeHex(requested.text as string),
  };
  const result = checkPalette(candidate);
  if (!result.ok) {
    return { palette: fallback, usedFallback: true, failures: result.failures };
  }
  return { palette: candidate, usedFallback: false, failures: [] };
}
