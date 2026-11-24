import { describe, expect, it } from "vitest";

import { formatEventWhen, isValidTimeZone, localDateTimeToIso } from "./time";

describe("localDateTimeToIso", () => {
  it("converts wall-clock time in India (+05:30, no DST)", () => {
    expect(localDateTimeToIso("2030-02-14T18:30", "Asia/Kolkata")).toBe("2030-02-14T18:30:00+05:30");
  });

  it("handles DST: New York winter vs summer", () => {
    expect(localDateTimeToIso("2030-01-15T12:00", "America/New_York")).toBe("2030-01-15T12:00:00-05:00");
    expect(localDateTimeToIso("2030-07-15T12:00", "America/New_York")).toBe("2030-07-15T12:00:00-04:00");
  });

  it("round-trips to the correct instant", () => {
    const iso = localDateTimeToIso("2030-02-14T18:30", "Asia/Kolkata");
    expect(new Date(iso!).toISOString()).toBe("2030-02-14T13:00:00.000Z");
  });

  it("returns null for malformed input or unknown zones", () => {
    expect(localDateTimeToIso("14/02/2030 18:30", "Asia/Kolkata")).toBeNull();
    expect(localDateTimeToIso("2030-02-14T18:30", "Nowhere/Land")).toBeNull();
    expect(localDateTimeToIso("2030-13-45T25:61", "Asia/Kolkata")).toBeNull();
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA zones and rejects junk", () => {
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(42)).toBe(false);
    expect(isValidTimeZone("x".repeat(100))).toBe(false);
  });
});

describe("formatEventWhen", () => {
  it("renders in the event's own zone regardless of the viewer's zone", () => {
    const when = formatEventWhen("2030-02-14T18:30:00+05:30", "Asia/Kolkata", "en-IN");
    expect(when.date).toContain("14 February 2030");
    expect(when.time.toLowerCase()).toContain("6:30");
    expect(when.time.toLowerCase()).toContain("pm");
  });

  it("does not throw on bad input", () => {
    expect(formatEventWhen("garbage", "Asia/Kolkata").date).toBe("");
    expect(formatEventWhen("2030-02-14T18:30:00+05:30", "Bad/Zone").zone).toBe("UTC");
  });
});

describe("isoToLocalInput", () => {
  it("round-trips with localDateTimeToIso across zones", async () => {
    const { isoToLocalInput, localDateTimeToIso } = await import("./time");
    for (const [local, zone] of [
      ["2030-05-01T18:30", "Asia/Kolkata"],
      ["2030-12-31T23:59", "America/New_York"],
      ["2030-01-01T00:00", "Pacific/Auckland"],
    ] as const) {
      const iso = localDateTimeToIso(local, zone);
      expect(iso).not.toBeNull();
      expect(isoToLocalInput(iso!, zone)).toBe(local);
    }
  });
});
