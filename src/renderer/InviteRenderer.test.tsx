import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FIXTURE_IDS } from "@/lib/data/fixtures";
import { buildDefaultStyle, buildInviteSpec } from "@/lib/spec/defaults";
import { generateInviteInputSchema, type InviteSpec } from "@/lib/spec/schema";

import { countdownParts } from "./Countdown";
import { mapHref } from "./EventsSection";
import { InviteRenderer } from "./InviteRenderer";
import type { InviteRendererProps } from "./types";

function spec(over: Partial<InviteSpec> = {}): InviteSpec {
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
  return { ...buildInviteSpec(input, buildDefaultStyle("wedding", input.hosts)), ...over };
}

const NOW = new Date("2030-02-10T12:00:00Z");

function html(props: Partial<InviteRendererProps> & { spec?: InviteSpec } = {}) {
  return renderToStaticMarkup(
    <InviteRenderer spec={props.spec ?? spec()} guestName="Alice Sharma" now={NOW} {...props} />,
  );
}

describe("InviteRenderer (pure, static)", () => {
  it("renders the guest's name in the greeting", () => {
    const out = html();
    expect(out).toContain("Dear Alice Sharma, you are warmly invited");
    expect(out).toContain('data-testid="guest-greeting"');
  });

  it("uses a generic greeting on the common link", () => {
    const out = html({ guestName: null });
    expect(out).toContain("Dear Honoured Guest, you are warmly invited");
    expect(out).not.toContain("Alice");
  });

  it("escapes all text: nothing from the spec can become markup", () => {
    const evil = spec({
      headline: '<img src=x onerror="alert(1)">Aarav',
      subheadline: "<script>alert(1)</script>",
      closingNote: '"><svg onload=alert(1)>',
      hosts: ["<b>Aarav</b>"],
    });
    const out = html({ spec: evil, guestName: '<script>steal()</script>' });
    expect(out).not.toContain("<script>");
    expect(out).not.toContain("<img src=x");
    expect(out).not.toContain("<svg onload");
    expect(out).not.toContain("<b>Aarav</b>");
    expect(out).toContain("&lt;script&gt;");
  });

  it("never uses dangerouslySetInnerHTML", async () => {
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        return statSync(full).isDirectory() ? walk(full) : /\.tsx?$/.test(name) && !name.includes(".test.") ? [full] : [];
      });
    for (const root of ["src/renderer", "src/viewer"]) {
      for (const file of walk(root)) {
        expect(readFileSync(file, "utf8"), file).not.toContain("dangerouslySetInnerHTML");
      }
    }
  });

  it("shows the Free-plan watermark only when asked", () => {
    expect(html({ watermark: true })).toContain("Made with Regalia");
    expect(html({ watermark: false })).not.toContain("Made with Regalia");
  });

  it("offers the map link online and falls back to the address text offline", () => {
    const online = html({ online: true });
    expect(online).toContain('data-testid="map-link"');
    expect(online).toContain("12 Palace Road, Jodhpur");
    expect(online).not.toContain("map-offline-hint");

    const offline = html({ online: false });
    expect(offline).not.toContain('data-testid="map-link"');
    expect(offline).toContain('data-testid="map-offline-hint"');
    expect(offline).toContain("12 Palace Road, Jodhpur"); // address is always visible
  });

  it("renders calendar and copy actions", () => {
    const out = html();
    expect(out).toContain('data-testid="add-to-calendar"');
    expect(out).toContain('data-testid="copy-address"');
  });

  it("shows a countdown to the first event", () => {
    expect(html()).toContain('data-testid="countdown"');
    expect(countdownParts(Date.parse("2030-02-12T14:03:04Z"), NOW.getTime())).toMatchObject({
      days: 2,
      hours: 2,
      minutes: 3,
      seconds: 4,
    });
  });

  it("themes through CSS variables from the palette and sets template + typography attributes", () => {
    const s = spec({ template: "midnight_gold", palette: { background: "#0f1b2d", surface: "#17263d", accent: "#e0b85c", text: "#f6efd9" }, typography: "serif_modern" });
    const out = html({ spec: s });
    expect(out).toContain("--inv-bg:#0f1b2d");
    expect(out).toContain('data-template="midnight_gold"');
    expect(out).toContain("font-modern");
  });

  it("renders the hero image from provided asset URLs and a monogram otherwise", () => {
    const withImage = html({
      spec: spec({ image: { assetId: FIXTURE_IDS.heroImage, alt: "The venue" } }),
      assets: { imageUrl: "blob:http://localhost/abc" },
    });
    expect(withImage).toContain('src="blob:http://localhost/abc"');
    expect(withImage).toContain('alt="The venue"');
    expect(html()).toContain("A &amp; M");
  });

  it("RSVP: form on personal links, a note on the common link, disabled in previews", () => {
    const form = html({ rsvp: { mode: "form", maxPartySize: 3, previous: null, result: "idle" } });
    expect(form).toContain('data-testid="rsvp-form"');
    expect(form).toContain("Will you join us?");
    const common = html({ rsvp: { mode: "common", maxPartySize: 1, previous: null, result: "idle" } });
    expect(common).not.toContain('data-testid="rsvp-form"');
    expect(common).toContain("RSVP is available on your personal invitation link");
    const preview = html({ rsvp: { mode: "preview", maxPartySize: 3, previous: null, result: "idle" } });
    expect(preview).toContain("disabled");
  });

  it("RSVP messages: queued offline copy and previous reply", () => {
    const queued = html({
      rsvp: {
        mode: "form",
        maxPartySize: 2,
        previous: { status: "yes", partySize: 1, message: "" },
        result: "queued",
      },
    });
    expect(queued).toContain("Saved. We&#x27;ll send it when you&#x27;re back online.");
    expect(queued).toContain("Your reply: Attending");
  });

  it("does not need the animation layer: static render has no animation markers", () => {
    const out = html();
    expect(out).not.toContain("data-animation-chunk");
  });

  it("tolerates unknown template ids from corrupted storage without throwing", () => {
    const broken = { ...spec(), template: "does_not_exist" } as unknown as InviteSpec;
    expect(() => html({ spec: broken })).not.toThrow();
  });
});

describe("mapHref", () => {
  const event = spec().events[0];
  it("prefers the host's https map link", () => {
    expect(mapHref(event)).toBe("https://maps.google.com/?q=Umaid");
  });
  it("never links to non-https or script URLs; falls back to an address search", () => {
    const href = mapHref({ ...event, mapUrl: "javascript:alert(1)" });
    expect(href).toMatch(/^https:\/\/www\.google\.com\/maps\/search\//);
    expect(href).toContain(encodeURIComponent("Umaid Palace"));
    expect(mapHref({ ...event, mapUrl: "http://plain.example" })).toMatch(/^https:\/\/www\.google\.com/);
  });
  it("returns null with nothing to show", () => {
    expect(mapHref({ ...event, mapUrl: "", venueName: "", address: "" })).toBeNull();
  });
});
