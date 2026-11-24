import { describe, expect, it } from "vitest";

import { normalizePhone, parseGuestLines } from "./guests";

describe("parseGuestLines", () => {
  it("parses name, phone and seats, skipping blank lines", () => {
    const { guests, errors } = parseGuestLines("Priya Sharma, +91 98123-45678, 3\n\n  Rahul\nAsha; 9812345678\r\nMeena\t\t2");
    expect(errors).toEqual([]);
    expect(guests).toEqual([
      { name: "Priya Sharma", phone: "+919812345678", maxPartySize: 3 },
      { name: "Rahul", phone: null, maxPartySize: 4 },
      { name: "Asha", phone: "9812345678", maxPartySize: 4 },
      { name: "Meena", phone: null, maxPartySize: 2 },
    ]);
  });

  it("reports bad lines instead of dropping them", () => {
    const { guests, errors } = parseGuestLines("Ok Guest\nBad Phone, 12\nBad Seats, , 99\n, 9812345678");
    expect(guests).toHaveLength(1);
    expect(errors).toEqual([
      { line: 2, reason: "phone" },
      { line: 3, reason: "seats" },
      { line: 4, reason: "name" },
    ]);
  });
});

describe("normalizePhone", () => {
  it("accepts E.164-like numbers and rejects junk", () => {
    expect(normalizePhone("(022) 2345 6789")).toBe("02223456789");
    expect(normalizePhone("+1 415 555 0100")).toBe("+14155550100");
    expect(normalizePhone("call me")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
  });
});
