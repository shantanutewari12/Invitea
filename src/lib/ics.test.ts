import { describe, expect, it } from "vitest";

import { buildIcs, escapeIcsText, foldIcsLine, toIcsUtc } from "./ics";

describe("ics", () => {
  it("formats UTC timestamps", () => {
    expect(toIcsUtc(new Date("2030-02-14T13:00:00Z"))).toBe("20300214T130000Z");
  });

  it("escapes RFC 5545 special characters", () => {
    expect(escapeIcsText("a,b;c\\d\nline2")).toBe("a\\,b\\;c\\\\d\\nline2");
  });

  it("folds long lines at 75 octets without splitting characters", () => {
    const line = `SUMMARY:${"é".repeat(80)}`;
    const folded = foldIcsLine(line);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    for (const [i, part] of parts.entries()) {
      const bytes = new TextEncoder().encode(i === 0 ? part : part.slice(1)).length;
      expect(bytes).toBeLessThanOrEqual(75);
      if (i > 0) expect(part.startsWith(" ")).toBe(true);
    }
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join("")).toBe(line);
  });

  it("builds a valid single-event calendar with CRLF line endings", () => {
    const ics = buildIcs(
      {
        uid: "inv-1",
        title: "Wedding Ceremony",
        startsAt: "2030-02-14T18:30:00+05:30",
        location: "Umaid Palace, Jodhpur",
        description: "Aarav & Meera",
      },
      new Date("2030-01-01T00:00:00Z"),
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20300214T130000Z");
    expect(ics).toContain("DTEND:20300214T160000Z"); // default 3 hour duration
    expect(ics).toContain("SUMMARY:Wedding Ceremony");
    expect(ics).toContain("LOCATION:Umaid Palace\\, Jodhpur");
    expect(ics).not.toMatch(/[^\r]\n/); // no bare LF
  });

  it("throws on an invalid start time", () => {
    expect(() => buildIcs({ uid: "x", title: "T", startsAt: "nope" })).toThrow();
  });
});
