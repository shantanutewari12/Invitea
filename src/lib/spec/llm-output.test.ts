import { describe, expect, it } from "vitest";

import { TEMPLATE_PALETTES } from "./contrast";
import { parseLlmStyle } from "./finalize";

const good = {
  template: "midnight_gold",
  palette: { background: "#0f1b2d", surface: "#17263d", accent: "#e0b85c", text: "#f6efd9" },
  typography: "serif_modern",
  animation: { preset: "petals_fall", intensity: "rich" },
  headline: "Aarav & Meera are getting married",
  subheadline: "Join us for a royal celebration",
  greetingTemplate: "Dear {guest_name}, you are warmly invited",
  closingNote: "Your presence will make our day.",
};

describe("parseLlmStyle", () => {
  it("accepts well-formed output", () => {
    const result = parseLlmStyle(good);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.style.template).toBe("midnight_gold");
      expect(result.warnings).toEqual([]);
    }
  });

  it("accepts a JSON string, including markdown code fences", () => {
    expect(parseLlmStyle(JSON.stringify(good)).ok).toBe(true);
    expect(parseLlmStyle("```json\n" + JSON.stringify(good) + "\n```").ok).toBe(true);
  });

  it.each([
    ["garbage text", "I'm sorry, I can't help with that."],
    ["truncated JSON", '{"template": "royal_ivory", "palette": {'],
    ["null", null],
    ["an array", [good]],
    ["a number", 42],
    ["missing fields", { template: "royal_ivory" }],
    ["unknown template id", { ...good, template: "../../etc/passwd" }],
    ["unknown animation id", { ...good, animation: { preset: "<script>", intensity: "rich" } }],
    ["unknown typography", { ...good, typography: "papyrus" }],
    ["bad hex", { ...good, palette: { ...good.palette, accent: "rgb(255,0,0)" } }],
    ["empty headline", { ...good, headline: "<b></b>" }],
    ["wrong types", { ...good, headline: 12345 }],
  ])("rejects malformed output: %s", (_name, raw) => {
    const result = parseLlmStyle(raw);
    expect(result.ok).toBe(false);
  });

  it("strips HTML and URLs from copy: the LLM can never inject links or scripts", () => {
    const result = parseLlmStyle({
      ...good,
      headline: 'Aarav <script>alert(1)</script> & Meera',
      subheadline: "RSVP at https://evil.example/phish or www.evil.example now javascript:alert(1)",
      closingNote: '<a href="https://evil.example">click</a> thank you',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const all = JSON.stringify(result.style);
      expect(all).not.toMatch(/<|>|https?:|www\.|javascript:/i);
      expect(result.style.headline).toContain("Aarav");
    }
  });

  it("ignores extra keys such as links, html or code", () => {
    const result = parseLlmStyle({ ...good, html: "<div>", css: "body{}", mapUrl: "https://evil.example", events: [{}] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.style).not.toHaveProperty("html");
      expect(result.style).not.toHaveProperty("mapUrl");
      expect(result.style).not.toHaveProperty("events");
    }
  });

  it("falls back to the template palette when contrast fails", () => {
    const result = parseLlmStyle({
      ...good,
      palette: { background: "#ffffff", surface: "#ffffff", accent: "#fefefe", text: "#fafafa" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.style.palette).toEqual(TEMPLATE_PALETTES.midnight_gold);
      expect(result.warnings.some((w) => w.startsWith("palette-fallback"))).toBe(true);
    }
  });

  it("normalises 3-digit hex colours", () => {
    const result = parseLlmStyle({ ...good, palette: { background: "#FFF", surface: "#FFF", accent: "#630", text: "#000" } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.style.palette.background).toBe("#ffffff");
  });

  it("restores a default greeting if {guest_name} is missing, and drops unknown placeholders", () => {
    const missing = parseLlmStyle({ ...good, greetingTemplate: "Welcome, all" });
    expect(missing.ok && missing.style.greetingTemplate.includes("{guest_name}")).toBe(true);
    const unknown = parseLlmStyle({ ...good, greetingTemplate: "Dear {guest_name} {host_phone}, {{x}}" });
    expect(unknown.ok).toBe(true);
    if (unknown.ok) expect(unknown.style.greetingTemplate).toBe("Dear {guest_name} ,");
  });
});
