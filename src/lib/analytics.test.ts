import { describe, expect, it } from "vitest";

import { analyticsEnabled, sanitizeProps, track } from "./analytics";

describe("analytics privacy", () => {
  it("drops every property that is not allow-listed (no PII can leak)", () => {
    const clean = sanitizeProps({
      event_type: "wedding",
      display_mode: "animated",
      count: 3,
      name: "Priya Sharma",
      email: "a@b.co",
      phone: "+919812345678",
      token: "abcdefghijklmnopqrstu",
      message: "see you",
      address: "1 Palace Rd",
    });
    expect(clean).toEqual({ event_type: "wedding", display_mode: "animated", count: 3 });
  });

  it("rejects free text even under an allowed key", () => {
    expect(sanitizeProps({ source: "Priya Sharma" })).toEqual({});
    expect(sanitizeProps({ source: "priya@example.com" })).toEqual({});
    expect(sanitizeProps({ source: "ai" })).toEqual({ source: "ai" });
    expect(sanitizeProps({ count: Number.NaN })).toEqual({});
  });

  it("is a silent no-op without a key or window", () => {
    expect(analyticsEnabled()).toBe(false);
    expect(() => track("invite_created", { event_type: "wedding" })).not.toThrow();
  });
});
