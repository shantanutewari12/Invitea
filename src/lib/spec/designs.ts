import type { EventType, TemplateId } from "./constants";
import type { Palette } from "./contrast";

/**
 * The look of every invitation template, as plain data (no React), so the host app, the guest
 * viewer and the contrast tests all share it. Names and blurbs live in copy/en.ts (`templates`).
 * Illustrations, corner decorations and floating decorations are drawn in renderer/book/art.tsx.
 */

export type MotifId =
  | "lotus" | "elephants" | "mandap" | "roses"
  | "balloons" | "burst" | "cake"
  | "bouquet" | "rings" | "hearts"
  | "teddy" | "clouds" | "toys"
  | "cradle" | "lotusFeet" | "moon"
  | "kalash" | "sun" | "marigold"
  | "house" | "keys" | "rangoli"
  | "monogram" | "bunting" | "wreath";

/** How the closed card (cover) is laid out. */
export type CoverLayout = "arch" | "frame" | "band" | "ring";
export type CornerId = "floral" | "jali" | "confetti" | "scallop" | "vine" | "lines";
export type AmbientId = "none" | "sparkle" | "petals" | "confetti" | "balloons" | "hearts" | "clouds" | "stars" | "leaves";
export type TitleFont = "display" | "modern" | "script" | "sans";
export type PagePattern = "none" | "dots" | "polka" | "stripes" | "diamonds" | "gingham";
export type PhotoFrame = "arch" | "circle" | "double" | "soft-arch";

export interface DesignColors {
  cover: string;
  foil: string;
  coverText: string;
  paper: string;
  ink: string;
  accent: string;
  btn: string;
  btnText: string;
}

export interface CardDesign {
  id: TemplateId;
  category: EventType;
  motif: MotifId;
  layout: CoverLayout;
  corner: CornerId;
  ambient: AmbientId;
  /** Colours of the floating decorations. */
  ambientColors: string[];
  pattern: PagePattern;
  titleFont: TitleFont;
  frame: PhotoFrame;
  colors: DesignColors;
}

const c = (cover: string, foil: string, coverText: string, paper: string, ink: string, accent: string, btn: string, btnText: string): DesignColors => ({
  cover, foil, coverText, paper, ink, accent, btn, btnText,
});

