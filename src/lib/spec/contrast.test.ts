import { describe, expect, it } from "vitest";

import { TEMPLATE_IDS } from "./constants";
import {
  checkPalette,
  contrastRatio,
  ensureAccessiblePalette,
  isHexColor,
  normalizeHex,
  relativeLuminance,
  TEMPLATE_PALETTES,
} from "./contrast";

describe("contrast math", () => {
  it("matches the WCAG reference values", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
    // symmetric
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(contrastRatio("#000000", "#ffffff"), 5);
  });

  it("validates and normalises hex colours", () => {
    expect(isHexColor("#abc")).toBe(true);
    expect(isHexColor("#AABBCC")).toBe(true);
    expect(isHexColor("red")).toBe(false);
    expect(isHexColor("#abcd")).toBe(false);
    expect(isHexColor("#gggggg")).toBe(false);
    expect(isHexColor("javascript:alert(1)")).toBe(false);
    expect(isHexColor(123)).toBe(false);
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("#AABBCC")).toBe("#aabbcc");
  });
});

describe("template palettes", () => {
  it.each(TEMPLATE_IDS)("%s default palette passes WCAG AA", (template) => {
    const result = checkPalette(TEMPLATE_PALETTES[template]);
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe("ensureAccessiblePalette", () => {
  it("keeps an accessible custom palette (normalised)", () => {
    const result = ensureAccessiblePalette(
      { background: "#FFF", surface: "#FFFFFF", accent: "#7A5A1A", text: "#111" },
      "royal_ivory",
    );
    expect(result.usedFallback).toBe(false);
    expect(result.palette).toEqual({
      background: "#ffffff",
      surface: "#ffffff",
      accent: "#7a5a1a",
      text: "#111111",
    });
  });

  it("falls back to the template palette when contrast is too low", () => {
    const result = ensureAccessiblePalette(
      { background: "#ffffff", surface: "#fafafa", accent: "#ffffff", text: "#eeeeee" },
      "midnight_gold",
    );
    expect(result.usedFallback).toBe(true);
    expect(result.palette).toEqual(TEMPLATE_PALETTES.midnight_gold);
    expect(result.failures).toContain("text/background");
  });

  it("falls back on invalid hex or missing keys", () => {
    expect(ensureAccessiblePalette({ background: "red" }, "rose_regal").palette).toEqual(TEMPLATE_PALETTES.rose_regal);
    expect(ensureAccessiblePalette(null, "emerald_palace").usedFallback).toBe(true);
    expect(
      ensureAccessiblePalette(
        { background: "#fff", surface: "#fff", accent: "url(javascript:1)", text: "#000" },
        "royal_ivory",
      ).usedFallback,
    ).toBe(true);
  });
});
