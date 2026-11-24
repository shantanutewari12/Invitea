import { describe, expect, it } from "vitest";

import { buildDefaultStyle, buildInviteSpec, InvalidEventTimeError } from "./defaults";
import { EVENT_TYPES } from "./constants";
import { finalizeSpec } from "./finalize";
import { generateInviteInputSchema, inviteSpecSchema, rsvpSubmissionSchema, type InviteSpec } from "./schema";

function validSpec(): InviteSpec {
  const input = generateInviteInputSchema.parse({
    eventType: "wedding",
    hosts: ["Aarav", "Meera"],
    events: [
      {
        title: "Wedding Ceremony",
        startsAtLocal: "2030-02-14T18:30",
        timezone: "Asia/Kolkata",
        venueName: "Umaid Palace",
        address: "12 Palace Road, Jodhpur",
        mapUrl: "https://maps.google.com/?q=Umaid",
      },
    ],
  });
  return buildInviteSpec(input, buildDefaultStyle("wedding", input.hosts));
}

describe("inviteSpecSchema (schemaVersion 1)", () => {
  it("accepts a valid spec built from defaults", () => {
    const spec = validSpec();
    expect(inviteSpecSchema.safeParse(spec).success).toBe(true);
    expect(spec.schemaVersion).toBe(1);
    expect(spec.events[0].startsAt).toBe("2030-02-14T18:30:00+05:30");
    expect(spec.music).toBeNull();
  });

  it("accepts the exact example shape from the brief", () => {
    const parsed = inviteSpecSchema.safeParse({
      schemaVersion: 1,
      eventType: "wedding",
      displayMode: "animated",
      template: "royal_ivory",
      palette: { background: "#fbf6ea", surface: "#fffdf7", accent: "#8a6420", text: "#3a1420" },
      typography: "serif_classic",
      animation: { preset: "gate_open", intensity: "subtle" },
      hosts: ["Name", "Name"],
      headline: "string",
      subheadline: "string",
      greetingTemplate: "Dear {guest_name}, you are warmly invited",
      events: [
        {
          title: "Ceremony",
          startsAt: "2030-01-01T10:00:00+05:30",
          timezone: "Asia/Kolkata",
          venueName: "Venue",
          address: "Address",
          mapUrl: "",
        },
      ],
      closingNote: "string",
      music: null,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.image).toBeNull();
  });

  it.each([
    ["unknown template", (s: Record<string, unknown>) => ({ ...s, template: "neon_rave" })],
    ["unknown typography", (s: Record<string, unknown>) => ({ ...s, typography: "comic_sans" })],
    ["unknown animation", (s: Record<string, unknown>) => ({ ...s, animation: { preset: "confetti_cannon", intensity: "rich" } })],
    ["unknown intensity", (s: Record<string, unknown>) => ({ ...s, animation: { preset: "gate_open", intensity: "extreme" } })],
    ["wrong schemaVersion", (s: Record<string, unknown>) => ({ ...s, schemaVersion: 2 })],
    ["unknown event type", (s: Record<string, unknown>) => ({ ...s, eventType: "funeral" })],
    ["unknown display mode", (s: Record<string, unknown>) => ({ ...s, displayMode: "3d" })],
    ["bad palette hex", (s: Record<string, unknown>) => ({ ...s, palette: { ...(s.palette as object), accent: "gold" } })],
    ["3-digit hex in stored spec", (s: Record<string, unknown>) => ({ ...s, palette: { ...(s.palette as object), accent: "#abc" } })],
    ["no hosts", (s: Record<string, unknown>) => ({ ...s, hosts: [] })],
    ["no events", (s: Record<string, unknown>) => ({ ...s, events: [] })],
    ["empty headline", (s: Record<string, unknown>) => ({ ...s, headline: "   " })],
    ["huge headline", (s: Record<string, unknown>) => ({ ...s, headline: "x".repeat(500) })],
  ])("rejects %s", (_name, mutate) => {
    const bad = mutate(validSpec() as unknown as Record<string, unknown>);
    expect(inviteSpecSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects bad events: javascript map links, http links, bad zones, bad dates", () => {
    const base = validSpec();
    const withEvent = (patch: Record<string, unknown>) => ({
      ...base,
      events: [{ ...base.events[0], ...patch }],
    });
    expect(inviteSpecSchema.safeParse(withEvent({ mapUrl: "javascript:alert(1)" })).success).toBe(false);
    expect(inviteSpecSchema.safeParse(withEvent({ mapUrl: "http://insecure.example" })).success).toBe(false);
    expect(inviteSpecSchema.safeParse(withEvent({ mapUrl: "https://maps.example/x" })).success).toBe(true);
    expect(inviteSpecSchema.safeParse(withEvent({ mapUrl: "" })).success).toBe(true);
    expect(inviteSpecSchema.safeParse(withEvent({ timezone: "Mars/Olympus" })).success).toBe(false);
    expect(inviteSpecSchema.safeParse(withEvent({ startsAt: "next friday" })).success).toBe(false);
    expect(inviteSpecSchema.safeParse(withEvent({ startsAt: "2030-02-14T18:30:00" })).success).toBe(false); // no offset
  });

  it("strips unknown keys instead of passing them through", () => {
    const parsed = inviteSpecSchema.safeParse({ ...validSpec(), script: "<script>alert(1)</script>", html: "<b>x</b>" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("script");
      expect(parsed.data).not.toHaveProperty("html");
    }
  });

  it("supports every event type", () => {
    for (const eventType of EVENT_TYPES) {
      const input = generateInviteInputSchema.parse({
        eventType,
        hosts: ["A"],
        events: [{ startsAtLocal: "2030-02-14T18:30" }],
      });
      const spec = buildInviteSpec(input, buildDefaultStyle(eventType, input.hosts));
      expect(inviteSpecSchema.safeParse(spec).success).toBe(true);
    }
  });
});

describe("buildInviteSpec", () => {
  it("throws a typed error for impossible dates", () => {
    const input = generateInviteInputSchema.parse({
      eventType: "birthday",
      hosts: ["Riya"],
      events: [{ startsAtLocal: "2030-13-45T25:61" }],
    });
    expect(() => buildInviteSpec(input, buildDefaultStyle("birthday", input.hosts))).toThrow(InvalidEventTimeError);
  });
});

describe("finalizeSpec", () => {
  it("sanitises copy, applies palette fallback and returns a valid spec", () => {
    const dirty = {
      ...validSpec(),
      headline: "<img src=x onerror=alert(1)>Aarav & Meera",
      palette: { background: "#ffffff", surface: "#ffffff", accent: "#ffffff", text: "#ffffff" },
      greetingTemplate: "Hello {name}, {guest_name}!",
    };
    const result = finalizeSpec(dirty);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.headline).toBe("Aarav & Meera");
      expect(result.spec.greetingTemplate).toBe("Hello , {guest_name}!");
      expect(result.warnings.some((w) => w.startsWith("palette-fallback"))).toBe(true);
    }
  });

  it("replaces a greeting that lost its {guest_name} placeholder", () => {
    const result = finalizeSpec({ ...validSpec(), greetingTemplate: "Welcome everyone" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.spec.greetingTemplate).toContain("{guest_name}");
  });

  it("rejects non-objects and invalid specs without throwing", () => {
    expect(finalizeSpec("nope").ok).toBe(false);
    expect(finalizeSpec(null).ok).toBe(false);
    expect(finalizeSpec({ schemaVersion: 1 }).ok).toBe(false);
  });
});

describe("rsvpSubmissionSchema", () => {
  const base = { status: "yes", partySize: 2, message: "Can't wait", clientSubmittedAt: "2030-01-01T10:00:00.000Z" };
  it("accepts valid submissions", () => {
    expect(rsvpSubmissionSchema.safeParse(base).success).toBe(true);
    expect(rsvpSubmissionSchema.safeParse({ ...base, status: "no", partySize: 0, message: undefined }).success).toBe(true);
  });
  it("rejects bad status, negative party size and bad dates", () => {
    expect(rsvpSubmissionSchema.safeParse({ ...base, status: "perhaps" }).success).toBe(false);
    expect(rsvpSubmissionSchema.safeParse({ ...base, partySize: -1 }).success).toBe(false);
    expect(rsvpSubmissionSchema.safeParse({ ...base, partySize: 1.5 }).success).toBe(false);
    expect(rsvpSubmissionSchema.safeParse({ ...base, clientSubmittedAt: "yesterday" }).success).toBe(false);
  });
});