export const DESIGNS: Record<TemplateId, CardDesign> = {
  // ── Wedding ────────────────────────────────────────────────────────────────
  royal_ivory: {
    id: "royal_ivory", category: "wedding", motif: "lotus", layout: "arch", corner: "floral", ambient: "sparkle",
    ambientColors: ["#d4a24c", "#f0c36a"], pattern: "dots", titleFont: "display", frame: "arch",
    colors: c("#f3e7cf", "#b8862f", "#5a3a1a", "#fbf3e4", "#2b1b24", "#8a6420", "#7a1f3d", "#fbf3e4"),
  },
  midnight_gold: {
    id: "midnight_gold", category: "wedding", motif: "elephants", layout: "frame", corner: "jali", ambient: "sparkle",
    ambientColors: ["#d4a24c", "#f3dfa8"], pattern: "diamonds", titleFont: "display", frame: "double",
    colors: c("#7a1f3d", "#d4a24c", "#f3dfa8", "#fbf3e4", "#2b1b24", "#8a6420", "#7a1f3d", "#fbf3e4"),
  },
  emerald_palace: {
    id: "emerald_palace", category: "wedding", motif: "mandap", layout: "arch", corner: "vine", ambient: "petals",
    ambientColors: ["#ff9f1c", "#ffbf47", "#e85d04"], pattern: "dots", titleFont: "modern", frame: "arch",
    colors: c("#0f4a3f", "#e3c275", "#f8f1dc", "#f6f3e6", "#10302a", "#7a5a12", "#0f4a3f", "#f8f1dc"),
  },
  rose_regal: {
    id: "rose_regal", category: "wedding", motif: "roses", layout: "ring", corner: "floral", ambient: "petals",
    ambientColors: ["#f08da4", "#e05a7a", "#ffc2d1"], pattern: "stripes", titleFont: "script", frame: "soft-arch",
    colors: c("#b43a5c", "#ffd9a0", "#fff3ee", "#fff4f4", "#3b1620", "#8e2646", "#8e2646", "#fff4f4"),
  },

  // ── Birthday ───────────────────────────────────────────────────────────────
  bday_balloons: {
    id: "bday_balloons", category: "birthday", motif: "balloons", layout: "band", corner: "confetti", ambient: "balloons",
    ambientColors: ["#ff6fa5", "#ffc93c", "#4cc9f0", "#7bd88f"], pattern: "polka", titleFont: "sans", frame: "circle",
    colors: c("#ff6fa5", "#ffc93c", "#2b1b3d", "#fff8e8", "#2b1b3d", "#8a2a5a", "#ff6fa5", "#2b1b3d"),
  },
  bday_confetti: {
    id: "bday_confetti", category: "birthday", motif: "burst", layout: "frame", corner: "confetti", ambient: "confetti",
    ambientColors: ["#ffd23f", "#ff6b6b", "#4cc9f0", "#9b5de5", "#5eead4"], pattern: "stripes", titleFont: "modern", frame: "double",
    colors: c("#6a4bd6", "#ffd23f", "#ffffff", "#f4f0ff", "#25134f", "#5a2fc2", "#6a4bd6", "#ffffff"),
  },
  bday_cake: {
    id: "bday_cake", category: "birthday", motif: "cake", layout: "ring", corner: "scallop", ambient: "stars",
    ambientColors: ["#ffd23f", "#ff8fab", "#4cc9f0"], pattern: "gingham", titleFont: "script", frame: "circle",
    colors: c("#3cb4c8", "#fff2a8", "#08323b", "#fffaf0", "#1d3b44", "#0e6a7a", "#0e6a7a", "#ffffff"),
  },

  // ── Anniversary ────────────────────────────────────────────────────────────
  anniv_roses: {
    id: "anniv_roses", category: "anniversary", motif: "bouquet", layout: "arch", corner: "floral", ambient: "petals",
    ambientColors: ["#c9184a", "#ff758f", "#a4133c"], pattern: "none", titleFont: "modern", frame: "arch",
    colors: c("#5b0f22", "#e6b86a", "#ffe9d6", "#fdf4ee", "#3a0f1c", "#8a1f3d", "#8a1f3d", "#fdf4ee"),
  },
  anniv_rings: {
    id: "anniv_rings", category: "anniversary", motif: "rings", layout: "ring", corner: "lines", ambient: "sparkle",
    ambientColors: ["#e0b85c", "#f6efd9"], pattern: "diamonds", titleFont: "display", frame: "double",
    colors: c("#1d2a44", "#e0b85c", "#f6efd9", "#f7f3ea", "#1d2a44", "#8a6420", "#1d2a44", "#f6efd9"),
  },
  anniv_hearts: {
    id: "anniv_hearts", category: "anniversary", motif: "hearts", layout: "band", corner: "vine", ambient: "hearts",
    ambientColors: ["#e5567a", "#ff8fa3", "#c9184a"], pattern: "dots", titleFont: "script", frame: "soft-arch",
    colors: c("#f1b5c0", "#b8862f", "#5a1730", "#fff6f6", "#4a1426", "#9a2f55", "#9a2f55", "#ffffff"),
  },

  // ── Baby shower ────────────────────────────────────────────────────────────
  baby_teddy: {
    id: "baby_teddy", category: "baby_shower", motif: "teddy", layout: "ring", corner: "scallop", ambient: "hearts",
    ambientColors: ["#f4a6b8", "#ffd6a5", "#fff"], pattern: "dots", titleFont: "script", frame: "circle",
    colors: c("#f6c9a0", "#ffffff", "#5a3a22", "#fff9f1", "#4a3322", "#8a5a2a", "#8a5a2a", "#ffffff"),
  },
  baby_clouds: {
    id: "baby_clouds", category: "baby_shower", motif: "clouds", layout: "band", corner: "scallop", ambient: "clouds",
    ambientColors: ["#ffffff"], pattern: "gingham", titleFont: "sans", frame: "circle",
    colors: c("#9fd3f0", "#fff6c2", "#17405a", "#f4fbff", "#17405a", "#2a6a94", "#2a6a94", "#ffffff"),
  },
  baby_toys: {
    id: "baby_toys", category: "baby_shower", motif: "toys", layout: "frame", corner: "confetti", ambient: "balloons",
    ambientColors: ["#ff7a8a", "#ffd36b", "#7bc6f0", "#9be0a8"], pattern: "polka", titleFont: "sans", frame: "double",
    colors: c("#ffd36b", "#ff7a8a", "#3d2a00", "#fffcf0", "#3d2f12", "#8a5a00", "#ff7a8a", "#3d2a00"),
  },

  // ── Naming ceremony ────────────────────────────────────────────────────────
  naming_cradle: {
    id: "naming_cradle", category: "naming_ceremony", motif: "cradle", layout: "arch", corner: "floral", ambient: "petals",
    ambientColors: ["#ff9f1c", "#ffbf47", "#f08da4"], pattern: "dots", titleFont: "display", frame: "arch",
    colors: c("#d9822b", "#fff1c9", "#3d1a05", "#fff7e8", "#3d1a05", "#8a3d0a", "#8a3d0a", "#ffffff"),
  },
  naming_lotus: {
    id: "naming_lotus", category: "naming_ceremony", motif: "lotusFeet", layout: "ring", corner: "vine", ambient: "sparkle",
    ambientColors: ["#d4a24c", "#f4cfd8"], pattern: "stripes", titleFont: "script", frame: "soft-arch",
    colors: c("#f4cfd8", "#b8862f", "#5a1f3a", "#fff7f8", "#4a1f33", "#8a2f5a", "#8a2f5a", "#ffffff"),
  },
  naming_moon: {
    id: "naming_moon", category: "naming_ceremony", motif: "moon", layout: "band", corner: "jali", ambient: "stars",
    ambientColors: ["#ffd98a", "#ffffff"], pattern: "diamonds", titleFont: "modern", frame: "circle",
    colors: c("#2a3a7a", "#ffd98a", "#fff4d6", "#f3f4fb", "#1d2552", "#3a4aa0", "#2a3a7a", "#fff4d6"),
  },

  // ── First haircut (Mundan) ────────────────────────────────────────────────
  mundan_kalash: {
    id: "mundan_kalash", category: "first_haircut", motif: "kalash", layout: "arch", corner: "floral", ambient: "sparkle",
    ambientColors: ["#ffd27a", "#ff9f1c"], pattern: "dots", titleFont: "display", frame: "arch",
    colors: c("#c4501a", "#ffd27a", "#fff3dc", "#fff6e6", "#3a1a0a", "#9a3a0a", "#9a3a0a", "#ffffff"),
  },
  mundan_sun: {
    id: "mundan_sun", category: "first_haircut", motif: "sun", layout: "ring", corner: "jali", ambient: "sparkle",
    ambientColors: ["#f0b429", "#ff8c42"], pattern: "diamonds", titleFont: "modern", frame: "circle",
    colors: c("#f0b429", "#8a2a0a", "#3a1a00", "#fffaf0", "#3a1a00", "#8a3a00", "#8a3a00", "#ffffff"),
  },
  mundan_marigold: {
    id: "mundan_marigold", category: "first_haircut", motif: "marigold", layout: "frame", corner: "vine", ambient: "petals",
    ambientColors: ["#ff9f1c", "#ffb703", "#e85d04"], pattern: "stripes", titleFont: "display", frame: "double",
    colors: c("#2d6a4f", "#ffb703", "#fff4d6", "#fbf8ec", "#1b3a2a", "#8a5a00", "#2d6a4f", "#fff4d6"),
  },

  // ── Housewarming ──────────────────────────────────────────────────────────
  house_griha: {
    id: "house_griha", category: "housewarming", motif: "house", layout: "arch", corner: "floral", ambient: "sparkle",
    ambientColors: ["#f0c36a", "#ff9f1c"], pattern: "dots", titleFont: "display", frame: "arch",
    colors: c("#a85a1e", "#f0c36a", "#fff1d6", "#fff6e6", "#3a2414", "#8a4a14", "#a85a1e", "#fff6ea"),
  },
  house_keys: {
    id: "house_keys", category: "housewarming", motif: "keys", layout: "band", corner: "lines", ambient: "leaves",
    ambientColors: ["#4caf7a", "#7bd88f", "#2f8f6b"], pattern: "gingham", titleFont: "sans", frame: "soft-arch",
    colors: c("#1f6f78", "#ffd17a", "#f0fbfa", "#f3fafa", "#12373b", "#0f5f68", "#1f6f78", "#f0fbfa"),
  },
  house_rangoli: {
    id: "house_rangoli", category: "housewarming", motif: "rangoli", layout: "ring", corner: "jali", ambient: "petals",
    ambientColors: ["#ff9f1c", "#e5567a", "#9b5de5", "#4cc9f0"], pattern: "diamonds", titleFont: "display", frame: "double",
    colors: c("#8b2a6b", "#ffc43d", "#fff0d6", "#fff6ec", "#3a1030", "#8b2a6b", "#8b2a6b", "#fff6ec"),
  },

  // ── Custom ────────────────────────────────────────────────────────────────
  custom_monogram: {
    id: "custom_monogram", category: "custom", motif: "monogram", layout: "frame", corner: "lines", ambient: "none",
    ambientColors: [], pattern: "none", titleFont: "modern", frame: "double",
    colors: c("#2b2b33", "#d4b06a", "#f5f1e8", "#fafaf7", "#22222a", "#6a5320", "#2b2b33", "#f5f1e8"),
  },
  custom_festive: {
    id: "custom_festive", category: "custom", motif: "bunting", layout: "band", corner: "confetti", ambient: "confetti",
    ambientColors: ["#ffd43b", "#ff6b9d", "#4cc9f0", "#9be0a8"], pattern: "polka", titleFont: "sans", frame: "circle",
    colors: c("#d6336c", "#ffd43b", "#ffffff", "#fff5f8", "#3d0a1f", "#a61e4d", "#d6336c", "#ffffff"),
  },
  custom_botanical: {
    id: "custom_botanical", category: "custom", motif: "wreath", layout: "arch", corner: "vine", ambient: "leaves",
    ambientColors: ["#6a9c78", "#a7c4a0", "#3f6b4e"], pattern: "none", titleFont: "display", frame: "soft-arch",
    colors: c("#3f6b4e", "#f1e3b3", "#f7f6ea", "#f8faf3", "#20382a", "#3b6a4a", "#3f6b4e", "#f7f6ea"),
  },
};

