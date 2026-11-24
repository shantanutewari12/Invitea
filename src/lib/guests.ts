import { MAX_PARTY_SIZE_DEFAULT } from "@/config/plans";
import { LIMITS } from "@/lib/spec/constants";

export interface GuestDraft {
  name: string;
  phone: string | null;
  maxPartySize: number;
}

export interface GuestLineError {
  line: number;
  reason: "name" | "phone" | "seats";
}

const PHONE = /^\+?[0-9]{7,15}$/;

/** Strip the usual separators from a typed phone number. Returns null when it is not a phone. */
export function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s().-]/g, "");
  return PHONE.test(cleaned) ? cleaned : null;
}

/**
 * Parse pasted guests, one per line: `name[, phone[, seats]]` (comma, semicolon or tab separated).
 * Blank lines are skipped. Bad lines are reported, never silently dropped.
 */
export function parseGuestLines(text: string): { guests: GuestDraft[]; errors: GuestLineError[] } {
  const guests: GuestDraft[] = [];
  const errors: GuestLineError[] = [];
  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    const [nameRaw = "", phoneRaw = "", seatsRaw = ""] = line.split(/[,;\t]/).map((part) => part.trim());
    const lineNo = index + 1;
    if (nameRaw.length < 1 || nameRaw.length > LIMITS.guestName) return void errors.push({ line: lineNo, reason: "name" });

    let phone: string | null = null;
    if (phoneRaw) {
      phone = normalizePhone(phoneRaw);
      if (!phone) return void errors.push({ line: lineNo, reason: "phone" });
    }
    let maxPartySize = MAX_PARTY_SIZE_DEFAULT;
    if (seatsRaw) {
      const seats = Number(seatsRaw);
      if (!Number.isInteger(seats) || seats < 1 || seats > 20) return void errors.push({ line: lineNo, reason: "seats" });
      maxPartySize = seats;
    }
    guests.push({ name: nameRaw, phone, maxPartySize });
  });
  return { guests, errors };
}