export const DEFAULT_TEMPLATE_BY_EVENT: Record<EventType, TemplateId> = {
  wedding: "midnight_gold",
  birthday: "bday_balloons",
  anniversary: "anniv_roses",
  baby_shower: "baby_teddy",
  naming_ceremony: "naming_cradle",
  first_haircut: "mundan_kalash",
  housewarming: "house_griha",
  custom: "custom_monogram",
};

/** The templates offered for an event type. */
export function designsFor(eventType: EventType): CardDesign[] {
  return Object.values(DESIGNS).filter((d) => d.category === eventType);
}

/**
 * The design to draw. A template from another occasion (older invitations used one shared set)
 * falls back to the occasion's default, so every invitation always looks right for its event.
 */
export function designFor(eventType: EventType, template: TemplateId): CardDesign {
  const d = DESIGNS[template];
  return d && d.category === eventType ? d : DESIGNS[DEFAULT_TEMPLATE_BY_EVENT[eventType]];
}

/** The scroll-layout palette that goes with a design (also what the editor's colour fields start from). */
export function paletteOf(design: CardDesign): Palette {
  const { paper, ink, accent } = design.colors;
  return { background: paper, surface: paper, accent, text: ink };
}

/** CSS variables for the book (cover, paper, desk behind it, buttons). */
export function designVars(design: CardDesign): Record<string, string> {
  const k = design.colors;
  return {
    "--cover": k.cover,
    "--foil": k.foil,
    "--cover-text": k.coverText,
    "--paper": k.paper,
    "--ink": k.ink,
    "--muted-ink": `color-mix(in srgb, ${k.ink} 72%, ${k.paper})`,
    "--accent-text": k.accent,
    "--btn": k.btn,
    "--btn-text": k.btnText,
    "--desk-from": `color-mix(in srgb, ${k.cover} 52%, #000)`,
    "--desk-to": `color-mix(in srgb, ${k.cover} 22%, #000)`,
    "--desk-text": "#fff1d6",
  };
}
